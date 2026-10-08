-- Discarding a revision: a revising draft goes back to the version that was sent. The move
-- is server-only, logged, and never touches the sent versions. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000008a1';
  b uuid := '00000000-0000-4000-8000-0000000008b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  q1 uuid;
  q2 uuid;
  qdraft uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'da@example.test'), (b, 'db@example.test');

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
  set local role authenticated;
  qdraft := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Pie')));
  reset role;

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  set local role authenticated;
  begin
    perform public.discard_quote_revision(org_a, q1, a, now());
    raise exception 'FAIL: a signed-in user called discard_quote_revision';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.revise_quote(org_a, q1, a, '{}'::jsonb);
    raise exception 'FAIL: a signed-in user called revise_quote';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind, base)
    values (org_a, q1, 2, 'revised', '{}'::jsonb);
    raise exception 'FAIL: a user wrote a revised event';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.discard_quote_revision(org_a, q1, a, now());
    raise exception 'FAIL: anon called discard_quote_revision';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Not a revision: nothing to discard
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.discard_quote_revision(org_a, q1, a, now());
    raise exception 'FAIL: a sent quote was discarded';
  exception when no_data_found then null;
  end;
  begin
    perform public.discard_quote_revision(org_a, qdraft, a, now());
    raise exception 'FAIL: a first draft was discarded';
  exception when no_data_found then null;
  end;

  ----------------------------------------------------------------------
  -- A revision keeps the copy it began from, and can be discarded
  ----------------------------------------------------------------------
  begin
    perform public.revise_quote(org_a, q1, a, '[1]'::jsonb);
    raise exception 'FAIL: a stored copy that is not an object was accepted';
  exception when invalid_parameter_value then null;
  end;
  assert public.revise_quote(org_a, q1, a, jsonb_build_object('title', 'As sent')) = 2, 'revise did not start version 2';
  reset role;

  select count(*) into n from public.quote_events where quote_id = q1 and kind = 'revised' and has_base;
  assert n = 1, 'the revised event did not keep the copy';

  -- Another business cannot discard it.
  set local role service_role;
  begin
    perform public.discard_quote_revision(org_b, q1, b, now());
    raise exception 'FAIL: another business discarded a revision';
  exception when no_data_found then null;
  end;

  -- A draft saved after the restore (by another tab) blocks it.
  begin
    perform public.discard_quote_revision(org_a, q1, a, now() - interval '1 day');
    raise exception 'FAIL: discarded although the draft had changed';
  exception when serialization_failure then null;
  end;
  assert public.discard_quote_revision(org_a, q1, a, (select updated_at from public.quotes where id = q1)) = 1, 'discard did not go back to version 1';
  reset role;

  assert (select status from public.quotes where id = q1) = 'sent', 'the quote is not sent again';
  assert (select version from public.quotes where id = q1) = 1, 'the version did not go back';
  assert (select count(*) from public.quote_versions where quote_id = q1) = 1, 'a sent version went missing';
  assert (select version from public.quote_events where quote_id = q1 and kind = 'discarded') = 2,
    'the discard was not logged at the dropped version';

  -- Gone for good: it can't be discarded twice, and the next revision is version 2 again.
  set local role service_role;
  begin
    perform public.discard_quote_revision(org_a, q1, a, now());
    raise exception 'FAIL: a sent quote was discarded twice';
  exception when no_data_found then null;
  end;
  assert public.revise_quote(org_a, q1, a, jsonb_build_object('title', 'Again')) = 2, 'a second revision did not start at version 2';
  reset role;

  -- The copy belongs to a revised event only.
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind, base)
    values (org_a, q2, 1, 'created', '{}'::jsonb);
    raise exception 'FAIL: a copy on something that is not a revised event';
  exception when check_violation then null;
  end;

  -- A revision with no stored copy (begun before this existed) cannot be discarded at all.
  set local role service_role;
  perform public.revise_quote(org_a, q2, a);
  assert not (select has_base from public.quote_events where quote_id = q2 and kind = 'revised'), 'a missing copy shows as kept';
  begin
    perform public.discard_quote_revision(org_a, q2, a, (select updated_at from public.quotes where id = q2));
    raise exception 'FAIL: discarded a revision that kept no copy';
  exception when no_data_found then null;
  end;
  reset role;

  -- Members read the log; other businesses do not.
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.quote_events where quote_id = q1;
  assert n = 0, 'another business can read the log';
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.quote_events where quote_id = q1 and kind = 'discarded';
  assert n = 1, 'a member cannot read the log';
  reset role;

  raise notice 'discard revision tests passed';
end
$$;

rollback;
