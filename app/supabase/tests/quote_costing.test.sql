-- The costing frozen with a sent quote, and a one-off item's cost (docs/plans/costing-and-margin.md, slice B1; migration
-- 20261113100000): quote_versions.costing is written by the server-only send_quote, never changes, is read by members
-- of the business only and is not part of the snapshot; quote_lines.unit_cost_cents is kept for a one-off item only.
-- Plain SQL, one transaction, rolled back.

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
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000032a1';
  b uuid := '00000000-0000-4000-8000-0000000032b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  prod uuid;
  q uuid;
  q2 uuid;
  stamp timestamptz;
  num text;
  n integer;
  frozen jsonb := '{"schema": 1, "items": [{"name": "Cake", "revenueCents": 10000, "costCents": 2500}]}'::jsonb;
begin
  insert into auth.users (id, email) values (a, 'sa32@example.test'), (b, 'sb32@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi') returning id into cust;
  insert into public.products (organisation_id, kind, name, unit_price_cents) values (org_a, 'product', 'Cake', 50000) returning id into prod;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  ----------------------------------------------------------------------
  -- A one-off item keeps what it costs; an item from a product does not
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 2000, 'unit_price_cents', 90000, 'unit_cost_cents', 31250),
    jsonb_build_object('sort_order', 1, 'kind', 'product', 'product_id', prod, 'name', 'Cake', 'quantity_milli', 1000, 'unit_price_cents', 50000, 'unit_cost_cents', 999),
    jsonb_build_object('sort_order', 2, 'kind', 'custom', 'name', 'Sign', 'quantity_milli', 1000, 'unit_price_cents', 5000)));
  assert (select unit_cost_cents from public.quote_lines where quote_id = q and sort_order = 0) = 31250, 'the one-off cost was not kept';
  assert (select unit_cost_cents from public.quote_lines where quote_id = q and sort_order = 1) is null, 'a product item kept a typed cost';
  assert (select unit_cost_cents from public.quote_lines where quote_id = q and sort_order = 2) is null, 'no cost should stay empty';
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), jsonb_build_array(
      jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 90000, 'unit_cost_cents', -1)));
    raise exception 'a negative cost was accepted';
  exception when check_violation then null;
  end;
  assert (select count(*) from public.quote_lines where quote_id = q) = 3, 'a refused save changed the lines';
  -- A cost is not part of the column grant for changes after the fact: it is replaced with the lines.
  begin
    update public.quote_lines set unit_cost_cents = 1 where quote_id = q;
    raise exception 'a cost was updated in place';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Sending records the costing beside the snapshot
  ----------------------------------------------------------------------
  select updated_at, number into stamp, num from public.quotes where id = q;
  set local role service_role;
  begin
    perform public.send_quote(org_a, q, a, 'marked', stamp, jsonb_build_object('number', num, 'version', 1), 1, 1, 1, '[1]'::jsonb);
    raise exception 'a costing that is not an object was accepted';
  exception when sqlstate '23514' then null;
  end;
  perform public.send_quote(org_a, q, a, 'marked', stamp, jsonb_build_object('number', num, 'version', 1, 'customer', jsonb_build_object('name', 'Thandi')), 1, 1, 1, frozen);
  reset role;
  assert (select costing from public.quote_versions where quote_id = q and version = 1) = frozen, 'the costing was not recorded';
  assert not ((select snapshot from public.quote_versions where quote_id = q and version = 1) ? 'costing'), 'the costing leaked into the snapshot';

  -- A quote sent without any costing (nothing costed) records none.
  perform pg_temp.as_user(a);
  set local role authenticated;
  q2 := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Sign', 'quantity_milli', 1000, 'unit_price_cents', 5000)));
  reset role;
  select updated_at, number into stamp, num from public.quotes where id = q2;
  set local role service_role;
  perform public.send_quote(org_a, q2, a, 'marked', stamp, jsonb_build_object('number', num, 'version', 1), 1, 1, 1);
  reset role;
  assert (select costing from public.quote_versions where quote_id = q2) is null, 'a quote with no costing recorded one';

  ----------------------------------------------------------------------
  -- It never changes, and nobody but a member of the business reads it
  ----------------------------------------------------------------------
  begin
    update public.quote_versions set costing = '{}'::jsonb where quote_id = q;
    raise exception 'a frozen costing was changed';
  exception when sqlstate '55000' then null;
  end;
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select costing from public.quote_versions where quote_id = q) = frozen, 'a member cannot read the costing';
  begin
    perform public.send_quote(org_a, q, a, 'marked', stamp, '{}'::jsonb, 1, 1, 1, null);
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.quote_versions;
  assert n = 0, 'another business can read costings';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.quote_versions;
  assert n = 0, 'costings were readable without a session';
  reset role;
  raise notice 'quote costing tests passed';
end
$$;

rollback;
