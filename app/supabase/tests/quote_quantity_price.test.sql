-- The quantity price on a quote (migration 20261110100000): the switch on the quote (off unless turned on), and the
-- price before the quantity price with its words on an item (both or neither). save_quote_draft carries them; a
-- payload without them keeps the draft's. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid, extra jsonb default '{}') returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000032a1';
  org_a uuid;
  cust uuid;
  q uuid;
begin
  insert into auth.users (id, email) values (a, 'qq32@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust;

  -- Off unless turned on; an item can carry the price before its quantity price and the words.
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Cupcakes', 'quantity_milli', 12000, 'unit_price_cents', 9000,
      'list_price_cents', 10000, 'quantity_price_text', '10 or more: 10% off'),
    jsonb_build_object('sort_order', 1, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 5000)));
  assert not (select show_quantity_prices from public.quotes where id = q), 'the switch should be off by default';
  assert (select list_price_cents from public.quote_lines where quote_id = q and sort_order = 0) = 10000, 'the price before was not kept';
  assert (select quantity_price_text from public.quote_lines where quote_id = q and sort_order = 0) = '10 or more: 10% off', 'the words were not kept';
  assert (select list_price_cents is null and quantity_price_text is null from public.quote_lines where quote_id = q and sort_order = 1), 'an item without a quantity price has one';

  -- Turned on; a payload without the key keeps it.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"show_quantity_prices": true}'), '[]'::jsonb);
  assert (select show_quantity_prices from public.quotes where id = q), 'the switch was not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), '[]'::jsonb);
  assert (select show_quantity_prices from public.quotes where id = q), 'a payload without the switch should keep it';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"show_quantity_prices": false}'), '[]'::jsonb);
  assert not (select show_quantity_prices from public.quotes where id = q), 'the switch was not turned off';

  -- Words without a price before are not kept (both or neither); blank words are none.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'A', 'quantity_milli', 1000, 'unit_price_cents', 100, 'quantity_price_text', '10 or more: 10% off'),
    jsonb_build_object('sort_order', 1, 'kind', 'custom', 'name', 'B', 'quantity_milli', 1000, 'unit_price_cents', 100, 'list_price_cents', 200, 'quantity_price_text', '   ')));
  assert (select count(*) from public.quote_lines where quote_id = q and quantity_price_text is null and list_price_cents is null) = 2,
    'a half-filled quantity price should be stored as none';
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), jsonb_build_array(
      jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'A', 'quantity_milli', 1000, 'unit_price_cents', 100, 'list_price_cents', 200, 'quantity_price_text', repeat('x', 201))));
    raise exception 'words of 201 characters were accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), jsonb_build_array(
      jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'A', 'quantity_milli', 1000, 'unit_price_cents', 100, 'list_price_cents', -1, 'quantity_price_text', 'x')));
    raise exception 'a negative price before was accepted';
  exception when check_violation then null;
  end;
  reset role;
  raise notice 'quote quantity price tests passed';
end
$$;

rollback;
