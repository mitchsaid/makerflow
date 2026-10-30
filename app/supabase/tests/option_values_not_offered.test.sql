-- Choices not offered for some variations: save_product stores which variations each choice is NOT offered for
-- (by the variation's place in the list), replaces them on every save, and drops them with the variation.
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
  a uuid := '00000000-0000-4000-8000-0000000028a1';
  b uuid := '00000000-0000-4000-8000-0000000028b1';
  org_a uuid;
  cake uuid;
  grp uuid;
  velvet uuid;
  vanilla uuid;
  small uuid;
  large uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'pa28@example.test'), (b, 'pb28@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');

  cake := public.save_product(org_a, null,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb,
    '[{"name": "Flavour", "kind": "one", "required": true, "charge": "item",
       "values": [{"name": "Vanilla", "price_cents": 0, "usual": true},
                  {"name": "Red velvet", "price_cents": 2000, "not_offered": [0]}]}]'::jsonb);
  select id into small from public.product_variations where product_id = cake and name = 'Small';
  select id into large from public.product_variations where product_id = cake and name = 'Large';
  select id into grp from public.product_option_groups where product_id = cake;
  select id into velvet from public.product_option_values where group_id = grp and name = 'Red velvet';
  select id into vanilla from public.product_option_values where group_id = grp and name = 'Vanilla';
  assert (select count(*) from public.product_option_value_exclusions where value_id = velvet) = 1, 'the exclusion was not stored';
  assert (select variation_id from public.product_option_value_exclusions where value_id = velvet) = small, 'excluded the wrong variation';
  assert (select count(*) from public.product_option_value_exclusions where value_id = vanilla) = 0, 'a choice with none was excluded';

  -- Saved again with the key gone: it is offered everywhere again.
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    null,
    jsonb_build_array(jsonb_build_object('id', grp, 'name', 'Flavour', 'kind', 'one', 'required', true, 'charge', 'item',
      'values', jsonb_build_array(
        jsonb_build_object('id', vanilla, 'name', 'Vanilla', 'price_cents', 0),
        jsonb_build_object('id', velvet, 'name', 'Red velvet', 'price_cents', 2000)))));
  assert (select count(*) from public.product_option_value_exclusions where value_id = velvet) = 0, 'exclusions stayed when the key was gone';

  -- Both sizes, then removing a variation removes its exclusion.
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    null,
    jsonb_build_array(jsonb_build_object('id', grp, 'name', 'Flavour', 'kind', 'one', 'required', true, 'charge', 'item',
      'values', jsonb_build_array(
        jsonb_build_object('id', vanilla, 'name', 'Vanilla', 'price_cents', 0),
        jsonb_build_object('id', velvet, 'name', 'Red velvet', 'price_cents', 2000, 'not_offered', jsonb_build_array(0, 1, 1))))));
  assert (select count(*) from public.product_option_value_exclusions where value_id = velvet) = 2, 'both exclusions were not stored once';
  perform public.save_product(org_a, cake,
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
    jsonb_build_array(jsonb_build_object('id', large, 'name', 'Large', 'price_cents', 60000), jsonb_build_object('name', 'Medium', 'price_cents', 45000)),
    null);
  assert (select count(*) from public.product_option_value_exclusions where value_id = velvet) = 1, 'a removed variation''s exclusion stayed';
  assert (select variation_id from public.product_option_value_exclusions where value_id = velvet) = large, 'the wrong exclusion went';

  -- An exclusion for a variation of another product is refused.
  declare
    other uuid;
    other_var uuid;
  begin
    other := public.save_product(org_a, null,
      jsonb_build_object('kind', 'product', 'name', 'Other', 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size'),
      '[{"name": "A", "price_cents": 1}, {"name": "B", "price_cents": 2}]'::jsonb, null);
    select id into other_var from public.product_variations where product_id = other limit 1;
    begin
      insert into public.product_option_value_exclusions (organisation_id, value_id, variation_id) values (org_a, velvet, other_var);
      raise exception 'FAIL: an exclusion for another product''s variation was accepted';
    exception when check_violation then null;
    end;
  end;

  reset role;

  -- Another business sees none of it and cannot remove it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  perform public.ensure_organisation('B Co');
  assert (select count(*) from public.product_option_value_exclusions where value_id = velvet) = 0, 'another business can see exclusions';
  delete from public.product_option_value_exclusions where value_id = velvet;
  get diagnostics n = row_count;
  assert n = 0, 'another business removed exclusions';
  reset role;

  raise notice 'option values not offered tests passed';
end
$$;

rollback;
