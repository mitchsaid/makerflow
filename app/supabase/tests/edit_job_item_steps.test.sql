-- Adding, removing and resetting the steps of one job item (migration 20261111100000): service-role-only functions,
-- the count follows the steps, a one-off item has none, a job that is Ready takes no changes, other businesses and
-- members are shut out. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000033a1';
  b uuid := '00000000-0000-4000-8000-0000000033b1';
  c uuid := '00000000-0000-4000-8000-0000000033c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cake uuid;
  tea uuid;
  j uuid;
  i_cake uuid;
  i_tea uuid;
  i_oneoff uuid;
  s_new uuid;
  s_bake uuid;
  s_ice uuid;
  s_box uuid;
  s_pack uuid;
  names text[];
begin
  insert into auth.users (id, email) values (a, 'sa33@example.test'), (b, 'sb33@example.test'), (c, 'sc33@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cake'), null, null, null, null,
    '[{"name": "Bake"}, {"name": "Ice"}, {"name": "Box"}]'::jsonb);
  tea := public.save_product_layers(org_a, null, pg_temp.product('Tea'), null, null, null, null, '[]'::jsonb);
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  set local role service_role;
  j := public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(
    jsonb_build_object('kind', 'product', 'name', 'Cake', 'quantityMilli', 12000, 'productId', cake),
    jsonb_build_object('kind', 'product', 'name', 'Tea', 'quantityMilli', 10000, 'productId', tea),
    jsonb_build_object('kind', 'custom', 'name', 'Shelf', 'quantityMilli', 1000)));
  reset role;
  select id into i_cake from public.job_items where job_id = j and sort_order = 0;
  select id into i_tea from public.job_items where job_id = j and sort_order = 1;
  select id into i_oneoff from public.job_items where job_id = j and sort_order = 2;
  select id into s_bake from public.job_item_steps where job_item_id = i_cake and name = 'Bake';
  select id into s_ice from public.job_item_steps where job_item_id = i_cake and name = 'Ice';
  select id into s_box from public.job_item_steps where job_item_id = i_cake and name = 'Box';
  assert not (select steps_edited from public.job_items where id = i_cake), 'a new item should not count as edited';

  ----------------------------------------------------------------------
  -- Adding: last, trimmed, at none; the item's count follows the fewest step
  ----------------------------------------------------------------------
  set local role service_role;
  perform public.set_job_step_done(org_a, s_bake, 12000, a);
  perform public.set_job_step_done(org_a, s_ice, 12000, a);
  perform public.set_job_step_done(org_a, s_box, 12000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 12000, 'the item should be made';
  set local role service_role;
  s_new := public.add_job_item_step(org_a, i_cake, '  Attach name tags ', a);
  reset role;
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Ice', 'Box', 'Attach name tags'], 'the new step did not go last, trimmed';
  assert (select done_milli from public.job_item_steps where id = s_new) = 0, 'a new step should start at none';
  assert (select made_milli from public.job_items where id = i_cake) = 0, 'a new step at none should lower the item''s count';
  assert (select steps_edited from public.job_items where id = i_cake), 'the item should be marked as edited';
  set local role service_role;
  perform public.set_job_step_done(org_a, s_new, 12000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 12000, 'every step done should make the item again';

  -- The first step on an item counted as a whole keeps what was made; the next one starts at none.
  set local role service_role;
  perform public.set_job_item_made(org_a, j, i_tea, 5000, a);
  s_pack := public.add_job_item_step(org_a, i_tea, 'Pack', a);
  reset role;
  assert (select done_milli from public.job_item_steps where id = s_pack) = 5000, 'the first step should take what was made';
  assert (select made_milli from public.job_items where id = i_tea) = 5000, 'the count was lost when the first step was added';
  set local role service_role;
  perform public.add_job_item_step(org_a, i_tea, 'Label', a);
  reset role;
  assert (select made_milli from public.job_items where id = i_tea) = 0, 'a second step at none should lower the count';

  ----------------------------------------------------------------------
  -- Removing: the count follows the steps left; the last one leaves the count as it was
  ----------------------------------------------------------------------
  set local role service_role;
  perform public.set_job_step_done(org_a, s_ice, 3000, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 3000, 'the fewest step should be Ice';
  set local role service_role;
  perform public.remove_job_item_step(org_a, s_ice, a);
  reset role;
  assert (select made_milli from public.job_items where id = i_cake) = 12000, 'taking off the slowest step should raise the count';
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Box', 'Attach name tags'], 'the wrong step was removed';
  set local role service_role;
  perform public.remove_job_item_step(org_a, s_bake, a);
  perform public.remove_job_item_step(org_a, s_box, a);
  perform public.remove_job_item_step(org_a, s_new, a);
  reset role;
  assert not exists (select 1 from public.job_item_steps where job_item_id = i_cake), 'steps were left behind';
  assert (select made_milli from public.job_items where id = i_cake) = 12000, 'removing the last step should leave the count as it was';

  ----------------------------------------------------------------------
  -- Reset: the product's steps as they are now, each at none
  ----------------------------------------------------------------------
  set local role service_role;
  perform public.reset_job_item_steps(org_a, i_cake, a);
  reset role;
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Ice', 'Box'], 'reset did not bring back the product''s steps';
  assert (select count(*) from public.job_item_steps where job_item_id = i_cake and done_milli = 0) = 3, 'reset steps should start at none';
  assert (select made_milli from public.job_items where id = i_cake) = 0, 'reset steps at none make nothing';
  assert not (select steps_edited from public.job_items where id = i_cake), 'a reset item should no longer be marked as edited';
  -- The product changes first: reset takes its steps as they are now.
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cake'), null, null, null, null, '[{"name": "Bake"}, {"name": "Decorate"}]'::jsonb);
  reset role;
  set local role service_role;
  perform public.add_job_item_step(org_a, i_cake, 'Extra', a);
  perform public.reset_job_item_steps(org_a, i_cake, a);
  reset role;
  assert (select array_agg(name order by sort_order) from public.job_item_steps where job_item_id = i_cake) = array['Bake', 'Decorate'], 'reset should take the product''s steps as they are now';
  -- A product with no steps: reset leaves the item counted as a whole.
  set local role service_role;
  perform public.reset_job_item_steps(org_a, i_tea, a);
  reset role;
  assert not exists (select 1 from public.job_item_steps where job_item_id = i_tea), 'a product with no steps should leave none';

  ----------------------------------------------------------------------
  -- What is refused
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.add_job_item_step(org_a, i_oneoff, 'Sand', a);
    raise exception 'a step was added to a one-off item';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.reset_job_item_steps(org_a, i_oneoff, a);
    raise exception 'a one-off item was reset';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item_step(org_a, i_cake, '   ', a);
    raise exception 'a blank step was added';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item_step(org_a, i_cake, repeat('x', 121), a);
    raise exception 'a step of 121 characters was added';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item_step(org_a, i_cake, null, a);
    raise exception 'a step with no name was added';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item_step(org_b, i_cake, 'Mine', b);
    raise exception 'another business added a step';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.remove_job_item_step(org_b, (select id from public.job_item_steps where job_item_id = i_cake limit 1), b);
    raise exception 'another business removed a step';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.reset_job_item_steps(org_b, i_cake, b);
    raise exception 'another business reset an item';
  exception when sqlstate 'P0002' then null;
  end;
  -- Up to 30 steps on an item.
  for n in 1..28 loop
    perform public.add_job_item_step(org_a, i_cake, 'Step ' || n, a);
  end loop;
  begin
    perform public.add_job_item_step(org_a, i_cake, 'One too many', a);
    raise exception 'a 31st step was added';
  exception when sqlstate '54000' then null;
  end;
  assert (select count(*) from public.job_item_steps where job_item_id = i_cake) = 30, 'an item should hold 30 steps';
  reset role;

  -- A job that is Ready (or later) takes no changes to its steps.
  set local role service_role;
  perform public.reset_job_item_steps(org_a, i_cake, a);
  perform public.set_job_step_done(org_a, (select id from public.job_item_steps where job_item_id = i_cake limit 1), 12000, a);
  update public.job_items set made_milli = quantity_milli where job_id = j;
  perform public.move_job_status(org_a, j, a, 'ready');
  begin
    perform public.add_job_item_step(org_a, i_cake, 'Late', a);
    raise exception 'a step was added to a ready job';
  exception when sqlstate '55006' then null;
  end;
  begin
    perform public.remove_job_item_step(org_a, (select id from public.job_item_steps where job_item_id = i_cake limit 1), a);
    raise exception 'a step was removed from a ready job';
  exception when sqlstate '55006' then null;
  end;
  begin
    perform public.reset_job_item_steps(org_a, i_cake, a);
    raise exception 'an item of a ready job was reset';
  exception when sqlstate '55006' then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Members cannot call any of it, or write a job's steps directly
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  begin
    perform public.add_job_item_step(org_a, i_cake, 'Sneaky', c);
    raise exception 'a member added a step through the function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.remove_job_item_step(org_a, s_box, c);
    raise exception 'a member removed a step through the function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reset_job_item_steps(org_a, i_cake, c);
    raise exception 'a member reset an item through the function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.copy_product_steps_to_item(i_cake);
    raise exception 'a member called the internal copy';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.job_items set steps_edited = true where id = i_cake;
    raise exception 'a member changed an item directly';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.job_item_steps where job_item_id = i_cake) = 2, 'staff could not read the steps';
  reset role;
  raise notice 'edit job item steps tests passed';
end
$$;

rollback;
