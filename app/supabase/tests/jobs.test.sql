-- Jobs (docs/plans/jobs-and-invoices.md, part 1): an accepted quote becomes a job whose copy never changes, the
-- status moves only through a server-only function along allowed moves and every move is logged, a member can change
-- only the note. Plain SQL, one transaction, rolled back.

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

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000028a1';
  b uuid := '00000000-0000-4000-8000-0000000028b1';
  c uuid := '00000000-0000-4000-8000-0000000028c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  q_del uuid;
  q_col uuid;
  q_sent uuid;
  q_nocust uuid;
  job_del uuid;
  job_col uuid;
  job2 uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ja28@example.test'), (b, 'jb28@example.test'), (c, 'jc28@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust_a;
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  perform pg_temp.as_user(a);
  q_del := pg_temp.accepted_quote(org_a, cust_a, a, pg_temp.snapshot(true));
  q_col := pg_temp.accepted_quote(org_a, cust_a, a, pg_temp.snapshot(false));
  q_nocust := pg_temp.accepted_quote(org_a, cust_a, a, jsonb_build_object('customer', null, 'lines', '[]'::jsonb));
  -- A quote that was sent but not accepted.
  declare stamp timestamptz; num text;
  begin
    set local role authenticated;
    q_sent := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust_a), jsonb_build_array(pg_temp.line(0, 'Pie')));
    reset role;
    select updated_at, number into stamp, num from public.quotes where id = q_sent;
    set local role service_role;
    perform public.send_quote(org_a, q_sent, a, 'marked', stamp, pg_temp.snapshot(false) || jsonb_build_object('number', num, 'version', 1), 100000, 15000, 115000);
    reset role;
  end;

  ----------------------------------------------------------------------
  -- Server only: a signed-in user cannot call the functions or write anything directly
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.create_job_from_quote(org_a, q_del, a);
    raise exception 'FAIL: a signed-in user called create_job_from_quote';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.jobs (organisation_id, number, quote_id, quote_version, customer_name) values (org_a, 1, q_del, 1, 'X');
    raise exception 'FAIL: a user inserted a job directly';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Making a job: only from an accepted quote with a customer
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.create_job_from_quote(org_a, q_sent, a);
    raise exception 'FAIL: a job was made from a quote that is only sent';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.create_job_from_quote(org_a, q_nocust, a);
    raise exception 'FAIL: a job was made from a quote with no customer';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.create_job_from_quote(org_b, q_del, b);
    raise exception 'FAIL: another business made a job from this quote';
  exception when sqlstate 'P0002' then null;
  end;

  job_del := public.create_job_from_quote(org_a, q_del, a);
  job_col := public.create_job_from_quote(org_a, q_col, a);
  reset role;

  assert (select number from public.jobs where id = job_del) = 1 and (select number from public.jobs where id = job_col) = 2, 'job numbers do not count up';
  assert (select status = 'not_started' and fulfilment = 'delivery' and delivery_address = '12 Long Street, Cape Town' and needed_by = date '2026-11-20' and customer_name = 'Thandi Nkosi' and customer_phone = '082 555 0101' and customer_id = cust_a and quote_version = 1
            from public.jobs where id = job_del), 'the delivery job did not copy the quote';
  assert (select fulfilment = 'collection' and delivery_address is null from public.jobs where id = job_col), 'the collection job is wrong';
  -- Items: only what is to be made (not the delivery or collection line), in order, with the variation and options.
  assert (select count(*) from public.job_items where job_id = job_del) = 2, 'the job has the wrong items';
  assert (select name = 'Wedding cake' and description = '3 tiers' and quantity_milli = 1000 and variation_label = 'Size' and variation_name = 'Large' and jsonb_array_length(options) = 2
            from public.job_items where job_id = job_del and sort_order = 0), 'the first item is wrong';
  assert (select options -> 1 ->> 'text' = 'Happy 40th' from public.job_items where job_id = job_del and sort_order = 0), 'the wording was not kept';
  assert (select name = 'Cupcakes' and quantity_milli = 12000 and unit = 'dozen' from public.job_items where job_id = job_del and sort_order = 1), 'the second item is wrong';
  assert (select count(*) from public.job_events where job_id = job_del and kind = 'created' and to_status = 'not_started' and actor_id = a) = 1, 'the creation was not logged';

  ----------------------------------------------------------------------
  -- One job per quote at a time; a cancelled one frees the quote
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.create_job_from_quote(org_a, q_del, a);
    raise exception 'FAIL: a second job was made for the same quote';
  exception when unique_violation then null;
  end;
  -- While a job is active the quote keeps its answer; once the job is cancelled it can be reopened again
  begin
    perform public.record_quote_outcome(org_a, q_del, a, 'reopened', null, null, null);
    raise exception 'FAIL: a quote with a job was reopened';
  exception when object_in_use then null;
  end;
  perform public.move_job_status(org_a, job_col, a, 'cancelled');
  perform public.record_quote_outcome(org_a, q_col, a, 'reopened', null, null, null);
  assert (select status from public.quotes where id = q_col) = 'sent', 'a quote without an active job could not be reopened';
  perform public.record_quote_outcome(org_a, q_col, a, 'accepted', date '2026-10-06', 'phone', null);
  job2 := public.create_job_from_quote(org_a, q_col, a);
  reset role;
  assert (select number from public.jobs where id = job2) = 3, 'the new job did not get the next number';

  ----------------------------------------------------------------------
  -- The copy does not move when the customer is edited
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.customers set name = 'Someone Else', phone = '000' where id = cust_a;
  assert (select customer_name from public.jobs where id = job_del) = 'Thandi Nkosi', 'the job followed an edit of the customer';
  reset role;

  ----------------------------------------------------------------------
  -- Status moves: allowed ones, refused ones, every move logged
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.move_job_status(org_a, job_del, a, 'done');
    raise exception 'FAIL: not started jumped to done';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.move_job_status(org_a, job_del, a, 'nonsense');
    raise exception 'FAIL: an unknown status was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform public.move_job_status(org_a, job_del, a, 'in_progress');
  perform public.move_job_status(org_a, job_del, a, 'ready');
  perform public.move_job_status(org_a, job_del, a, 'out_for_delivery');
  perform public.move_job_status(org_a, job_del, a, 'done');
  begin
    perform public.move_job_status(org_a, job_del, a, 'cancelled');
    raise exception 'FAIL: a finished job was cancelled';
  exception when sqlstate 'P0002' then null;
  end;
  perform public.move_job_status(org_a, job_del, a, 'ready');   -- undo
  -- Out for delivery is for deliveries only.
  perform public.move_job_status(org_a, job2, a, 'in_progress');
  perform public.move_job_status(org_a, job2, a, 'ready');
  begin
    perform public.move_job_status(org_a, job2, a, 'out_for_delivery');
    raise exception 'FAIL: a collection job went out for delivery';
  exception when sqlstate 'P0002' then null;
  end;
  perform public.move_job_status(org_a, job2, a, 'done');
  -- Another business cannot move it.
  begin
    perform public.move_job_status(org_b, job_del, b, 'cancelled');
    raise exception 'FAIL: another business moved a job';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  assert (select count(*) from public.job_events where job_id = job_del and kind = 'status') = 5, 'the moves were not all logged';
  -- (Each move is its own transaction in real use, so they have their own times; here they share one, so compare as a set.)
  assert (select array_agg(from_status || '>' || to_status order by from_status || '>' || to_status) from public.job_events where job_id = job_del and kind = 'status')
    = array['done>ready', 'in_progress>ready', 'not_started>in_progress', 'out_for_delivery>done', 'ready>out_for_delivery'], 'the log is not the path taken';

  -- Restoring a cancelled job is refused while the quote has another active one.
  set local role service_role;
  begin
    perform public.move_job_status(org_a, job_col, a, 'not_started');
    raise exception 'FAIL: a cancelled job was restored beside another active one';
  exception when unique_violation then null;
  end;

  -- A job cannot be restored once its quote is no longer accepted (reopened and declined here)
  perform public.move_job_status(org_a, job2, a, 'ready');
  perform public.move_job_status(org_a, job2, a, 'cancelled');
  perform public.record_quote_outcome(org_a, q_col, a, 'reopened', null, null, null);
  perform public.record_quote_outcome(org_a, q_col, a, 'declined', date '2026-10-07', 'phone', null);
  begin
    perform public.move_job_status(org_a, job_col, a, 'not_started');
    raise exception 'FAIL: a job was restored on a declined quote';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.move_job_status(org_a, job2, a, 'not_started');
    raise exception 'FAIL: a job was restored on a declined quote (2)';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- A member can change only the note; nothing can be deleted; events and items are read-only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.jobs set note = 'Buy gold leaf first' where id = job_del;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not write a note';
  begin
    update public.jobs set status = 'done' where id = job_del;
    raise exception 'FAIL: a user changed a status directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.jobs set customer_name = 'Hacked' where id = job_del;
    raise exception 'FAIL: a user changed the frozen customer';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.jobs where id = job_del;
    raise exception 'FAIL: a job was deleted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.job_items set name = 'Hacked' where job_id = job_del;
    raise exception 'FAIL: a job item was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status) values (org_a, job_del, 'status', 'ready', 'done');
    raise exception 'FAIL: an event was written directly';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.jobs) = 3 and (select count(*) from public.job_items) >= 4, 'staff cannot read their business''s jobs';
  reset role;

  ----------------------------------------------------------------------
  -- Isolation and session required
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.jobs) = 0 and (select count(*) from public.job_items) = 0 and (select count(*) from public.job_events) = 0, 'B can see A''s jobs';
  update public.jobs set note = 'Hijacked' where id = job_del;
  get diagnostics n = row_count;
  assert n = 0, 'B changed A''s job';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', gen_random_uuid())::text, true);
  set local role authenticated;
  assert (select count(*) from public.jobs) = 0, 'jobs are visible without an active session';
  reset role;

  -- Numbers count per business.
  perform pg_temp.as_user(b);
  declare cust_b uuid; qb uuid; job_b uuid;
  begin
    set local role authenticated;
    insert into public.customers (organisation_id, name) values (org_b, 'B customer') returning id into cust_b;
    reset role;
    qb := pg_temp.accepted_quote(org_b, cust_b, b, pg_temp.snapshot(false));
    set local role service_role;
    job_b := public.create_job_from_quote(org_b, qb, b);
    reset role;
    assert (select number from public.jobs where id = job_b) = 1, 'B''s first job is not number 1';
  end;

  raise notice 'jobs tests passed';
end
$$;

rollback;
