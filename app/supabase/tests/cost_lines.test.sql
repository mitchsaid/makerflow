-- What a product costs to make (docs/plans/costing-and-margin.md, slice A; migration 20261112100000): cost lines
-- (material, time, other) with the same conditions as steps, a batch size ("makes"), and the hourly rate on the business
-- profile. Plain SQL, one transaction, rolled back.

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
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size')
$f$;


do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000031a1';
  b uuid := '00000000-0000-4000-8000-0000000031b1';
  c uuid := '00000000-0000-4000-8000-0000000031c1';
  org_a uuid;
  org_b uuid;
  flour uuid;
  box_b uuid;
  cake uuid;
  other uuid;
  large uuid;
  wrap uuid;
  line uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa31@example.test'), (b, 'sb31@example.test'), (c, 'sc31@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Flour', 'kg', 1000, 2500) returning id into flour;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_b, 'Boxes', 'each', 1000, 5000) returning id into box_b;
  reset role;

  ----------------------------------------------------------------------
  -- The hourly rate lives on the business profile
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.business_profiles set labour_rate_cents = 15000 where organisation_id = org_a;
  assert (select labour_rate_cents from public.business_profiles where organisation_id = org_a) = 15000, 'the rate was not saved';
  begin
    update public.business_profiles set labour_rate_cents = -1 where organisation_id = org_a;
    raise exception 'a negative rate was accepted';
  exception when check_violation then null;
  end;
  update public.business_profiles set labour_rate_cents = null where organisation_id = org_a;
  reset role;

  ----------------------------------------------------------------------
  -- Saving a product with cost lines, conditions pointing at choices by position
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cake'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb,
    null,
    '[{"name": "Gift wrap", "price_cents": 3000, "shared": true}]'::jsonb,
    null, null,
    jsonb_build_object('makes_milli', 12000, 'lines', jsonb_build_array(
      jsonb_build_object('kind', 'material', 'material_id', flour, 'amount_milli', 500, 'unit', 'kg'),
      jsonb_build_object('kind', 'time', 'minutes', 90),
      jsonb_build_object('kind', 'other', 'name', '  Box  ', 'cents', 1250, 'logic', 'any', 'conditions', jsonb_build_array(
        jsonb_build_object('kind', 'chosen', 'ref', jsonb_build_object('type', 'variation', 'index', 1)),
        jsonb_build_object('kind', 'chosen', 'ref', jsonb_build_object('type', 'extra', 'index', 0)),
        jsonb_build_object('kind', 'quantity', 'negate', true, 'quantityMilli', 12000))))));
  select id into large from public.product_variations where product_id = cake and name = 'Large';
  select id into wrap from public.extras where organisation_id = org_a and name = 'Gift wrap';

  assert (select makes_milli from public.products where id = cake) = 12000, 'the batch size was not saved';
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 3, 'the lines were not saved';
  assert (select array_agg(kind order by sort_order) from public.product_cost_lines where product_id = cake) = array['material', 'time', 'other'], 'lines lost their order';
  assert (select name from public.product_cost_lines where product_id = cake and kind = 'other') = 'Box', 'the name was not trimmed';
  assert (select condition_logic from public.product_cost_lines where product_id = cake and kind = 'other') = 'any', 'the logic was not saved';
  assert (select condition_logic from public.product_cost_lines where product_id = cake and kind = 'time') = 'all', 'logic should default to all';
  assert (select count(*) from public.product_cost_line_conditions) = 3, 'the conditions were not saved';
  assert (select c.variation_id from public.product_cost_line_conditions c where c.variation_id is not null) = large, 'a variation condition pointed at the wrong variation';
  assert (select c.extra_id from public.product_cost_line_conditions c where c.extra_id is not null) = wrap, 'an extra condition pointed at the wrong extra';
  assert (select negate from public.product_cost_line_conditions where kind = 'quantity_at_least'), 'the not was lost';

  -- null leaves lines and batch size alone; only the batch size leaves the lines; a list replaces them.
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null, null);
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 3, 'null should leave the lines alone';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null, '{"makes_milli": 1000}'::jsonb);
  assert (select makes_milli from public.products where id = cake) = 1000, 'the batch size was not changed';
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 3, 'a batch size alone changed the lines';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    '{"lines": [{"kind": "time", "minutes": 30}]}'::jsonb);
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 1, 'the lines were not replaced';
  assert (select count(*) from public.product_cost_line_conditions) = 0, 'old conditions stayed behind';
  assert (select makes_milli from public.products where id = cake) = 1000, 'lines alone changed the batch size';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null, '{"lines": []}'::jsonb);
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 0, 'an empty list should clear the lines';

  ----------------------------------------------------------------------
  -- What is refused, and nothing else saved with it
  ----------------------------------------------------------------------
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'time', 'minutes', 10))));
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "cheese", "minutes": 5}]}'::jsonb);
    raise exception 'an unknown kind was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "time", "minutes": 0}]}'::jsonb);
    raise exception 'no minutes was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "time", "minutes": "30"}]}'::jsonb);
    raise exception 'minutes as text were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "other", "name": "   ", "cents": 100}]}'::jsonb);
    raise exception 'a blank name was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "other", "name": "Box", "cents": -5}]}'::jsonb);
    raise exception 'a negative cost was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', flour, 'amount_milli', 500, 'unit', 'bushel'))));
    raise exception 'an unknown unit was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', 'nope', 'amount_milli', 500, 'unit', 'kg'))));
    raise exception 'a material that is not an id was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "time", "minutes": 5, "logic": "some"}]}'::jsonb);
    raise exception 'an unknown logic was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "time", "minutes": 5, "conditions": [{"kind": "chosen", "ref": {"type": "variation", "index": 9}}]}]}'::jsonb);
    raise exception 'a line pointing at a variation that is not there was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"lines": [{"kind": "time", "minutes": 5, "conditions": [{"kind": "quantity", "quantityMilli": 0}]}]}'::jsonb);
    raise exception 'a quantity of nothing was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null, '{"makes_milli": 0}'::jsonb);
    raise exception 'a batch of nothing was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null, '[1]'::jsonb);
    raise exception 'costs that are not an object were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('lines', (select jsonb_agg(jsonb_build_object('kind', 'time', 'minutes', 1)) from generate_series(1, 41))));
    raise exception '41 lines were accepted';
  exception when sqlstate '54000' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'time', 'minutes', 1, 'conditions',
        (select jsonb_agg(jsonb_build_object('kind', 'quantity', 'quantityMilli', i)) from generate_series(1, 11) i)))));
    raise exception 'eleven conditions were accepted';
  exception when sqlstate '54000' then null;
  end;
  -- Another business's material cannot be used.
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', box_b, 'amount_milli', 1000, 'unit', 'each'))));
    raise exception 'another business''s material was used';
  exception when foreign_key_violation then null;
  end;
  assert (select name from public.products where id = cake) = 'Cake', 'a refused list renamed the product';
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 1, 'a refused list changed the lines';
  assert (select minutes from public.product_cost_lines where product_id = cake) = 10, 'a refused list changed a line';
  reset role;

  ----------------------------------------------------------------------
  -- The shape of a row, and a material in use
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.product_cost_lines (organisation_id, product_id, kind, minutes, cents) values (org_a, cake, 'time', 5, 100);
    raise exception 'a time line with an amount was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_cost_lines (organisation_id, product_id, kind, material_id, amount_milli) values (org_a, cake, 'material', flour, 100);
    raise exception 'a material line with no unit was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_cost_lines (organisation_id, product_id, kind) values (org_a, cake, 'other');
    raise exception 'an empty line was accepted';
  exception when check_violation then null;
  end;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', flour, 'amount_milli', 500, 'unit', 'kg'))));
  -- Materials are archived, never deleted (staff have no delete); even the owner of the database cannot drop one in use.
  begin
    delete from public.materials where id = flour;
    raise exception 'staff deleted a material';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    delete from public.materials where id = flour;
    raise exception 'a material in use was deleted';
  exception when foreign_key_violation then null;
  end;
  set local role authenticated;
  reset role;

  ----------------------------------------------------------------------
  -- Another business reads and writes none of it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    '{"makes_milli": 3000, "lines": [{"kind": "time", "minutes": 30}]}'::jsonb);
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.product_cost_lines) = 0, 'another business can read cost lines';
  assert (select count(*) from public.product_cost_line_conditions) = 0, 'another business can read conditions';
  begin
    perform public.save_product_costs(org_b, cake, '{"lines": []}'::jsonb);
    raise exception 'a product of another business was costed';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.save_product_costs(org_a, cake, '{"lines": []}'::jsonb);
    raise exception 'another business''s product was costed under its own name';
  exception when sqlstate 'P0002' then null;
  end;
  other := public.save_product_layers(org_b, null, pg_temp.product('Other'), null, null, null, null, null, '{"lines": [{"kind": "time", "minutes": 5}]}'::jsonb);
  delete from public.product_cost_lines where product_id = cake;
  get diagnostics n = row_count;
  assert n = 0, 'another business deleted cost lines';
  update public.business_profiles set labour_rate_cents = 1 where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed the rate';
  reset role;
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 1, 'a line went missing';

  -- No session: nothing, and no writing.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.product_cost_lines;
  assert n = 0, 'cost lines were readable without a session';
  begin
    perform public.save_product_costs(org_a, cake, '{"lines": []}'::jsonb);
    raise exception 'costs were saved without a session';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  assert (select count(*) from public.product_cost_lines where product_id = cake) = 1, 'a line was lost without a session';
  raise notice 'cost lines tests passed';
end
$$;

rollback;
