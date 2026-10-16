-- Production steps (docs/plans/quantity-prices-and-steps.md, slices 2 and 3; migration 20261107100000): a product's
-- steps, saved with the product; a job item takes a frozen copy when it is made (from a quote, by hand, or added
-- later); a step's count moves the item's count and starts the job; members read but never write a job's steps.
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
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 10000, 'unit', '', 'variation_label', '')
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
  a uuid := '00000000-0000-4000-8000-0000000029a1';
  b uuid := '00000000-0000-4000-8000-0000000029b1';
  c uuid := '00000000-0000-4000-8000-0000000029c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  cake uuid;
  tea uuid;
  candle uuid;
  q uuid;
  jq uuid;
  j1 uuid;
  jb uuid;
  i_cake uuid;
  i_oneoff uuid;
  i_added uuid;
  i_quote uuid;
  s_bake uuid;
  s_ice uuid;
  s_box uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa29@example.test'), (b, 'sb29@example.test'), (c, 'sc29@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.customers (organisation_id, name) values (org_b, 'Other') returning id into cust_b;
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- A product is saved with its steps, in order; null leaves them; a list replaces them; [] clears them
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cake'), null, null, null, null,
    '[{"name": "Bake"}, {"name": " Ice "}, {"name": "Box"}]'::jsonb);
  tea := public.save_product_layers(org_a, null, pg_temp.product('Tea'), null, null, null, null, '[{"name": "Blend"}]'::jsonb);
  assert (select array_agg(name order by sort_order) from public.product_steps where product_id = cake) = array['Bake', 'Ice', 'Box'], 'steps were not saved in order, trimmed';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, null);
  assert (select count(*) from public.product_steps where product_id = cake) = 3, 'null should leave the steps alone';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, '[{"name": "Box"}, {"name": "Bake"}]'::jsonb);
  assert (select array_agg(name order by sort_order) from public.product_steps where product_id = cake) = array['Box', 'Bake'], 'a list should replace the steps, in its order';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, '[{"name": "Bake"}, {"name": "Ice"}, {"name": "Box"}]'::jsonb);

  -- Limits and shape; nothing else is saved when the list is refused.
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      (select jsonb_agg(jsonb_build_object('name', 'S' || i)) from generate_series(1, 31) i));
    raise exception 'thirty-one steps were accepted';
  exception when sqlstate '54000' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, '[{"name": "  "}]'::jsonb);
    raise exception 'a blank step was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null, '{"name": "x"}'::jsonb);
    raise exception 'something that is not a list was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, null,
      jsonb_build_array(jsonb_build_object('name', repeat('x', 121))));
    raise exception 'a step of 121 characters was accepted';
  exception when sqlstate '22023' then null;
  end;
  assert (select name from public.products where id = cake) = 'Cake', 'a refused list should not have renamed the product';
  assert (select count(*) from public.product_steps where product_id = cake) = 3, 'a refused list should have left the steps alone';
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees none, cannot save over the product, cannot point a step at it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.product_steps) = 0, 'another business can read steps';
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Mine'), null, null, null, null, '[]'::jsonb);
    raise exception 'another business saved over the product';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    insert into public.product_steps (organisation_id, product_id, name, sort_order) values (org_b, tea, 'Sneaky', 0);
    raise exception 'a step was pointed at another business''s product';
  exception when foreign_key_violation then null;
  end;
  candle := public.save_product_layers(org_b, null, pg_temp.product('Candle'), null, null, null, null, '[{"name": "Pour"}, {"name": "Cure"}]'::jsonb);
  reset role;

  ----------------------------------------------------------------------
  -- A job made by hand: each item takes a frozen copy of its product's steps; a one-off item has none
  ----------------------------------------------------------------------
  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 12000, 'productId', cake),
    jsonb_build_object('kind', 'custom', 'name', 'Oak shelf', 'quantityMilli', 2000)));
  reset role;
  select id into i_cake from public.job_items where job_id = j1 and sort_order = 0;
  select id into i_oneoff from public.job_items where job_id = j1 and sort_order = 1;
  assert (select product_id from public.job_items where id = i_cake) = cake, 'the item should keep its product';
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Ice', 'Box'], 'the item did not take its product''s steps';
  assert (select count(*) from public.job_item_steps where job_item_id = i_cake and done_milli = 0) = 3, 'new steps should start at none';
  assert (select count(*) from public.job_item_steps where job_item_id = i_oneoff) = 0, 'a one-off item should have no steps';

  -- The product changes; the job does not.
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, '[{"name": "Only this"}]'::jsonb);
  reset role;
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Ice', 'Box'], 'a product''s new steps changed a job';

  -- An item pointing at another business's product is refused, and nothing of the job is written.
  begin
    set local role service_role;
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Theirs', 'quantityMilli', 1000, 'productId', candle)));
    raise exception 'a job was made with another business''s product';
  exception when foreign_key_violation then reset role;
  end;
  begin
    set local role service_role;
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Odd', 'quantityMilli', 1000, 'productId', 'not-an-id')));
    raise exception 'a product id that is not an id was accepted';
  exception when sqlstate '22023' then reset role;
  end;
  assert (select count(*) from public.jobs where organisation_id = org_a) = 1, 'a refused job left something behind';

  ----------------------------------------------------------------------
  -- An item added later takes the product's steps as they are now
  ----------------------------------------------------------------------
  set local role service_role;
  i_added := public.add_job_item(org_a, j1, a, jsonb_build_object('kind', 'product', 'name', 'Tea', 'quantityMilli', 3000, 'productId', tea));
  reset role;
  assert (select array_agg(name) from public.job_item_steps where job_item_id = i_added) = array['Blend'], 'an added item did not take the steps';

  ----------------------------------------------------------------------
  -- A job made from a quote: the sent snapshot's lines carry the product; older ones carry none
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, '[{"name": "Bake"}, {"name": "Ice"}]'::jsonb);
  q := pg_temp.accepted_quote(org_a, cust_a, a, jsonb_build_object(
    'customer', jsonb_build_object('name', 'Thandi Nkosi'),
    'lines', jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 1000, 'productId', cake),
      jsonb_build_object('kind', 'product', 'name', 'Theirs', 'quantityMilli', 1000, 'productId', candle),
      jsonb_build_object('kind', 'custom', 'name', 'Shelf', 'quantityMilli', 1000))));
  set local role service_role;
  jq := public.create_job_from_quote(org_a, q, a);
  reset role;
  select id into i_quote from public.job_items where job_id = jq and sort_order = 0;
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_quote) = array['Bake', 'Ice'], 'a job from a quote did not take the steps';
  assert (select product_id is null from public.job_items where job_id = jq and sort_order = 1), 'another business''s product id in a snapshot should be ignored';
  assert (select count(*) from public.job_item_steps s join public.job_items i on i.id = s.job_item_id where i.job_id = jq and i.sort_order > 0) = 0, 'items without a product of this business should have no steps';

  ----------------------------------------------------------------------
  -- Counting a step: bounds, the item's count is the fewest step, the job starts, an item with steps takes no whole count
  ----------------------------------------------------------------------
  select id into s_bake from public.job_item_steps where job_item_id = i_cake and name = 'Bake';
  select id into s_ice from public.job_item_steps where job_item_id = i_cake and name = 'Ice';
  select id into s_box from public.job_item_steps where job_item_id = i_cake and name = 'Box';
  assert (select status from public.jobs where id = j1) = 'not_started', 'the job should not have started';
  set local role service_role;
  begin
    perform public.set_job_step_done(org_a, s_bake, 12001, a);
    raise exception 'more than the quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_job_step_done(org_a, s_bake, -1, a);
    raise exception 'a negative count was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_job_step_done(org_b, s_bake, 1000, b);
    raise exception 'another business counted our step';
  exception when sqlstate 'P0002' then null;
  end;
  assert (select status from public.jobs where id = j1) = 'not_started', 'a refused count started the job';

  perform public.set_job_step_done(org_a, s_bake, 12000, a);
  reset role;
  assert (select status from public.jobs where id = j1) = 'in_progress', 'the first progress should start the job';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'status' and to_status = 'in_progress') = 1, 'starting the job should be logged once';
  assert (select made_milli from public.job_items where id = i_cake) = 0, 'the item''s count is the fewest step, so none yet';
  set local role service_role;
  perform public.set_job_step_done(org_a, s_ice, 5000, a);
  perform public.set_job_step_done(org_a, s_box, 8000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 5000, 'the item''s count should be the fewest step';
  set local role service_role;
  perform public.set_job_step_done(org_a, s_ice, 12000, a);
  perform public.set_job_step_done(org_a, s_box, 12000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 12000, 'every step done should make the whole item';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'status') = 1, 'later counts should not log another start';
  set local role service_role;
  perform public.set_job_step_done(org_a, s_box, 3000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 3000, 'taking a count back should lower the item''s count';

  begin
    set local role service_role;
    perform public.set_job_item_made(org_a, j1, i_cake, 1000, a);
    raise exception 'a whole count was accepted on an item with steps';
  exception when sqlstate '55000' then reset role;
  end;
  set local role service_role;
  perform public.set_job_item_made(org_a, j1, i_oneoff, 1000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_oneoff) = 1000, 'an item without steps should still take a whole count';

  -- A job that is Ready takes no step counts.
  set local role service_role;
  perform public.set_job_step_done(org_a, s_box, 12000, a);
  perform public.move_job_status(org_a, j1, a, 'ready');
  begin
    perform public.set_job_step_done(org_a, s_box, 1000, a);
    raise exception 'a ready job took a step count';
  exception when sqlstate '55006' then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Members read a job's steps and write none; neither can they call the server-only function
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  assert (select count(*) from public.job_item_steps where job_item_id = i_cake) = 3, 'staff could not read the steps';
  begin
    update public.job_item_steps set done_milli = 1 where job_item_id = i_cake;
    raise exception 'a member changed a step''s count';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name) values (org_a, i_cake, 9, 'Sneaky');
    raise exception 'a member added a step to a job';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.job_item_steps where job_item_id = i_cake;
    raise exception 'a member deleted a job''s steps';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_job_step_done(org_a, s_bake, 1000, c);
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Another business reads none of it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.job_item_steps) = 0, 'another business can read a job''s steps';
  reset role;

  -- No session: nothing.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.job_item_steps;
  assert n = 0, 'job steps were readable without a session';
  select count(*) into n from public.product_steps;
  assert n = 0, 'product steps were readable without a session';
  reset role;
  raise notice 'production steps tests passed';
end
$$;

rollback;
