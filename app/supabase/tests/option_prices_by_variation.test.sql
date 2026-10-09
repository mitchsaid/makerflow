-- Extras priced by variation: save_product stores each value's price for each variation (by the
-- variation's place in the list), replaces them on every save, and drops them with the variation.
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

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000022a1';
  b uuid := '00000000-0000-4000-8000-0000000022b1';
  org_a uuid;
  cake uuid;
  gold uuid;
  small uuid;
  large uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'pa22@example.test'), (b, 'pb22@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');

  cake := public.save_product(org_a, null,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb,
    '[{"name": "Gold", "kind": "one", "required": true, "charge": "item", "price_by_variation": true,
       "values": [{"name": "Gold leaf", "price_cents": 5000, "prices": [{"variation_index": 0, "price_cents": 5000}, {"variation_index": 1, "price_cents": 12000}]}]}]'::jsonb);
  select id into small from public.product_variations where product_id = cake and name = 'Small';
  select id into large from public.product_variations where product_id = cake and name = 'Large';
  select ov.id into gold from public.product_option_values ov join public.product_option_groups g on g.id = ov.group_id where g.product_id = cake;
  assert (select price_by_variation from public.product_option_groups where product_id = cake), 'the switch was not kept';
  assert (select price_cents from public.product_option_value_prices where value_id = gold and variation_id = small) = 5000, 'small price wrong';
  assert (select price_cents from public.product_option_value_prices where value_id = gold and variation_id = large) = 12000, 'large price wrong';

  -- Saved again with the switch off: the prices go.
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    null,
    jsonb_build_array(jsonb_build_object('id', (select id from public.product_option_groups where product_id = cake), 'name', 'Gold', 'kind', 'one', 'required', true, 'charge', 'item',
      'values', jsonb_build_array(jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 5000)))));
  assert (select count(*) from public.product_option_value_prices where value_id = gold) = 0, 'prices stayed with the switch off';

  -- On again; then removing a variation removes its prices.
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    null,
    jsonb_build_array(jsonb_build_object('id', (select id from public.product_option_groups where product_id = cake), 'name', 'Gold', 'kind', 'one', 'required', true, 'charge', 'item', 'price_by_variation', true,
      'values', jsonb_build_array(jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 5000,
        'prices', '[{"variation_index": 0, "price_cents": 4000}, {"variation_index": 1, "price_cents": 9000}]'::jsonb)))));
  assert (select count(*) from public.product_option_value_prices where value_id = gold) = 2, 'prices were not stored again';
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    jsonb_build_array(jsonb_build_object('id', small, 'name', 'Small', 'price_cents', 30000), jsonb_build_object('name', 'Medium', 'price_cents', 45000)),
    null);
  assert (select count(*) from public.product_option_value_prices where value_id = gold) = 1, 'a removed variation''s price stayed';
  assert (select variation_id from public.product_option_value_prices where value_id = gold) = small, 'the wrong price went';

  -- A price for a variation of another product is refused.
  declare
    other uuid;
    other_var uuid;
  begin
    other := public.save_product(org_a, null,
      jsonb_build_object('kind', 'product', 'name', 'Other', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
      '[{"name": "A", "price_cents": 1}, {"name": "B", "price_cents": 2}]'::jsonb, null);
    select id into other_var from public.product_variations where product_id = other limit 1;
    begin
      insert into public.product_option_value_prices (organisation_id, value_id, variation_id, price_cents) values (org_a, gold, other_var, 1);
      raise exception 'FAIL: a price for another product''s variation was accepted';
    exception when check_violation then null;
    end;
  end;

  reset role;

  -- Another business sees none of it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  perform public.ensure_organisation('B Co');
  assert (select count(*) from public.product_option_value_prices where value_id = gold) = 0, 'another business can see prices';
  delete from public.product_option_value_prices where value_id = gold;
  get diagnostics n = row_count;
  assert n = 0, 'another business removed prices';
  reset role;

  raise notice 'option prices by variation tests passed';
end
$$;

rollback;
