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
  j3 uuid;
  j4 uuid;
  img_a uuid := gen_random_uuid();
  items jsonb := jsonb_build_array(
    jsonb_build_object('kind', 'custom', 'name', 'Oak shelf', 'description', '120 cm, oiled', 'quantityMilli', 2000, 'unit', null),
    jsonb_build_object('kind', 'custom', 'name', 'Brackets', 'quantityMilli', 4000, 'unit', 'pair'));
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
      items || jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', '  ', 'quantityMilli', 1000)));
    raise exception 'FAIL: an item with no name was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null,
      jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 0)));
    raise exception 'FAIL: a zero quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null,
      jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 1.5)));
    raise exception 'FAIL: a fractional milli quantity was accepted';
  exception when sqlstate '22023' then null;
  end;
  -- Numbers that are not whole thousandths, too big, or not numbers; names that are not text; too many items
  declare bad jsonb; many jsonb := (select jsonb_agg(jsonb_build_object('kind', 'custom', 'name', 'X' || g, 'quantityMilli', 1000)) from generate_series(1, 51) g);
  begin
    foreach bad in array array[
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', -5),
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 1.0),
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 10000000000),
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', '1000'),
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', null),
      jsonb_build_object('kind', 'custom', 'name', null, 'quantityMilli', 1000),
      jsonb_build_object('kind', 'custom', 'name', 7, 'quantityMilli', 1000),
      jsonb_build_object('kind', 'custom', 'name', repeat('x', 301), 'quantityMilli', 1000),
      jsonb_build_object('kind', 'custom', 'name', 'X', 'quantityMilli', 1000, 'unit', repeat('u', 21)),
      jsonb_build_object('kind', 'pigeon', 'name', 'X', 'quantityMilli', 1000),
      jsonb_build_object('name', 'X', 'quantityMilli', 1000),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'variationLabel', 'Size'),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'variationName', 'Large'),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'options', jsonb_build_object('a', 1)),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'options', jsonb_build_array(jsonb_build_object('group', 'Flavour', 'kind', 'pigeon', 'value', 'V'))),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'options', jsonb_build_array(jsonb_build_object('group', '', 'kind', 'one', 'value', 'V'))),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'options', jsonb_build_array(jsonb_build_object('group', 'G', 'kind', 'any', 'value', 'V', 'quantityMilli', 0))),
      jsonb_build_object('kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'photoImageId', 'not-an-id'),
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
      perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_object('kind', 'custom', 'name', 'X'));
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
  -- A picture of another business is refused by the database, and nothing is left behind
  begin
    perform public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(jsonb_build_object(
      'kind', 'product', 'name', 'X', 'quantityMilli', 1000, 'photoImageId', gen_random_uuid())));
    raise exception 'FAIL: a picture that is not this business''s was accepted';
  exception when foreign_key_violation then null;
  end;
  reset role;
  assert (select count(*) from public.jobs where organisation_id = org_a) = 0, 'a refused job left something behind';

  ----------------------------------------------------------------------
  -- Making jobs
  ----------------------------------------------------------------------
  set local role service_role;
  j1 := public.create_job(org_a, a, cust_a, 'delivery', '12 Long Street', date '2026-11-20', '  Match the desk  ', items);
  j2 := public.create_job(org_a, a, cust_a, 'collection', null, null, null, items);
  -- An item like a quote's: a product with its variation and choices (only the known fields are kept)
  j3 := public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(jsonb_build_object(
    'kind', 'product', 'name', 'Wedding cake', 'description', '3 tiers', 'quantityMilli', 1000, 'unit', null,
    'variationLabel', 'Size', 'variationName', 'Large', 'photoImageId', null, 'sneaky', 'dropped',
    'options', jsonb_build_array(
      jsonb_build_object('group', 'Flavour', 'kind', 'one', 'value', 'Vanilla', 'text', null, 'quantityMilli', null, 'amountCents', 999),
      jsonb_build_object('group', 'Message on the cake', 'kind', 'text', 'value', null, 'text', 'Happy 40th'),
      jsonb_build_object('group', 'Extras', 'kind', 'any', 'value', 'Sprinkles', 'quantityMilli', 2000)))));
  reset role;

  assert (select kind = 'product' and variation_label = 'Size' and variation_name = 'Large' and photo_image_id is null and description = '3 tiers'
          from public.job_items where job_id = j3), 'the product item is wrong';
  assert (select jsonb_array_length(options) = 3
              and options -> 0 = '{"group": "Flavour", "kind": "one", "value": "Vanilla", "text": null, "quantityMilli": null}'::jsonb
              and options -> 1 ->> 'text' = 'Happy 40th'
              and (options -> 2 ->> 'quantityMilli')::int = 2000
              and not (options -> 0 ? 'amountCents')
          from public.job_items where job_id = j3), 'the choices were not kept as given, or kept more than they should';
  assert (select not (to_jsonb(i) ? 'sneaky') from public.job_items i where job_id = j3), 'an unknown field was kept';

  -- A picture of this business is kept
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img_a, org_a, 'product', 'image/jpeg', 10, 10, 100, 50);
  set local role service_role;
  j4 := public.create_job(org_a, a, cust_a, 'none', null, null, null, jsonb_build_array(jsonb_build_object(
    'kind', 'product', 'name', 'Tray', 'quantityMilli', 1000, 'photoImageId', img_a)));
  reset role;
  assert (select photo_image_id = img_a from public.job_items where job_id = j4), 'the picture was not kept';

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
