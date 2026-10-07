-- Quote outcomes: accepted, declined, withdrawn, reopened. The status changes only through a
-- server-only function, and every change is logged. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', null, 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.line(i int, name text) returns jsonb language sql as $f$
  select jsonb_build_object('sort_order', i, 'kind', 'custom', 'name', name,
    'quantity_milli', 1000, 'unit_price_cents', 100000)
$f$;

-- A quote that has been sent, made the way the server makes one.
create function pg_temp.sent_quote(org uuid, cust uuid, actor uuid) returns uuid language plpgsql as $f$
declare
  q uuid;
  stamp timestamptz;
  num text;
begin
  set local role authenticated;
  q := public.save_quote_draft(org, null, pg_temp.quote_json(cust), jsonb_build_array(pg_temp.line(0, 'Cake')));
  reset role;
  select updated_at, number into stamp, num from public.quotes where id = q;
  set local role service_role;
  perform public.send_quote(org, q, actor, 'marked', stamp,
    jsonb_build_object('number', num, 'version', 1), 100000, 15000, 115000);
  reset role;
  return q;
end
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000007a1';
  b uuid := '00000000-0000-4000-8000-0000000007b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  q1 uuid;
  q2 uuid;
  q3 uuid;
  qdraft uuid;
begin
  insert into auth.users (id, email) values (a, 'oa@example.test'), (b, 'ob@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'A customer') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  q1 := pg_temp.sent_quote(org_a, cust_a, a);
  q2 := pg_temp.sent_quote(org_a, cust_a, a);
  q3 := pg_temp.sent_quote(org_a, cust_a, a);
  set local role authenticated;
  qdraft := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Pie')));
  reset role;

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', 'phone', null);
    raise exception 'FAIL: a signed-in user called record_quote_outcome';
  exception when insufficient_privilege then null;
  end;
  -- Nor can they change the status or write events directly.
  begin
    update public.quotes set status = 'accepted' where id = q1;
    raise exception 'FAIL: a user changed a status directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind, on_date, how)
    values (org_a, q1, 1, 'accepted', date '2026-10-05', 'phone');
    raise exception 'FAIL: a user wrote an outcome event';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', 'phone', null);
    raise exception 'FAIL: anon called record_quote_outcome';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Input checks
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'maybe', null, null, null);
    raise exception 'FAIL: an unknown outcome was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', null, null, null);
    raise exception 'FAIL: an answer without a day and a way was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', null, null);
    raise exception 'FAIL: an answer without a way was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', 'carrier pigeon', null);
    raise exception 'FAIL: an unknown way was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'withdrawn', date '2026-10-05', 'phone', null);
    raise exception 'FAIL: a withdrawal with a day and a way was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', 'phone', repeat('x', 501));
    raise exception 'FAIL: a long note was accepted';
  exception when invalid_parameter_value then null;
  end;
  -- Refused answers change nothing.
  reset role;
  assert (select status from public.quotes where id = q1) = 'sent', 'a refused outcome changed the status';
  assert (select count(*) from public.quote_events where quote_id = q1 and kind <> 'created' and kind <> 'sent') = 0,
    'a refused outcome was logged';

  ----------------------------------------------------------------------
  -- Not a sent quote, not this business's
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.record_quote_outcome(org_a, qdraft, a, 'accepted', date '2026-10-05', 'phone', null);
    raise exception 'FAIL: a draft was answered';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, qdraft, a, 'withdrawn', null, null, null);
    raise exception 'FAIL: a draft was withdrawn';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'reopened', null, null, null);
    raise exception 'FAIL: a sent quote was reopened';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_b, q1, b, 'accepted', date '2026-10-05', 'phone', null);
    raise exception 'FAIL: another business answered this quote';
  exception when no_data_found then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Accepted, then changed, then declined
  ----------------------------------------------------------------------
  set local role service_role;
  assert public.record_quote_outcome(org_a, q1, a, 'accepted', date '2026-10-05', 'whatsapp', '  Sounds good  ') = 'accepted',
    'accepting returned the wrong status';
  reset role;
  assert (select status from public.quotes where id = q1) = 'accepted', 'quote not accepted';
  assert (select count(*) from public.quote_events
           where quote_id = q1 and kind = 'accepted' and version = 1 and actor_id = a
             and on_date = date '2026-10-05' and how = 'whatsapp' and note = 'Sounds good') = 1,
    'accepted event missing or wrong (the note should be trimmed)';

  set local role service_role;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'declined', date '2026-10-06', 'email', null);
    raise exception 'FAIL: an accepted quote was declined without being reopened';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'withdrawn', null, null, null);
    raise exception 'FAIL: an accepted quote was withdrawn';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q1, a, 'reopened', null, null, 'a note');
    raise exception 'FAIL: reopening took a note';
  exception when invalid_parameter_value then null;
  end;
  assert public.record_quote_outcome(org_a, q1, a, 'reopened', null, null, null) = 'sent', 'reopening returned the wrong status';
  assert public.record_quote_outcome(org_a, q1, a, 'declined', date '2026-10-06', 'in_person', null) = 'declined',
    'declining returned the wrong status';
  reset role;
  assert (select status from public.quotes where id = q1) = 'declined', 'quote not declined';
  assert (select count(*) from public.quote_events where quote_id = q1 and kind = 'reopened') = 1, 'reopen not logged';
  -- The earlier answer stays in the log.
  assert (select count(*) from public.quote_events where quote_id = q1 and kind = 'accepted') = 1, 'the earlier answer was lost';

  -- A declined quote can be reopened too.
  set local role service_role;
  assert public.record_quote_outcome(org_a, q1, a, 'reopened', null, null, null) = 'sent', 'reopening a declined quote';
  reset role;

  ----------------------------------------------------------------------
  -- Withdrawn is final
  ----------------------------------------------------------------------
  set local role service_role;
  assert public.record_quote_outcome(org_a, q2, a, 'withdrawn', null, null, 'Price changed') = 'withdrawn', 'withdrawing';
  begin
    perform public.record_quote_outcome(org_a, q2, a, 'reopened', null, null, null);
    raise exception 'FAIL: a withdrawn quote was reopened';
  exception when no_data_found then null;
  end;
  begin
    perform public.record_quote_outcome(org_a, q2, a, 'accepted', date '2026-10-06', 'phone', null);
    raise exception 'FAIL: a withdrawn quote was accepted';
  exception when no_data_found then null;
  end;
  reset role;
  assert (select count(*) from public.quote_events where quote_id = q2 and kind = 'withdrawn' and note = 'Price changed') = 1,
    'withdrawal not logged with its note';
  -- A note that is only spaces is no note.
  set local role service_role;
  perform public.record_quote_outcome(org_a, q3, a, 'withdrawn', null, null, '   ');
  reset role;
  assert (select note from public.quote_events where quote_id = q3 and kind = 'withdrawn') is null, 'a blank note was kept';

  ----------------------------------------------------------------------
  -- A revised quote answers on its new version only after it is sent again; a draft can't be answered
  ----------------------------------------------------------------------
  -- (qdraft was refused above.) An answered quote can't be revised: only sent quotes can.
  set local role service_role;
  begin
    perform public.revise_quote(org_a, q2, a);
    raise exception 'FAIL: a withdrawn quote was revised';
  exception when no_data_found then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Who can read the log
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select count(*) from public.quote_events where quote_id = q1 and kind in ('accepted', 'declined', 'reopened')) = 4,
    'a member cannot read the outcome events';
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.quote_events where kind in ('accepted', 'declined', 'withdrawn', 'reopened')) = 0,
    'another business can read outcome events';
  reset role;

  ----------------------------------------------------------------------
  -- The table's own checks (even for the database owner)
  ----------------------------------------------------------------------
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind) values (org_a, q1, 1, 'accepted');
    raise exception 'FAIL: an accepted event with no day and way';
  exception when check_violation then null;
  end;
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind, on_date, how)
    values (org_a, q1, 1, 'sent', date '2026-10-05', 'phone');
    raise exception 'FAIL: a day and way on something that is not an answer';
  exception when check_violation then null;
  end;
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind, note) values (org_a, q1, 1, 'reopened', 'x');
    raise exception 'FAIL: a note on a reopening';
  exception when check_violation then null;
  end;
  raise notice 'quote outcomes tests passed';
end
$$;

rollback;
