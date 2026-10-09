-- Product lists ("choose one" options, shown with the variations): save_product keeps, adds and removes
-- them and their values in one go (keeping ids); the rules; limits; isolation; quote items keep their own
-- copy. (Extras have their own test: extras.test.sql.)
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

create function pg_temp.product(name text) returns jsonb language sql as $f$
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 30000, 'unit', '', 'variation_label', '')
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000021a1';
  b uuid := '00000000-0000-4000-8000-0000000021b1';
  org_a uuid;
  org_b uuid;
  cake uuid;
  flavour uuid;
  vanilla uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'oa21@example.test'), (b, 'ob21@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product(org_a, null, pg_temp.product('Cake'), '[]'::jsonb, '[
    {"name": "Flavour", "kind": "one", "required": true, "charge": "item",
     "values": [{"name": "Vanilla", "price_cents": 0, "usual": true}, {"name": "Red velvet", "price_cents": 5000}]},
    {"name": "Filling", "kind": "one", "required": true,
     "values": [{"name": "Jam", "price_cents": 0}, {"name": "Cream", "price_cents": 300}]}
  ]'::jsonb);
  assert (select count(*) from public.product_option_groups where product_id = cake) = 2, 'lists were not added';
  assert (select array_agg(name order by sort_order) from public.product_option_groups where product_id = cake) = array['Flavour', 'Filling'],
    'the order was not kept';
  select id into flavour from public.product_option_groups where product_id = cake and name = 'Flavour';
  select id into vanilla from public.product_option_values where group_id = flavour and name = 'Vanilla';
  assert (select usual from public.product_option_values where id = vanilla), 'the usual value was not marked';
  -- Every option's amount is added to each item (20261024100000_simpler_options).
  assert (select bool_and(charge = 'item') from public.product_option_groups where product_id = cake), 'an option was not charged per item';

  -- Changing: keep Flavour (renamed) and Vanilla (same ids), drop Red velvet, add Chocolate; drop Filling.
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, jsonb_build_array(
    jsonb_build_object('id', flavour, 'name', 'Sponge', 'kind', 'one', 'required', true, 'charge', 'item',
      'values', jsonb_build_array(
        jsonb_build_object('name', 'Chocolate', 'price_cents', 2000, 'usual', true),
        jsonb_build_object('id', vanilla, 'name', 'Vanilla bean', 'price_cents', 0)))));
  assert (select name from public.product_option_groups where id = flavour) = 'Sponge', 'a kept option lost its id';
  assert (select name from public.product_option_values where id = vanilla) = 'Vanilla bean', 'a kept value lost its id';
  assert not exists (select 1 from public.product_option_groups where product_id = cake and name = 'Filling'), 'a removed list is still there';
  assert (select array_agg(name order by sort_order) from public.product_option_values where group_id = flavour) = array['Chocolate', 'Vanilla bean'],
    'values were not replaced in order';
  assert (select name from public.product_option_values where group_id = flavour and usual) = 'Chocolate', 'the usual value did not move';

  -- No list leaves the options alone.
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null);
  assert (select count(*) from public.product_option_groups where product_id = cake) = 1, 'a missing list removed options';

  -- Rules of each kind.
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Box", "kind": "one", "required": true, "charge": "line", "values": [{"name": "A", "price_cents": 1}]}]'::jsonb);
    raise exception 'FAIL: an option charged once for the line was accepted';
  exception when check_violation then null;
  end;
  -- "Choose any" and "type something" became extras (20261025100000_extras): lists are only "choose one".
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Extras", "kind": "any", "values": [{"name": "A", "price_cents": 1}]}]'::jsonb);
    raise exception 'FAIL: a "choose any" option was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Message", "kind": "text", "values": []}]'::jsonb);
    raise exception 'FAIL: a "type something" option was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Flavour", "kind": "one", "required": false, "values": [{"name": "A", "price_cents": 0}]}]'::jsonb);
    raise exception 'FAIL: a "choose one" that needs no choice was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Flavour", "kind": "one", "required": true, "values": []}]'::jsonb);
    raise exception 'FAIL: a choice without values was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Flavour", "kind": "one", "required": true, "values": [{"name": "A", "price_cents": 1}], "text_price_cents": 5}]'::jsonb);
    raise exception 'FAIL: a text price on a choice was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Flavour", "kind": "one", "required": true, "values": [{"name": "A", "price_cents": -1}]}]'::jsonb);
    raise exception 'FAIL: a negative amount was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null,
      '[{"name": "Flavour", "kind": "one", "required": true, "values": [{"name": "A", "price_cents": 1, "usual": true}, {"name": "B", "price_cents": 1, "usual": true}]}]'::jsonb);
    raise exception 'FAIL: two usual values were accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null,
      (select jsonb_agg(jsonb_build_object('name', 'O' || i, 'kind', 'one', 'required', true, 'values', '[{"name": "A", "price_cents": 0}]'::jsonb)) from generate_series(1, 21) i));
    raise exception 'FAIL: 21 options were accepted';
  exception when program_limit_exceeded then null;
  end;

  -- Quote items keep their own copy; the list must be a list.
  q := public.save_quote_draft(org_a, null,
    jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23', 'country_code', 'ZA', 'currency_code', 'ZAR'),
    jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'product', 'product_id', cake, 'name', 'Cake',
      'quantity_milli', 1000, 'unit_price_cents', 30000,
      'options', jsonb_build_array(jsonb_build_object('group_id', flavour, 'group', 'Sponge', 'kind', 'one', 'charge', 'item',
        'value_id', vanilla, 'value', 'Vanilla bean', 'amount_cents', 0)))));
  assert (select options -> 0 ->> 'value' from public.quote_lines where quote_id = q) = 'Vanilla bean', 'the item did not keep its options';
  begin
    perform public.save_quote_draft(org_a, q, jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23'),
      jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Thing', 'quantity_milli', 1000,
        'unit_price_cents', 1, 'options', '{"not": "a list"}'::jsonb)));
    raise exception 'FAIL: options that are not a list were accepted';
  exception when check_violation then null;
  end;
  -- Removing the option from the product leaves the item's copy.
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[]'::jsonb);
  assert (select options -> 0 ->> 'value' from public.quote_lines where quote_id = q) = 'Vanilla bean', 'the item lost its copy';
  assert (select count(*) from public.product_option_values where group_id = flavour) = 0, 'values of a removed option remain';
  reset role;

  -- Another business sees and changes nothing.
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, '[{"name": "Flavour", "kind": "one", "required": true, "values": [{"name": "A", "price_cents": 1}]}]'::jsonb);
  select id into flavour from public.product_option_groups where product_id = cake;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.product_option_groups where product_id = cake) = 0, 'another business can see options';
  assert (select count(*) from public.product_option_values where group_id = flavour) = 0, 'another business can see values';
  update public.product_option_values set price_cents = 1 where group_id = flavour;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed a value';
  begin
    perform public.save_product(org_b, cake, pg_temp.product('Hijack'), null, '[]'::jsonb);
    raise exception 'FAIL: another business changed a product';
  exception when no_data_found then null;
  end;
  reset role;

  raise notice 'product options tests passed';
end
$$;

rollback;
