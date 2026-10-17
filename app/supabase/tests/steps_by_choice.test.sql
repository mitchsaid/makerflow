-- Steps that depend on a choice (docs/plans/quantity-prices-and-steps.md, slice 4; migration 20261108100000): a step
-- can carry conditions (a variation, an option value, an extra, or a quantity), taken together with "all" or "any" and
-- each turned round with "not"; a job item copies only the steps that apply to it. Plain SQL, one transaction,
-- rolled back.

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

create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.accepted_quote(org uuid, cust uuid, actor uuid, snap jsonb) returns uuid language plpgsql as $f$
declare
  q uuid;
  stamp timestamptz;
  num text;
begin
  set local role authenticated;
  q := public.save_quote_draft(org, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Cake', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  reset role;
  select updated_at, number into stamp, num from public.quotes where id = q;
  set local role service_role;
  perform public.send_quote(org, q, actor, 'marked', stamp, snap || jsonb_build_object('number', num, 'version', 1), 100000, 15000, 115000);
  perform public.record_quote_outcome(org, q, actor, 'accepted', date '2026-10-05', 'phone', null);
  reset role;
  return q;
end
$f$;


do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000030a1';
  b uuid := '00000000-0000-4000-8000-0000000030b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cake uuid;
  other uuid;
  small uuid;
  large uuid;
  flavour uuid;
  red uuid;
  vanilla uuid;
  wrap uuid;
  engraving uuid;
  s_all uuid;
  j uuid;
  jq uuid;
  q uuid;
  it uuid;
  n integer;
  names text[];
begin
  insert into auth.users (id, email) values (a, 'sa30@example.test'), (b, 'sb30@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  ----------------------------------------------------------------------
  -- A cake with sizes, a flavour list and two extras; its steps point at them by position
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cake'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb,
    '[{"name": "Flavour", "kind": "one", "required": true, "values": [{"name": "Vanilla", "price_cents": 0}, {"name": "Red velvet", "price_cents": 5000}]}]'::jsonb,
    '[{"name": "Gift wrap", "price_cents": 3000, "shared": true}, {"name": "Engraving", "price_cents": 5000, "asks_for_wording": true, "text_max": 40, "shared": false}]'::jsonb,
    null,
    '[
      {"name": "Bake"},
      {"name": "Add a second tier", "conditions": [{"kind": "chosen", "ref": {"type": "variation", "index": 1}}]},
      {"name": "Red food colouring", "conditions": [{"kind": "chosen", "ref": {"type": "option_value", "group": 0, "index": 1}}]},
      {"name": "Wrap", "conditions": [{"kind": "chosen", "ref": {"type": "extra", "index": 0}}]},
      {"name": "Engrave", "conditions": [{"kind": "chosen", "ref": {"type": "extra", "index": 1}}]},
      {"name": "Big-order check", "conditions": [{"kind": "quantity", "quantityMilli": 12000}]},
      {"name": "Show piece", "logic": "any", "conditions": [
         {"kind": "chosen", "ref": {"type": "variation", "index": 1}},
         {"kind": "chosen", "ref": {"type": "extra", "index": 1}}]},
      {"name": "Plain and small", "logic": "all", "conditions": [
         {"kind": "chosen", "negate": true, "ref": {"type": "variation", "index": 1}},
         {"kind": "chosen", "negate": true, "ref": {"type": "extra", "index": 0}}]},
      {"name": "Not many", "conditions": [{"kind": "quantity", "negate": true, "quantityMilli": 12000}]}
    ]'::jsonb);
  select id into small from public.product_variations where product_id = cake and name = 'Small';
  select id into large from public.product_variations where product_id = cake and name = 'Large';
  select g.id into flavour from public.product_option_groups g where g.product_id = cake;
  select id into red from public.product_option_values where group_id = flavour and name = 'Red velvet';
  select id into vanilla from public.product_option_values where group_id = flavour and name = 'Vanilla';
  select id into wrap from public.extras where organisation_id = org_a and name = 'Gift wrap';
  select id into engraving from public.extras where organisation_id = org_a and name = 'Engraving';

  assert (select count(*) from public.product_steps where product_id = cake) = 9, 'the steps were not saved';
  assert (select condition_logic from public.product_steps where product_id = cake and name = 'Show piece') = 'any', 'the logic was not saved';
  assert (select condition_logic from public.product_steps where product_id = cake and name = 'Bake') = 'all', 'logic should default to all';
  assert (select count(*) from public.product_step_conditions) = 10, 'the conditions were not saved';
  assert (select c.variation_id from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Add a second tier') = large, 'a variation condition pointed at the wrong variation';
  assert (select c.option_value_id from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Red food colouring') = red, 'a value condition pointed at the wrong value';
  assert (select c.extra_id from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Wrap') = wrap, 'an extra condition pointed at the wrong extra';
  assert (select c.extra_id from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Engrave') = engraving, 'a product-only extra condition pointed at the wrong extra';
  assert (select quantity_milli from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Big-order check') = 12000, 'the quantity was lost';
  assert (select array_agg(c.sort_order order by c.sort_order) from public.product_step_conditions c join public.product_steps s on s.id = c.step_id where s.name = 'Show piece') = array[0, 1], 'conditions lost their order';

  -- Saving again replaces them (and the old conditions go with the old steps).
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null,
    '[{"name": "Bake"}, {"name": "Tier", "conditions": [{"kind": "chosen", "ref": {"type": "variation", "index": 1}}]}]'::jsonb);
  assert (select count(*) from public.product_step_conditions) = 1, 'old conditions stayed behind';
  -- null leaves steps and conditions alone.
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null);
  assert (select count(*) from public.product_step_conditions) = 1, 'null should leave the conditions alone';

  ----------------------------------------------------------------------
  -- What is refused, and nothing else saved with it
  ----------------------------------------------------------------------
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": [{"kind": "chosen", "ref": {"type": "variation", "index": 5}}]}]'::jsonb);
    raise exception 'a step pointing at a variation that is not there was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": [{"kind": "chosen", "ref": {"type": "option_value", "group": 0, "index": 9}}]}]'::jsonb);
    raise exception 'a step pointing at a value that is not there was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": [{"kind": "chosen", "ref": {"type": "extra", "index": 7}}]}]'::jsonb);
    raise exception 'a step pointing at an extra that is not there was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "logic": "some"}]'::jsonb);
    raise exception 'an unknown logic was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": [{"kind": "quantity", "quantityMilli": 0}]}]'::jsonb);
    raise exception 'a quantity of nothing was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": [{"kind": "mood", "ref": {"type": "variation", "index": 0}}]}]'::jsonb);
    raise exception 'an unknown kind of condition was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      '[{"name": "x", "conditions": "all of them"}]'::jsonb);
    raise exception 'conditions that are not a list were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      jsonb_build_array(jsonb_build_object('name', 'x', 'conditions',
        (select jsonb_agg(jsonb_build_object('kind', 'quantity', 'quantityMilli', i)) from generate_series(1, 11) i))));
    raise exception 'eleven conditions were accepted';
  exception when sqlstate '54000' then null;
  end;
  assert (select name from public.products where id = cake) = 'Cake', 'a refused list renamed the product';
  assert (select count(*) from public.product_steps where product_id = cake) = 2, 'a refused list changed the steps';
  reset role;

  -- A condition cannot point at another business's choice, however it is written.
  perform pg_temp.as_user(b);
  set local role authenticated;
  other := public.save_product_layers(org_b, null, pg_temp.product('Other'), '[{"name": "Big", "price_cents": 1}, {"name": "Bigger", "price_cents": 2}]'::jsonb, null, null, null, '[{"name": "Own"}]'::jsonb);
  begin
    insert into public.product_step_conditions (organisation_id, step_id, kind, variation_id)
    select org_b, id, 'chosen', large from public.product_steps where product_id = other;
    raise exception 'a condition was pointed at another business''s variation';
  exception when foreign_key_violation then null;
  end;
  assert (select count(*) from public.product_step_conditions) = 0, 'another business can read conditions';
  reset role;

  -- The shape of a row: a choice names exactly one thing, a quantity none.
  perform pg_temp.as_user(a);
  set local role authenticated;
  select id into s_all from public.product_steps where product_id = cake and name = 'Bake';
  begin
    insert into public.product_step_conditions (organisation_id, step_id, kind) values (org_a, s_all, 'chosen');
    raise exception 'a choice that names nothing was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_step_conditions (organisation_id, step_id, kind, variation_id, extra_id) values (org_a, s_all, 'chosen', large, wrap);
    raise exception 'a choice that names two things was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_step_conditions (organisation_id, step_id, kind, quantity_milli, variation_id) values (org_a, s_all, 'quantity_at_least', 1000, large);
    raise exception 'a quantity that names a choice was accepted';
  exception when check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- A job takes only the steps that apply to the item
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'),
    jsonb_build_array(jsonb_build_object('id', small, 'name', 'Small', 'price_cents', 30000), jsonb_build_object('id', large, 'name', 'Large', 'price_cents', 60000)),
    jsonb_build_array(jsonb_build_object('id', flavour, 'name', 'Flavour', 'kind', 'one', 'required', true, 'values', jsonb_build_array(
      jsonb_build_object('id', vanilla, 'name', 'Vanilla', 'price_cents', 0), jsonb_build_object('id', red, 'name', 'Red velvet', 'price_cents', 5000)))),
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3000, 'shared', true, 'changed', false),
                      jsonb_build_object('id', engraving, 'name', 'Engraving', 'price_cents', 5000, 'asks_for_wording', true, 'text_max', 40, 'shared', false)),
    null,
    '[
      {"name": "Bake"},
      {"name": "Add a second tier", "conditions": [{"kind": "chosen", "ref": {"type": "variation", "index": 1}}]},
      {"name": "Red food colouring", "conditions": [{"kind": "chosen", "ref": {"type": "option_value", "group": 0, "index": 1}}]},
      {"name": "Wrap", "conditions": [{"kind": "chosen", "ref": {"type": "extra", "index": 0}}]},
      {"name": "Engrave", "conditions": [{"kind": "chosen", "ref": {"type": "extra", "index": 1}}]},
      {"name": "Big-order check", "conditions": [{"kind": "quantity", "quantityMilli": 12000}]},
      {"name": "Show piece", "logic": "any", "conditions": [
         {"kind": "chosen", "ref": {"type": "variation", "index": 1}},
         {"kind": "chosen", "ref": {"type": "extra", "index": 1}}]},
      {"name": "Plain and small", "logic": "all", "conditions": [
         {"kind": "chosen", "negate": true, "ref": {"type": "variation", "index": 1}},
         {"kind": "chosen", "negate": true, "ref": {"type": "extra", "index": 0}}]},
      {"name": "Not many", "conditions": [{"kind": "quantity", "negate": true, "quantityMilli": 12000}]}
    ]'::jsonb);
  reset role;
  assert (select count(*) from public.product_variations where product_id = cake and id in (small, large)) = 2, 'variations lost their ids';

  set local role service_role;
  j := public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
    -- 0: small, vanilla, nothing extra, 6
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 6000, 'productId', cake, 'chosenIds', jsonb_build_array(small, vanilla)),
    -- 1: large, red velvet, wrap, 6
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 6000, 'productId', cake, 'chosenIds', jsonb_build_array(large, red, wrap)),
    -- 2: small, engraving, 12 (upper-case ids are fine)
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 12000, 'productId', cake, 'chosenIds', jsonb_build_array(small, upper(engraving::text))),
    -- 3: nothing recorded (as from a version sent before choices were kept), 1
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake)));
  reset role;

  select array_agg(s.name order by s.sort_order) into names from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = j and i.sort_order = 0;
  assert names = array['Bake', 'Plain and small', 'Not many'], 'small/vanilla took the wrong steps: ' || names::text;
  select array_agg(s.name order by s.sort_order) into names from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = j and i.sort_order = 1;
  assert names = array['Bake', 'Add a second tier', 'Red food colouring', 'Wrap', 'Show piece', 'Not many'], 'large/red/wrap took the wrong steps: ' || names::text;
  select array_agg(s.name order by s.sort_order) into names from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = j and i.sort_order = 2;
  assert names = array['Bake', 'Engrave', 'Big-order check', 'Show piece', 'Plain and small'], 'small/engraving/12 took the wrong steps: ' || names::text;
  select array_agg(s.name order by s.sort_order) into names from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = j and i.sort_order = 3;
  assert names = array['Bake', 'Plain and small', 'Not many'], 'an item with no recorded choices took the wrong steps: ' || names::text;
  assert (select chosen_ids from public.job_items where job_id = j and sort_order = 2) = array[small, engraving], 'chosen ids were not kept, lower-cased';
  -- Steps keep their order numbers from the product (a gap is fine).
  assert (select s.sort_order from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = j and i.sort_order = 0 and s.name = 'Not many') = 8, 'steps lost their place';

  -- A step added later to an item takes only what applies, with the choices that item has.
  set local role service_role;
  it := public.add_job_item(org_a, j, a, jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 2000, 'productId', cake, 'chosenIds', jsonb_build_array(large)));
  reset role;
  select array_agg(name order by sort_order) into names from public.job_item_steps where job_item_id = it;
  assert names = array['Bake', 'Add a second tier', 'Show piece', 'Not many'], 'an added item took the wrong steps: ' || names::text;

  -- Bad choice lists are refused before anything is written.
  begin
    set local role service_role;
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake, 'chosenIds', jsonb_build_array('nope'))));
    raise exception 'a choice that is not an id was accepted';
  exception when sqlstate '22023' then reset role;
  end;
  begin
    set local role service_role;
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake, 'chosenIds', '"large"'::jsonb)));
    raise exception 'choices that are not a list were accepted';
  exception when sqlstate '22023' then reset role;
  end;
  begin
    set local role service_role;
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake,
        'chosenIds', (select jsonb_agg(gen_random_uuid()) from generate_series(1, 101)))));
    raise exception '101 choices were accepted';
  exception when sqlstate '22023' then reset role;
  end;
  assert (select count(*) from public.jobs where organisation_id = org_a) = 1, 'a refused job left something behind';

  ----------------------------------------------------------------------
  -- A job from a quote: the sent snapshot's lines carry the choices; older ones carry none; junk is dropped
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  q := pg_temp.accepted_quote(org_a, cust_a, a, jsonb_build_object(
    'customer', jsonb_build_object('name', 'Thandi Nkosi'),
    'lines', jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake, 'chosenIds', jsonb_build_array(large, wrap, 'junk', 7, jsonb_build_object('a', 1))),
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake, 'chosenIds', 'large'),
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake))));
  set local role service_role;
  jq := public.create_job_from_quote(org_a, q, a);
  reset role;
  assert (select chosen_ids from public.job_items where job_id = jq and sort_order = 0) = array[large, wrap], 'a quote''s choices were not kept, or junk was';
  select array_agg(s.name order by s.sort_order) into names from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = jq and i.sort_order = 0;
  assert names = array['Bake', 'Add a second tier', 'Wrap', 'Show piece', 'Not many'], 'a job from a quote took the wrong steps: ' || names::text;
  assert (select chosen_ids from public.job_items where job_id = jq and sort_order = 1) = '{}', 'choices that are not a list should be dropped';
  assert (select chosen_ids from public.job_items where job_id = jq and sort_order = 2) = '{}', 'a line with no choices should have none';

  ----------------------------------------------------------------------
  -- A choice that is removed takes its conditions with it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  delete from public.product_variations where id = large;
  assert not exists (select 1 from public.product_step_conditions where variation_id = large), 'a removed variation''s conditions stayed';
  reset role;

  ----------------------------------------------------------------------
  -- Staff of another business read and write none of it; no session: nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.product_step_conditions) = 0, 'another business can read conditions';
  begin
    perform public.product_step_applies(s_all, '{}', 1000);
    raise exception 'a member called the internal function';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.product_step_conditions;
  assert n = 0, 'conditions were readable without a session';
  reset role;
  raise notice 'steps by choice tests passed';
end
$$;

rollback;
