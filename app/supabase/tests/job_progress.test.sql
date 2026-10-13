-- Jobs slice 2 (migration 20261031100000): counting what is made, adding an item to a job, and the shared item rules.
-- Both new functions are server-only, check before writing, lock the job, and log what they change. Plain SQL, one
-- transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000031a1';
  b uuid := '00000000-0000-4000-8000-0000000031b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  j1 uuid;
  jb uuid;
  i1 uuid;
  i2 uuid;
  ib uuid;
  new_item uuid;
  img_b uuid := gen_random_uuid();
  items jsonb := jsonb_build_array(
    jsonb_build_object('kind', 'custom', 'name', 'Oak shelf', 'quantityMilli', 5000),
    jsonb_build_object('kind', 'custom', 'name', 'Brackets', 'quantityMilli', 2500, 'unit', 'm'));
  extra jsonb := jsonb_build_object(
    'kind', 'product', 'name', 'Wedding cake', 'description', '3 tiers', 'quantityMilli', 1000,
    'variationLabel', 'Size', 'variationName', 'Large', 'sneaky', 'dropped',
    'options', jsonb_build_array(jsonb_build_object('group', 'Flavour', 'kind', 'one', 'value', 'Vanilla', 'amountCents', 999)));
begin
  insert into auth.users (id, email) values (a, 'ja31@example.test'), (b, 'jb31@example.test');
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
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img_b, org_b, 'product', 'image/jpeg', 10, 10, 100, 50);

  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'delivery', '12 Long Street', null, null, items);
  jb := public.create_job(org_b, b, cust_b, 'none', null, null, null, items);
  reset role;
  select id into i1 from public.job_items where job_id = j1 and sort_order = 0;
  select id into i2 from public.job_items where job_id = j1 and sort_order = 1;
  select id into ib from public.job_items where job_id = jb and sort_order = 0;
  assert (select made_milli = 0 and added_later = false from public.job_items where id = i1), 'a new item starts with none made';

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.set_job_item_made(org_a, j1, i1, 1000, a);
    raise exception 'FAIL: a signed-in user called set_job_item_made';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: a signed-in user called add_job_item';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.job_item_clean(extra);
    raise exception 'FAIL: a signed-in user called job_item_clean';
  exception when insufficient_privilege then null;
  end;
  -- ...and cannot write the count or the items by hand either
  begin
    update public.job_items set made_milli = 5000 where id = i1;
    raise exception 'FAIL: a member wrote an item directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.set_job_item_made(org_a, j1, i1, 1000, a);
    raise exception 'FAIL: anon called set_job_item_made';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: anon called add_job_item';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Counting what is made
  ----------------------------------------------------------------------
  set local role service_role;
  -- Refusals write nothing
  begin
    perform public.set_job_item_made(org_b, j1, i1, 1000, b);
    raise exception 'FAIL: another business counted on the job';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.set_job_item_made(org_a, j1, ib, 1000, a);
    raise exception 'FAIL: an item of another job was counted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.set_job_item_made(org_a, j1, gen_random_uuid(), 1000, a);
    raise exception 'FAIL: an unknown item was counted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.set_job_item_made(org_a, j1, i1, 5001, a);
    raise exception 'FAIL: more than the quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_job_item_made(org_a, j1, i1, -1, a);
    raise exception 'FAIL: a negative count was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_job_item_made(org_a, j1, i1, null, a);
    raise exception 'FAIL: an empty count was accepted';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  assert (select made_milli = 0 from public.job_items where id = i1), 'a refused count left something behind';
  assert (select status = 'not_started' from public.jobs where id = j1), 'a refused count started the job';

  -- Counting zero on a job that has not started does not start it
  set local role service_role;
  perform public.set_job_item_made(org_a, j1, i1, 0, a);
  reset role;
  assert (select status = 'not_started' from public.jobs where id = j1), 'a zero count started the job';

  -- The first unit made starts the job, and says so in the log
  set local role service_role;
  assert public.set_job_item_made(org_a, j1, i1, 2000, a) = 2000, 'the count was not returned';
  reset role;
  assert (select made_milli = 2000 from public.job_items where id = i1), 'the count was not kept';
  assert (select status = 'in_progress' from public.jobs where id = j1), 'the first unit did not start the job';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'status' and from_status = 'not_started'
            and to_status = 'in_progress' and actor_id = a) = 1, 'the start was not logged';

  -- More counts change the item, not the log; a fractional quantity can be made to the end; counts can go back down
  set local role service_role;
  perform public.set_job_item_made(org_a, j1, i1, 5000, a);
  perform public.set_job_item_made(org_a, j1, i2, 2500, a);
  perform public.set_job_item_made(org_a, j1, i1, 4000, a);
  reset role;
  assert (select made_milli = 4000 from public.job_items where id = i1), 'a count could not go down';
  assert (select made_milli = 2500 from public.job_items where id = i2), 'the whole of a fractional quantity was refused';
  assert (select count(*) from public.job_events where job_id = j1) = 2, 'counting wrote log lines beyond the start';

  -- The database itself keeps a count within the quantity
  begin
    update public.job_items set made_milli = 5001 where id = i1;
    raise exception 'FAIL: the table allowed more made than ordered';
  exception when check_violation then null;
  end;

  -- Jobs that are Ready or later take no counts
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'ready');
  begin
    perform public.set_job_item_made(org_a, j1, i1, 1000, a);
    raise exception 'FAIL: a ready job took a count';
  exception when sqlstate '55006' then null;
  end;
  perform public.move_job_status(org_a, j1, a, 'cancelled');
  begin
    perform public.set_job_item_made(org_a, j1, i1, 1000, a);
    raise exception 'FAIL: a cancelled job took a count';
  exception when sqlstate '55006' then null;
  end;
  reset role;
  assert (select made_milli = 4000 from public.job_items where id = i1), 'a refused count changed the item';

  ----------------------------------------------------------------------
  -- Adding an item
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: a cancelled job took a new item';
  exception when sqlstate '55006' then null;
  end;
  perform public.move_job_status(org_a, j1, a, 'not_started');
  perform public.move_job_status(org_a, j1, a, 'in_progress');
  perform public.move_job_status(org_a, j1, a, 'ready');
  reset role;
  assert (select count(*) from public.job_items where job_id = j1) = 2, 'a refused item left something behind';

  set local role service_role;
  -- Refusals
  begin
    perform public.add_job_item(org_b, j1, b, extra);
    raise exception 'FAIL: another business added an item';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, jsonb_build_object('kind', 'custom', 'name', '  ', 'quantityMilli', 1000));
    raise exception 'FAIL: an item with no name was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 0));
    raise exception 'FAIL: a zero quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, to_jsonb('just text'::text));
    raise exception 'FAIL: an item that is not an object was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.add_job_item(org_a, j1, a, jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'photoImageId', img_b));
    raise exception 'FAIL: a picture of another business was accepted';
  exception when foreign_key_violation then null;
  end;
  reset role;
  assert (select count(*) from public.job_items where job_id = j1) = 2, 'a refused item left something behind';
  assert (select status = 'ready' from public.jobs where id = j1), 'a refused item moved the job';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'item_added') = 0, 'a refused item was logged';

  -- A ready job takes an item and goes back to making
  set local role service_role;
  new_item := public.add_job_item(org_a, j1, a, extra);
  reset role;
  assert (select name = 'Wedding cake' and description = '3 tiers' and quantity_milli = 1000 and kind = 'product'
            and variation_label = 'Size' and variation_name = 'Large' and made_milli = 0 and added_later = true and sort_order = 2
          from public.job_items where id = new_item), 'the added item is wrong';
  assert (select options -> 0 = '{"group": "Flavour", "kind": "one", "value": "Vanilla", "text": null, "quantityMilli": null}'::jsonb
          from public.job_items where id = new_item), 'the choices were not rebuilt from the known fields';
  assert (select not added_later from public.job_items where id = i1), 'an original item says it was added later';
  assert (select status = 'in_progress' from public.jobs where id = j1), 'a ready job did not go back to making';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'item_added' and detail = 'Wedding cake'
            and to_status = 'ready' and from_status is null and actor_id = a) = 1, 'the item was not logged';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'status' and from_status = 'ready'
            and to_status = 'in_progress' and actor_id = a) = 1, 'going back to making was not logged';

  -- The new item can be counted like the others, and the earlier counts are untouched
  set local role service_role;
  perform public.set_job_item_made(org_a, j1, new_item, 1000, a);
  reset role;
  assert (select made_milli = 1000 from public.job_items where id = new_item), 'the added item could not be counted';
  assert (select made_milli = 4000 from public.job_items where id = i1), 'adding an item changed another item''s count';

  -- A Not started job takes one and stays Not started; Out for delivery, Done and Cancelled do not
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'ready');
  perform public.move_job_status(org_a, j1, a, 'out_for_delivery');
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: a job out for delivery took a new item';
  exception when sqlstate '55006' then null;
  end;
  perform public.move_job_status(org_a, j1, a, 'done');
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: a done job took a new item';
  exception when sqlstate '55006' then null;
  end;
  reset role;

  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'none', null, null, null, items);
  perform public.add_job_item(org_a, j1, a, extra);
  reset role;
  assert (select status = 'not_started' from public.jobs where id = j1), 'adding an item started the job';
  assert (select count(*) from public.job_items where job_id = j1) = 3, 'the item was not added';

  -- At most 50 items; the 51st is refused and nothing is left behind
  set local role service_role;
  for n in 4..50 loop
    perform public.add_job_item(org_a, j1, a, jsonb_build_object('kind', 'custom', 'name', 'Item ' || n, 'quantityMilli', 1000));
  end loop;
  begin
    perform public.add_job_item(org_a, j1, a, extra);
    raise exception 'FAIL: a 51st item was accepted';
  exception when sqlstate '54000' then null;
  end;
  reset role;
  assert (select count(*) from public.job_items where job_id = j1) = 50, 'the job does not have exactly 50 items';
  assert (select max(sort_order) from public.job_items where job_id = j1) = 49, 'items are not in order';

  ----------------------------------------------------------------------
  -- Nobody else sees any of it; the log keeps its shape
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.job_items where job_id = j1) = 0, 'another business can see the items';
  reset role;
  begin
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status)
      values (org_a, j1, 'item_added', null, 'not_started');
    raise exception 'FAIL: an item_added event with no item name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, detail)
      values (org_a, j1, 'status', null, 'done', 'X');
    raise exception 'FAIL: a status event with no from-status was accepted';
  exception when check_violation then null;
  end;

  raise notice 'job progress tests passed';
end
$$;

rollback;
