-- Issuing quotes: numbers, sending (server only), revising, versions, events, numbering
-- settings. Plain SQL, one transaction, rolled back at the end.

begin;

-- Test helper: a signed-in user has a real session, as in production.
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

-- What the server would build: only number and version matter to the database.
create function pg_temp.snap(num text, ver int, marker text) returns jsonb language sql as $f$
  select jsonb_build_object('number', num, 'version', ver, 'marker', marker)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000009a1';
  b uuid := '00000000-0000-4000-8000-0000000009b1';
  c uuid := '00000000-0000-4000-8000-0000000009c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  qa uuid;
  qa2 uuid;
  qb uuid;
  qempty uuid;
  qnocust uuid;
  stamp timestamptz;
  result jsonb;
  n int;
begin
  insert into auth.users (id, email) values
    (a, 'ia@example.test'), (b, 'ib@example.test'), (c, 'ic@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'A customer') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Numbers: given when the draft is first saved, per business, never editable
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  qa := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Cake')));
  qa2 := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Pie')));
  assert (select number from public.quotes where id = qa) = 'QT-0001', 'first draft number';
  assert (select number from public.quotes where id = qa2) = 'QT-0002', 'second draft number';
  assert (select version from public.quotes where id = qa) = 1, 'a new quote is version 1';

  -- Saving again keeps the number.
  perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Cake 2')));
  assert (select number from public.quotes where id = qa) = 'QT-0001', 'saving changed the number';

  -- A person cannot choose or change the number or version.
  begin
    update public.quotes set number = 'QT-9999' where id = qa;
    raise exception 'FAIL: number was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quotes set version = 7 where id = qa;
    raise exception 'FAIL: version was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quotes (organisation_id, issue_date, valid_until, country_code, currency_code, number)
    values (org_a, '2026-10-02', '2026-10-16', 'ZA', 'ZAR', 'QT-5000');
    raise exception 'FAIL: number was insertable';
  exception when insufficient_privilege then null;
  end;

  -- Deleting a never-sent draft is allowed and leaves a gap (quotes are not tax documents).
  delete from public.quotes where id = qa2;
  get diagnostics n = row_count;
  assert n = 1, 'a draft could not be deleted';
  qempty := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), '[]'::jsonb);
  assert (select number from public.quotes where id = qempty) = 'QT-0003', 'numbers after a deleted draft';
  qnocust := public.save_quote_draft(org_a, null, pg_temp.quote_json(null), jsonb_build_array(pg_temp.line(0, 'X')));
  reset role;

  -- Another business numbers on its own.
  perform pg_temp.as_user(b);
  set local role authenticated;
  qb := public.save_quote_draft(org_b, null, pg_temp.quote_json(null), '[]'::jsonb);
  assert (select number from public.quotes where id = qb) = 'QT-0001', 'another business starts at 1';

  -- Not a member: no draft, and no number spent.
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: a non-member created a draft';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert (select next_number from public.document_sequences where organisation_id = org_a and doc_type = 'quote') = 5,
    'a refused draft took a number';

  ----------------------------------------------------------------------
  -- Creating a draft is logged
  ----------------------------------------------------------------------
  assert (select count(*) from public.quote_events where quote_id = qa and kind = 'created' and version = 1) = 1,
    'no created event';
  assert (select actor_id from public.quote_events where quote_id = qa and kind = 'created') = a,
    'created event has no actor';

  ----------------------------------------------------------------------
  -- Sending and revising are server only
  ----------------------------------------------------------------------
  select updated_at into stamp from public.quotes where id = qa;
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: a signed-in user called send_quote';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.revise_quote(org_a, qa, a);
    raise exception 'FAIL: a signed-in user called revise_quote';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: anon called send_quote';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Users cannot write versions or events, or mark a quote sent, directly.
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.quote_versions (organisation_id, quote_id, version, sent_via, snapshot)
    values (org_a, qa, 1, 'marked', '{}'::jsonb);
    raise exception 'FAIL: a user wrote a quote version';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.quote_events (organisation_id, quote_id, version, kind) values (org_a, qa, 1, 'created');
    raise exception 'FAIL: a user wrote a quote event';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- send_quote checks
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.send_quote(org_a, qa, a, 'carrier pigeon', stamp, pg_temp.snap('QT-0001', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: an unknown way of sending was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, '[]'::jsonb, 1, 1, 1);
    raise exception 'FAIL: a snapshot that is not an object was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0099', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: a snapshot for another number was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 2, 'x'), 1, 1, 1);
    raise exception 'FAIL: a snapshot for another version was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp - interval '1 second', pg_temp.snap('QT-0001', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: a stale draft was sent';
  exception when serialization_failure then null;
  end;
  begin
    perform public.send_quote(org_a, qempty, a, 'marked',
      (select updated_at from public.quotes where id = qempty), pg_temp.snap('QT-0003', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: a quote with no lines was sent';
  exception when check_violation then null;
  end;
  begin
    perform public.send_quote(org_a, qnocust, a, 'marked',
      (select updated_at from public.quotes where id = qnocust), pg_temp.snap('QT-0004', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: a quote with no customer was sent';
  exception when check_violation then null;
  end;
  begin
    perform public.send_quote(org_b, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 1, 'x'), 1, 1, 1);
    raise exception 'FAIL: another business''s quote was sent';
  exception when no_data_found then null;
  end;
  reset role;
  assert (select status from public.quotes where id = qa) = 'draft', 'a refused send changed the quote';
  assert (select count(*) from public.quote_versions where quote_id = qa) = 0, 'a refused send left a version';

  ----------------------------------------------------------------------
  -- A good send
  ----------------------------------------------------------------------
  set local role service_role;
  result := public.send_quote(org_a, qa, a, 'shared', stamp, pg_temp.snap('QT-0001', 1, 'first'), 200000, 30000, 230000);
  reset role;
  assert result ->> 'number' = 'QT-0001' and (result ->> 'version')::int = 1, 'send result';
  assert (select status from public.quotes where id = qa) = 'sent', 'quote not sent';
  assert (select gross_cents from public.quotes where id = qa) = 230000, 'totals were not stored';
  assert (select last_sent_at from public.quotes where id = qa) is not null, 'no sent time';
  assert (select snapshot ->> 'marker' from public.quote_versions where quote_id = qa and version = 1) = 'first',
    'snapshot not stored';
  assert (select sent_via from public.quote_versions where quote_id = qa) = 'shared', 'sent_via not stored';
  assert (select count(*) from public.quote_events where quote_id = qa and kind = 'sent' and via = 'shared' and actor_id = a) = 1,
    'no sent event';

  -- Sending twice does nothing.
  set local role service_role;
  begin
    perform public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 1, 'again'), 1, 1, 1);
    raise exception 'FAIL: a sent quote was sent again';
  exception when no_data_found then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- A sent quote is frozen for members
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Sneaky')));
    raise exception 'FAIL: a sent quote was edited';
  exception when no_data_found then null;
  end;
  delete from public.quotes where id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote was deleted';
  delete from public.quote_lines where quote_id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote''s lines were deleted';
  assert (select count(*) from public.quote_versions where quote_id = qa) = 1, 'a member cannot read versions';
  assert (select count(*) from public.quote_events where quote_id = qa) = 2, 'a member cannot read events';
  reset role;

  -- Another business sees nothing.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.quote_versions) = 0, 'another business can read versions';
  assert (select count(*) from public.quote_events where quote_id = qa) = 0, 'another business can read events';
  reset role;

  -- Versions are immutable even for the owner of the database.
  begin
    update public.quote_versions set snapshot = '{}'::jsonb where quote_id = qa;
    raise exception 'FAIL: a version was changed';
  exception when object_not_in_prerequisite_state then null;
  end;

  ----------------------------------------------------------------------
  -- Revising: same number, next version, earlier version kept
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.revise_quote(org_a, qempty, a);
    raise exception 'FAIL: a draft was revised';
  exception when no_data_found then null;
  end;
  begin
    perform public.revise_quote(org_b, qa, b);
    raise exception 'FAIL: another business''s quote was revised';
  exception when no_data_found then null;
  end;
  assert public.revise_quote(org_a, qa, a) = 2, 'revise did not return the new version';
  reset role;
  assert (select status from public.quotes where id = qa) = 'draft', 'revising did not reopen the quote';
  assert (select number from public.quotes where id = qa) = 'QT-0001', 'revising changed the number';
  assert (select version from public.quotes where id = qa) = 2, 'version not bumped';
  assert (select count(*) from public.quote_lines where quote_id = qa) = 1, 'the lines were not kept';
  assert (select count(*) from public.quote_events where quote_id = qa and kind = 'revised' and version = 2 and actor_id = a) = 1,
    'no revised event';

  perform pg_temp.as_user(a);
  set local role authenticated;
  -- The revision can be edited, but never deleted (that would delete a sent version with it).
  perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Cake, revised')));
  delete from public.quotes where id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'a revision of a sent quote was deleted';
  reset role;
  assert (select count(*) from public.quote_versions where quote_id = qa) = 1, 'a version was lost';

  select updated_at into stamp from public.quotes where id = qa;
  set local role service_role;
  result := public.send_quote(org_a, qa, a, 'marked', stamp, pg_temp.snap('QT-0001', 2, 'second'), 100000, 15000, 115000);
  reset role;
  assert (result ->> 'version')::int = 2, 'second send version';
  assert (select count(*) from public.quote_versions where quote_id = qa) = 2, 'both versions are kept';
  assert (select snapshot ->> 'marker' from public.quote_versions where quote_id = qa and version = 1) = 'first',
    'the first version changed';
  assert (select snapshot ->> 'marker' from public.quote_versions where quote_id = qa and version = 2) = 'second',
    'the second version is wrong';

  ----------------------------------------------------------------------
  -- Numbering settings: owners and admins, never backwards
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  begin
    perform public.set_document_numbering(org_a, 'quote', 'Q-', 100);
    raise exception 'FAIL: staff changed the numbering';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  begin
    perform public.set_document_numbering(org_a, 'quote', 'Q-', 100);
    raise exception 'FAIL: another business changed the numbering';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.set_document_numbering(org_a, 'quote', 'Q-', 4);
    raise exception 'FAIL: the next number went back to one already used';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_document_numbering(org_a, 'invoice', 'I-', 1);
    raise exception 'FAIL: invoice numbering was changed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_document_numbering(org_a, 'quote', 'bad prefix!', 100);
    raise exception 'FAIL: a malformed prefix was accepted';
  exception when check_violation then null;
  end;
  perform public.set_document_numbering(org_a, 'quote', 'Q/', 100);
  qempty := public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
  assert (select number from public.quotes where id = qempty) = 'Q/0100', 'the new numbering was not used';
  begin
    perform public.set_document_numbering(org_a, 'quote', 'Q/', 100);
    raise exception 'FAIL: the next number was set to one just used';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  -- A prefix change that would make a number collide skips to a free one, never wedges.
  perform public.set_document_numbering(org_a, 'quote', 'Q/1', 101);
  qempty := public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
  assert (select number from public.quotes where id = qempty) = 'Q/10101', 'collision setup';
  perform public.set_document_numbering(org_a, 'quote', 'Q/', 10101);
  qempty := public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
  assert (select number from public.quotes where id = qempty) = 'Q/10102', 'a colliding number was not skipped';
  reset role;

  -- Deleting the login of someone who sent a quote works (it forgets who), changes nothing else.
  delete from auth.users where id = a;
  assert (select count(*) from public.quote_versions where quote_id = qa) = 2, 'a version was lost';
  assert (select count(*) from public.quote_versions where quote_id = qa and sent_by is null) = 2, 'sent_by kept';
  assert (select snapshot ->> 'marker' from public.quote_versions where quote_id = qa and version = 1) = 'first',
    'a snapshot changed when its sender was deleted';
  insert into auth.users (id, email) values (a, 'ia2@example.test');

  -- A signed-out session cannot, even for the owner.
  perform pg_temp.as_user(a);
  delete from auth.sessions where user_id = a;
  set local role authenticated;
  begin
    perform public.set_document_numbering(org_a, 'quote', 'Z-', 500);
    raise exception 'FAIL: numbering changed with a dead session';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'quote issuing tests passed';
end
$$;

rollback;
