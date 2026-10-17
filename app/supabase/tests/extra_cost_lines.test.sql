-- An extra's own cost lines (docs/plans/costing-and-margin.md, slice B2; migration 20261114100000): what goes into one of
-- the extra, saved with the product through save_product_costs ("extras": [{"index", "lines"}]), by the extra's place
-- among the product's extras. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000033a1';
  b uuid := '00000000-0000-4000-8000-0000000033b1';
  org_a uuid;
  org_b uuid;
  box uuid;
  box_b uuid;
  cake uuid;
  pie uuid;
  wrap uuid;
  engraving uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa33@example.test'), (b, 'sb33@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Gift box', 'each', 10000, 5000) returning id into box;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_b, 'Boxes', 'each', 1000, 5000) returning id into box_b;
  reset role;

  ----------------------------------------------------------------------
  -- A cake with two extras; the first (shared) uses a box and some time, the second (this product only) costs an amount
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cake'), null, null,
    '[{"name": "Gift wrap", "price_cents": 3000, "shared": true}, {"name": "Engraving", "price_cents": 5000, "asks_for_wording": true, "text_max": 40, "shared": false}]'::jsonb,
    null, null,
    jsonb_build_object('extras', jsonb_build_array(
      jsonb_build_object('index', 0, 'lines', jsonb_build_array(
        jsonb_build_object('kind', 'material', 'material_id', box, 'amount_milli', 1000, 'unit', 'each'),
        jsonb_build_object('kind', 'time', 'minutes', 5))),
      jsonb_build_object('index', 1, 'lines', jsonb_build_array(jsonb_build_object('kind', 'other', 'name', '  Plate  ', 'cents', 1500))))));
  select id into wrap from public.extras where organisation_id = org_a and name = 'Gift wrap';
  select id into engraving from public.extras where organisation_id = org_a and name = 'Engraving';
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 2, 'the wrap lines were not saved';
  assert (select array_agg(kind order by sort_order) from public.extra_cost_lines where extra_id = wrap) = array['material', 'time'], 'lines lost their order';
  assert (select name from public.extra_cost_lines where extra_id = engraving) = 'Plate', 'the name was not trimmed';

  -- Only the extras named are touched; null and a payload with no extras leave all of it.
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null, '{"makes_milli": 2000}'::jsonb);
  assert (select count(*) from public.extra_cost_lines) = 3, 'a save with no extras changed their costs';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    '{"extras": [{"index": 1, "lines": []}]}'::jsonb);
  assert (select count(*) from public.extra_cost_lines where extra_id = engraving) = 0, 'the lines were not cleared';
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 2, 'an extra not named changed';

  ----------------------------------------------------------------------
  -- A shared extra has its costs once, on every product that has it
  ----------------------------------------------------------------------
  pie := public.save_product_layers(org_a, null, pg_temp.product('Pie'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3000, 'shared', true, 'changed', false)));
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 2, 'a second product changed the shared extra''s costs';
  perform public.save_product_layers(org_a, pie, pg_temp.product('Pie'), null, null, null, null, null,
    '{"extras": [{"index": 0, "lines": [{"kind": "time", "minutes": 10}]}]}'::jsonb);
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 1, 'the shared extra''s costs were not replaced';
  assert (select minutes from public.extra_cost_lines where extra_id = wrap) = 10, 'the shared extra has the wrong cost';

  ----------------------------------------------------------------------
  -- What is refused, and nothing else saved with it
  ----------------------------------------------------------------------
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"extras": [{"index": 5, "lines": [{"kind": "time", "minutes": 1}]}]}'::jsonb);
    raise exception 'costs for an extra the product does not have were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"extras": [{"index": 0, "lines": [{"kind": "cheese"}]}]}'::jsonb);
    raise exception 'an unknown kind was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"extras": [{"index": 0, "lines": [{"kind": "other", "name": "x", "cents": -1}]}]}'::jsonb);
    raise exception 'a negative cost was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      '{"extras": "all of them"}'::jsonb);
    raise exception 'extras that are not a list were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('extras', jsonb_build_array(jsonb_build_object('index', 0, 'lines',
        (select jsonb_agg(jsonb_build_object('kind', 'time', 'minutes', 1)) from generate_series(1, 21))))));
    raise exception '21 lines were accepted';
  exception when sqlstate '54000' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, null,
      jsonb_build_object('extras', jsonb_build_array(jsonb_build_object('index', 0, 'lines',
        jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', box_b, 'amount_milli', 1000, 'unit', 'each'))))));
    raise exception 'another business''s material was used';
  exception when foreign_key_violation then null;
  end;
  assert (select name from public.products where id = cake) = 'Cake', 'a refused list renamed the product';
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 1, 'a refused list changed the lines';

  -- Rows by hand: the shape is checked.
  begin
    insert into public.extra_cost_lines (organisation_id, extra_id, kind, minutes, cents) values (org_a, wrap, 'time', 5, 100);
    raise exception 'a time line with an amount was accepted';
  exception when check_violation then null;
  end;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null,
    jsonb_build_object('extras', jsonb_build_array(jsonb_build_object('index', 0, 'lines',
      jsonb_build_array(jsonb_build_object('kind', 'material', 'material_id', box, 'amount_milli', 1000, 'unit', 'each'))))));
  begin
    delete from public.materials where id = box;
    raise exception 'staff deleted a material';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    delete from public.materials where id = box;
    raise exception 'a material in use by an extra was deleted';
  exception when foreign_key_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Another business reads and writes none of it; no session: nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.extra_cost_lines) = 0, 'another business can read extra costs';
  begin
    perform public.save_product_costs(org_b, cake, '{"extras": []}'::jsonb);
    raise exception 'a product of another business was costed';
  exception when sqlstate 'P0002' then null;
  end;
  delete from public.extra_cost_lines;
  get diagnostics n = row_count;
  assert n = 0, 'another business deleted extra costs';
  reset role;
  assert (select count(*) from public.extra_cost_lines where extra_id = wrap) = 1, 'a line went missing';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.extra_cost_lines;
  assert n = 0, 'extra costs were readable without a session';
  reset role;
  raise notice 'extra cost lines tests passed';
end
$$;

rollback;
