-- Jobs (migration 20261127100000): moving a job to Ready, Out for delivery or Done makes every item and step complete.
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
  a uuid := '00000000-0000-4000-8000-0000000041a1';
  org_a uuid;
  cust_a uuid;
  j1 uuid;
  i1 uuid;
  i2 uuid;
  s1 uuid;
  s2 uuid;
begin
  insert into auth.users (id, email) values (a, 'jm41@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  reset role;

  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'delivery', '12 Long Street', null, null, jsonb_build_array(
    jsonb_build_object('kind', 'custom', 'name', 'Oak shelf', 'quantityMilli', 5000),
    jsonb_build_object('kind', 'custom', 'name', 'Cupcakes', 'quantityMilli', 12000)));
  reset role;
  select id into i1 from public.job_items where job_id = j1 and sort_order = 0;
  select id into i2 from public.job_items where job_id = j1 and sort_order = 1;
  -- The second item is counted step by step: Bake is done for 5 of 12, Ice for 2.
  insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name, done_milli) values (org_a, i2, 0, 'Bake', 5000) returning id into s1;
  insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name, done_milli) values (org_a, i2, 1, 'Ice', 2000) returning id into s2;
  update public.job_items set made_milli = 2000 where id = i2;
  update public.job_items set made_milli = 1000 where id = i1;

  -- Making: nothing is changed.
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'in_progress');
  reset role;
  assert (select made_milli = 1000 from public.job_items where id = i1), 'making changed a count';
  assert (select done_milli = 5000 from public.job_item_steps where id = s1), 'making changed a step';

  -- Ready: every item is made and every step done, in full.
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'ready');
  reset role;
  assert (select made_milli = quantity_milli from public.job_items where id = i1), 'ready left an item part made';
  assert (select made_milli = quantity_milli from public.job_items where id = i2), 'ready left a stepped item part made';
  assert (select count(*) from public.job_item_steps where job_item_id = i2 and done_milli = 12000) = 2, 'ready left a step part done';

  -- Going back leaves the counts as they are (nothing is lowered); out for delivery and done complete them too.
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'in_progress');
  reset role;
  assert (select made_milli = quantity_milli from public.job_items where id = i1), 'going back lowered a count';
  update public.job_items set made_milli = 3000 where id = i1;
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'out_for_delivery');
  reset role;
  assert (select made_milli = quantity_milli from public.job_items where id = i1), 'out for delivery left an item part made';
  update public.job_items set made_milli = 4000 where id = i1;
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'done');
  reset role;
  assert (select made_milli = quantity_milli from public.job_items where id = i1), 'done left an item part made';

  -- The move is still logged.
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'status' and to_status = 'done') = 1, 'the move to done was not logged';

  raise notice 'job ready-means-made tests passed';
end
$$;

rollback;
