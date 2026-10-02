-- Quote draft security and integrity tests. Plain SQL, one transaction, rolled back at the
-- end. Any failed assertion raises and fails the run.

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

-- A quote payload for the function, with a customer (or none).
create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', null, 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', 'Thanks!', 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.line(i int, kind text, name text, qty bigint, price bigint) returns jsonb
language sql as $f$
  select jsonb_build_object('sort_order', i, 'kind', kind, 'name', name,
    'quantity_milli', qty, 'unit_price_cents', price)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000008a1';
  b uuid := '00000000-0000-4000-8000-0000000008b1';
  c uuid := '00000000-0000-4000-8000-0000000008c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  qa uuid;
  qb uuid;
  qc uuid;
  n int;
  big jsonb;
begin
  insert into auth.users (id, email) values
    (a, 'qa@example.test'), (b, 'qb@example.test'), (c, 'qc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'A customer') returning id into cust_a;
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.customers (organisation_id, name) values (org_b, 'B customer') returning id into cust_b;
  reset role;

  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Owner A: create, edit, replace lines
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;

  qa := public.save_quote_draft(
    org_a, null, pg_temp.quote_json(cust_a),
    jsonb_build_array(
      pg_temp.line(0, 'custom', 'Wedding cake', 1000, 80000),
      pg_temp.line(1, 'custom', 'Cupcakes', 12000, 1500),
      pg_temp.line(2, 'delivery', 'Delivery', 1000, 5000)));
  assert qa is not null, 'save_quote_draft did not return an id';
  assert (select status from public.quotes where id = qa) = 'draft', 'new quote is not a draft';
  assert (select gross_cents from public.quotes where id = qa) = 115000, 'totals were not stored';
  assert (select count(*) from public.quote_lines where quote_id = qa) = 3, 'lines were not saved';
  assert (select name from public.quote_lines where quote_id = qa and sort_order = 1) = 'Cupcakes',
    'line order was not kept';

  -- Saving again replaces the lines.
  perform public.save_quote_draft(
    org_a, qa, pg_temp.quote_json(null),
    jsonb_build_array(pg_temp.line(0, 'custom', 'Only line', 2500, 1000)));
  assert (select count(*) from public.quote_lines where quote_id = qa) = 1, 'lines were not replaced';
  assert (select customer_id from public.quotes where id = qa) is null, 'customer was not cleared';

  -- A failed save changes nothing: the old lines are still there.
  begin
    perform public.save_quote_draft(
      org_a, qa, pg_temp.quote_json(cust_a),
      jsonb_build_array(
        pg_temp.line(0, 'custom', 'Would replace', 1000, 100),
        pg_temp.line(1, 'custom', '', 1000, 100)));  -- empty name
    raise exception 'FAIL: a line with an empty name was accepted';
  exception when check_violation then null;
  end;
  assert (select name from public.quote_lines where quote_id = qa) = 'Only line',
    'a failed save left the quote half-changed';
  assert (select customer_id from public.quotes where id = qa) is null,
    'a failed save changed the quote header';

  -- Shape rules.
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null),
      jsonb_build_array(pg_temp.line(0, 'custom', 'Zero', 0, 100)));
    raise exception 'FAIL: zero quantity was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null),
      jsonb_build_array(pg_temp.line(0, 'custom', 'Negative', 1000, -1)));
    raise exception 'FAIL: negative price was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null),
      jsonb_build_array(
        pg_temp.line(0, 'delivery', 'Delivery', 1000, 100),
        pg_temp.line(1, 'collection', 'Collection', 1000, 0)));
    raise exception 'FAIL: two fulfilment lines were accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null),
      jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'D',
        'quantity_milli', 1000, 'unit_price_cents', 100, 'discount_kind', 'percent', 'discount_value', 10001)));
    raise exception 'FAIL: a discount over 100 percent was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null,
      pg_temp.quote_json(null) || '{"valid_until":"2026-10-01"}'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: valid-until before the issue date was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null,
      pg_temp.quote_json(null) || '{"quote_discount_kind":"percent","quote_discount_value":0}'::jsonb, '[]'::jsonb);
    raise exception 'FAIL: an inconsistent quote discount was accepted';
  exception when check_violation then null;
  end;

  -- At most 100 lines.
  select jsonb_agg(pg_temp.line(i, 'custom', 'L' || i, 1000, 100)) into big from generate_series(0, 100) i;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null), big);
    raise exception 'FAIL: 101 lines were accepted';
  exception when program_limit_exceeded then null;
  end;

  -- Only a customer of the SAME business can be attached.
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_b), '[]'::jsonb);
    raise exception 'FAIL: another business''s customer was attached';
  exception when foreign_key_violation then null;
  end;

  -- Status, ids and timestamps cannot be written directly.
  begin
    update public.quotes set status = 'sent' where id = qa;
    raise exception 'FAIL: status was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quotes set country_code = 'US' where id = qa;
    raise exception 'FAIL: country_code was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quotes set organisation_id = org_b where id = qa;
    raise exception 'FAIL: organisation_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.quote_lines set name = 'x' where quote_id = qa;
    raise exception 'FAIL: quote lines were directly updatable';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Staff C: any member can create, edit and delete drafts
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;

  select count(*) into n from public.quotes where organisation_id = org_a;
  assert n >= 1, 'staff cannot see their business''s quotes';
  qc := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a),
    jsonb_build_array(pg_temp.line(0, 'custom', 'Staff line', 1000, 100)));
  perform public.save_quote_draft(org_a, qc, pg_temp.quote_json(cust_a),
    jsonb_build_array(pg_temp.line(0, 'custom', 'Staff edit', 1000, 200)));
  assert (select unit_price_cents from public.quote_lines where quote_id = qc) = 200, 'staff could not edit a draft';
  delete from public.quotes where id = qc;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not delete a draft';
  assert (select count(*) from public.quote_lines where quote_id = qc) = 0, 'deleting a draft left its lines';
  reset role;

  ----------------------------------------------------------------------
  -- Business B: isolation
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;

  select count(*) into n from public.quotes;
  assert n = 0, format('B sees quotes it should not: %s', n);
  select count(*) into n from public.quote_lines;
  assert n = 0, format('B sees quote lines it should not: %s', n);

  qb := public.save_quote_draft(org_b, null, pg_temp.quote_json(cust_b),
    jsonb_build_array(pg_temp.line(0, 'custom', 'B line', 1000, 100)));

  -- B cannot edit A's draft, or plant a quote in A's business.
  begin
    perform public.save_quote_draft(org_b, qa, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: B edited A''s draft (as B''s business)';
  exception when no_data_found then null;
  end;
  begin
    perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: B edited A''s draft (as A''s business)';
  exception when no_data_found then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: B created a quote in A''s business';
  exception when insufficient_privilege then null;
  end;
  delete from public.quotes where id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'B deleted A''s draft';
  reset role;
  assert (select count(*) from public.quote_lines where quote_id = qa) = 1, 'A''s lines were touched by B';

  ----------------------------------------------------------------------
  -- Once a quote leaves draft, members cannot change or delete it through the API
  ----------------------------------------------------------------------
  update public.quotes set status = 'sent' where id = qa;  -- as the database owner, like issuing will

  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(null),
      jsonb_build_array(pg_temp.line(0, 'custom', 'Sneaky', 1000, 1)));
    raise exception 'FAIL: a sent quote was edited';
  exception when no_data_found then null;
  end;
  delete from public.quotes where id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote was deleted';
  delete from public.quote_lines where quote_id = qa;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote''s lines were deleted';
  begin
    insert into public.quote_lines (organisation_id, quote_id, sort_order, name, quantity_milli, unit_price_cents)
    values (org_a, qa, 9, 'Planted', 1000, 1);
    raise exception 'FAIL: a line was added to a sent quote';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.quotes where id = qa;
  assert n = 1, 'a sent quote should stay readable';
  reset role;

  ----------------------------------------------------------------------
  -- Signed-out and ended sessions get nothing
  ----------------------------------------------------------------------
  set local role anon;
  begin
    perform count(*) from public.quotes;
    raise exception 'FAIL: anon could read quotes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: anon could call save_quote_draft';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(a);
  delete from auth.sessions where user_id = a;
  set local role authenticated;
  select count(*) into n from public.quotes;
  assert n = 0, 'quotes were readable with an ended session';
  begin
    perform public.save_quote_draft(org_a, null, pg_temp.quote_json(null), '[]'::jsonb);
    raise exception 'FAIL: a quote was saved with an ended session';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'quotes tests passed';
end
$$;

rollback;
