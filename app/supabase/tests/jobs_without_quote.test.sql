-- Jobs without a quote (migration 20261029100000): create_job is server-only, checks everything before writing,
-- copies the customer, shares the numbering with jobs made from quotes, and a job with no quote can move along
-- its statuses (including being restored) with nothing to check. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000029a1';
  b uuid := '00000000-0000-4000-8000-0000000029b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  cust_old uuid;
  j1 uuid;
  j2 uuid;
  items jsonb := jsonb_build_array(
    jsonb_build_object('name', 'Oak shelf', 'description', '120 cm, oiled', 'quantityMilli', 2000, 'unit', null),
    jsonb_build_object('name', 'Brackets', 'quantityMilli', 4000, 'unit', 'pair'));
begin
  insert into auth.users (id, email) values (a, 'ja29@example.test'), (b, 'jb29@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name, kind, contact_person, phone, email)
    values (org_a, 'Thandi Nkosi', 'business', 'Thandi', '082 555 0101', 'thandi@example.test') returning id into cust_a;
  insert into public.customers (organisation_id, name) values (org_a, 'Old Customer') returning id into cust_old;
  reset role;
  update public.customers set archived_at = now() where id = cust_old;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.customers (organisation_id, name) values (org_b, 'Other Business Customer') returning id into cust_b;
  reset role;

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, items);
    raise exception 'FAIL: a signed-in user called create_job';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, items);
    raise exception 'FAIL: anon called create_job';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Refusals write nothing
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.create_job(org_a, a, cust_b, 'none', null, null, null, items);
    raise exception 'FAIL: a job was made for another business''s customer';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_old, 'none', null, null, null, items);
    raise exception 'FAIL: a job was made for an archived customer';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, '[]'::jsonb);
    raise exception 'FAIL: a job with no items was made';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null,
      items || jsonb_build_array(jsonb_build_object('name', '  ', 'quantityMilli', 1000)));
    raise exception 'FAIL: an item with no name was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null,
      jsonb_build_array(jsonb_build_object('name', 'X', 'quantityMilli', 0)));
    raise exception 'FAIL: a zero quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null,
      jsonb_build_array(jsonb_build_object('name', 'X', 'quantityMilli', 1.5)));
    raise exception 'FAIL: a fractional milli quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  -- Numbers that are not whole thousandths, too big, or not numbers; names that are not text; too many items
  declare bad jsonb; many jsonb := (select jsonb_agg(jsonb_build_object('name', 'X' || g, 'quantityMilli', 1000)) from generate_series(1, 51) g);
  begin
    foreach bad in array array[
      jsonb_build_object('name', 'X', 'quantityMilli', -5),
      jsonb_build_object('name', 'X', 'quantityMilli', 1.0),
      jsonb_build_object('name', 'X', 'quantityMilli', 10000000000),
      jsonb_build_object('name', 'X', 'quantityMilli', '1000'),
      jsonb_build_object('name', 'X', 'quantityMilli', null),
      jsonb_build_object('name', null, 'quantityMilli', 1000),
      jsonb_build_object('name', 7, 'quantityMilli', 1000),
      jsonb_build_object('name', repeat('x', 301), 'quantityMilli', 1000),
      jsonb_build_object('name', 'X', 'quantityMilli', 1000, 'unit', repeat('u', 21)),
      to_jsonb('just text'::text)
    ] loop
      begin
        perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(bad));
        raise exception 'FAIL: a bad item was accepted: %', bad;
      exception when sqlstate '22023' then null;
      end;
    end loop;
    begin
      perform public.create_job(org_a, a, cust_a, 'none', null, null, null, many);
      raise exception 'FAIL: 51 items were accepted';
    exception when sqlstate '22023' then null;
    end;
    begin
      perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_object('name', 'X'));
      raise exception 'FAIL: items that are not a list were accepted';
    exception when sqlstate '22023' then null;
    end;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', '1 Long Street', null, null, items);
    raise exception 'FAIL: an address without a delivery was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'pigeon', null, null, null, items);
    raise exception 'FAIL: an unknown fulfilment was accepted';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  assert (select count(*) from public.jobs where organisation_id = org_a) = 0, 'a refused job left something behind';

  ----------------------------------------------------------------------
  -- Making jobs
  ----------------------------------------------------------------------
  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'delivery', '12 Long Street', date '2026-11-20', '  Match the desk  ', items);
  j2 := public.create_job(org_a, a, cust_a, 'collection', null, null, null, items);
  reset role;

  assert (select quote_id is null and quote_version is null and number = 1 and status = 'not_started' and fulfilment = 'delivery'
          and delivery_address = '12 Long Street' and needed_by = date '2026-11-20' and note = 'Match the desk'
          and customer_name = 'Thandi Nkosi' and customer_contact_person = 'Thandi' and customer_phone = '082 555 0101'
          and customer_email = 'thandi@example.test' and customer_id = cust_a and created_by = a
          from public.jobs where id = j1), 'the job is wrong';
  assert (select number from public.jobs where id = j2) = 2, 'numbers do not count up';
  assert (select count(*) from public.job_items where job_id = j1) = 2, 'the items were not copied';
  assert (select name = 'Oak shelf' and description = '120 cm, oiled' and quantity_milli = 2000 and unit is null and kind = 'custom'
          from public.job_items where job_id = j1 and sort_order = 0), 'the first item is wrong';
  assert (select name = 'Brackets' and unit = 'pair' and description is null from public.job_items where job_id = j1 and sort_order = 1), 'the second item is wrong';
  assert (select count(*) from public.job_events where job_id = j1 and kind = 'created' and to_status = 'not_started' and actor_id = a) = 1, 'creation was not logged';

  -- The copy does not follow the customer
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.customers set name = 'Renamed', phone = '000' where id = cust_a;
  reset role;
  assert (select customer_name = 'Thandi Nkosi' and customer_phone = '082 555 0101' from public.jobs where id = j1), 'the job followed a customer edit';

  -- A quote and its version go together
  begin
    update public.jobs set quote_version = 1 where id = j1;
    raise exception 'FAIL: a version without a quote was allowed';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Statuses: moves and restore work without a quote
  ----------------------------------------------------------------------
  set local role service_role;
  perform public.move_job_status(org_a, j1, a, 'in_progress');
  perform public.move_job_status(org_a, j1, a, 'cancelled');
  perform public.move_job_status(org_a, j1, a, 'not_started');
  perform public.move_job_status(org_a, j1, a, 'in_progress');
  perform public.move_job_status(org_a, j1, a, 'ready');
  perform public.move_job_status(org_a, j1, a, 'out_for_delivery');
  perform public.move_job_status(org_a, j1, a, 'done');
  begin
    perform public.move_job_status(org_b, j1, b, 'ready');
    raise exception 'FAIL: another business moved the job';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  assert (select status from public.jobs where id = j1) = 'done', 'the job did not reach done';

  ----------------------------------------------------------------------
  -- Seen only by its own business; session required
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.jobs where id in (j1, j2)) = 0, 'another business can see the job';
  reset role;

  raise notice 'jobs without a quote tests passed';
end
$$;

rollback;
