-- Deleting a job: any status can be deleted; only the server's own key can do it; its items and log go with it; another business's job is not found; the newest number is free again and the
-- quote can get a new job. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.line(i int, name text) returns jsonb language sql as $f$
  select jsonb_build_object('sort_order', i, 'kind', 'custom', 'name', name,
    'quantity_milli', 1000, 'unit_price_cents', 100000)
$f$;

-- An accepted quote whose sent version has this snapshot (made the way the server makes one).
create function pg_temp.accepted_quote(org uuid, cust uuid, actor uuid, snap jsonb) returns uuid language plpgsql as $f$
declare
  q uuid;
  stamp timestamptz;
  num text;
begin
  set local role authenticated;
  q := public.save_quote_draft(org, null, pg_temp.quote_json(cust), jsonb_build_array(pg_temp.line(0, 'Cake')));
  reset role;
  select updated_at, number into stamp, num from public.quotes where id = q;
  set local role service_role;
  perform public.send_quote(org, q, actor, 'marked', stamp, snap || jsonb_build_object('number', num, 'version', 1), 100000, 15000, 115000);
  perform public.record_quote_outcome(org, q, actor, 'accepted', date '2026-10-05', 'phone', null);
  reset role;
  return q;
end
$f$;

create function pg_temp.snapshot(delivery boolean) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer', jsonb_build_object('name', 'Thandi Nkosi', 'contactPerson', null, 'phone', '082 555 0101', 'email', 'thandi@example.test'),
    'neededBy', '2026-11-20',
    'deliveryAddress', case when delivery then '12 Long Street, Cape Town' else null end,
    'lines', jsonb_build_array(
      jsonb_build_object('kind', 'product', 'name', 'Wedding cake', 'description', '3 tiers', 'quantityMilli', 1000, 'unit', null,
        'variation', jsonb_build_object('label', 'Size', 'name', 'Large'),
        'options', jsonb_build_array(
          jsonb_build_object('group', 'Flavour', 'kind', 'one', 'value', 'Vanilla', 'text', null, 'amountCents', 0),
          jsonb_build_object('group', 'Message on the cake', 'kind', 'text', 'value', null, 'text', 'Happy 40th', 'amountCents', 500, 'quantityMilli', 1000))),
      jsonb_build_object('kind', 'custom', 'name', 'Cupcakes', 'quantityMilli', 12000, 'unit', 'dozen'),
      case when delivery then jsonb_build_object('kind', 'delivery', 'name', 'Delivery', 'quantityMilli', 1000)
           else jsonb_build_object('kind', 'collection', 'name', 'Collection', 'quantityMilli', 1000) end))
$f$;

-- A job cancelled the way it was before cancelling went: set directly, as the server-only function no longer moves to it.
create function pg_temp.legacy_cancel(j uuid) returns void language sql security definer as $f$
  update public.jobs set status = 'cancelled' where id = j
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000029a1';
  b uuid := '00000000-0000-4000-8000-0000000029b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  q1 uuid; q2 uuid; q3 uuid;
  j1 uuid; j2 uuid; j3 uuid; j4 uuid;
  n integer;
  st text;
begin
  insert into auth.users (id, email) values (a, 'dj29a@example.test'), (b, 'dj29b@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  q1 := pg_temp.accepted_quote(org_a, cust_a, a, pg_temp.snapshot(false));
  q2 := pg_temp.accepted_quote(org_a, cust_a, a, pg_temp.snapshot(false));
  q3 := pg_temp.accepted_quote(org_a, cust_a, a, pg_temp.snapshot(false));
  set local role service_role;
  j1 := public.create_job_from_quote(org_a, q1, a);
  j2 := public.create_job_from_quote(org_a, q2, a);
  j3 := public.create_job_from_quote(org_a, q3, a);
  reset role;
  assert (select count(*) from public.job_items where job_id = j3) > 0 and (select count(*) from public.job_events where job_id = j3) > 0, 'the test job has no items or log';

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.delete_job(org_a, j3);
    raise exception 'FAIL: a signed-in user called delete_job';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.jobs where id = j3;
    raise exception 'FAIL: a user deleted a job directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert (select count(*) from public.jobs where id = j3) = 1, 'the job went';

  ----------------------------------------------------------------------
  -- Which jobs can go
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.delete_job(org_b, j3);
    raise exception 'FAIL: another business deleted this job';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.delete_job(org_a, gen_random_uuid());
    raise exception 'FAIL: a job that does not exist was deleted';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;

  -- A job not started is deleted with its items and log; its number is free again (it was the newest)
  ----------------------------------------------------------------------
  set local role service_role;
  n := public.delete_job(org_a, j3);
  reset role;
  assert n = 3, 'delete_job did not say which number it deleted';
  assert (select count(*) from public.jobs where id = j3) = 0, 'the job was not deleted';
  assert (select count(*) from public.job_items where job_id = j3) = 0 and (select count(*) from public.job_events where job_id = j3) = 0, 'its items or log stayed';
  assert (select count(*) from public.quotes where id = q3) = 1, 'the quote went with the job';
  set local role service_role;
  j4 := public.create_job_from_quote(org_a, q3, a);
  reset role;
  assert (select number from public.jobs where id = j4) = 3, 'the deleted job''s number was not given to the next one';

  ----------------------------------------------------------------------
  -- A cancelled job is deleted too; an older number leaves a gap, and the next number goes on from the highest
  ----------------------------------------------------------------------
  set local role service_role;
  perform pg_temp.legacy_cancel(j2);
  perform public.delete_job(org_a, j2);
  j3 := public.create_job_from_quote(org_a, q2, a);
  reset role;
  assert (select count(*) from public.jobs where organisation_id = org_a) = 3, 'wrong number of jobs left';
  assert (select number from public.jobs where id = j3) = 4, 'the next number did not go on from the highest';
  assert (select array_agg(number order by number) from public.jobs where organisation_id = org_a) = array[1, 3, 4], 'unexpected numbers';

  ----------------------------------------------------------------------
  -- Any status can be deleted: making, ready and done go with their items and log, and the quote is free again
  ----------------------------------------------------------------------
  set local role service_role;
  foreach st in array array['in_progress', 'ready', 'done'] loop
    perform public.move_job_status(org_a, j3, a, st);
    n := public.delete_job(org_a, j3);
    assert n = 4, 'delete_job did not say which number it deleted';
    assert (select count(*) from public.jobs where id = j3) = 0, 'a ' || st || ' job was not deleted';
    assert (select count(*) from public.job_events where job_id = j3) = 0, 'its log stayed';
    j3 := public.create_job_from_quote(org_a, q2, a);
    assert (select number from public.jobs where id = j3) = 4, 'the freed number was not used again';
  end loop;
  reset role;

  raise notice 'delete job tests passed';
end
$$;

rollback;
