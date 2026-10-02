-- Customers security tests. Plain SQL, one transaction, rolled back at the end.
-- Any failed assertion raises and fails the run.

begin;

-- Test helper: a signed-in user has a real session, as in production.
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
  a uuid := '00000000-0000-4000-8000-0000000007a1';
  b uuid := '00000000-0000-4000-8000-0000000007b1';
  c uuid := '00000000-0000-4000-8000-0000000007c1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  n int;
  created timestamptz;
  updated timestamptz;
begin
  insert into auth.users (id, email) values
    (a, 'ca@example.test'), (b, 'cb@example.test'), (c, 'cc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  -- C is staff in A's business.
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Owner A: name only is enough
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;

  insert into public.customers (organisation_id, name) values (org_a, 'Thandi')
  returning id into cust_a;
  assert (select kind from public.customers where id = cust_a) = 'individual',
    'a new customer should default to an individual';
  assert (select archived_at from public.customers where id = cust_a) is null,
    'a new customer should not be archived';

  -- Full details on a business customer.
  insert into public.customers (
    organisation_id, name, kind, contact_person, email, phone,
    address_line1, city, region, postal_code, delivery_address,
    vat_number, company_registration_number, notes
  ) values (
    org_a, 'Cape Cakes (Pty) Ltd', 'business', 'Sam', 'sam@cakes.example', '021 555 0000',
    '1 Main Rd', 'Cape Town', 'Western Cape', '8001', E'Dock 4\nBack gate',
    '4123456789', '2020/123456/07', 'Pays on 30 days'
  );

  -- An individual cannot carry business-only details, and a business cannot lose its kind
  -- while they are set.
  begin
    insert into public.customers (organisation_id, name, vat_number) values (org_a, 'X', '4123456789');
    raise exception 'FAIL: individual with a VAT number was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.customers set kind = 'individual' where name = 'Cape Cakes (Pty) Ltd';
    raise exception 'FAIL: business with business-only details switched to individual';
  exception when check_violation then null;
  end;
  begin
    insert into public.customers (organisation_id, name, kind) values (org_a, 'Y', 'company');
    raise exception 'FAIL: unknown kind was accepted';
  exception when check_violation then null;
  end;

  -- Shape rules: no empty strings, name limits.
  begin
    insert into public.customers (organisation_id, name) values (org_a, '');
    raise exception 'FAIL: empty name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.customers (organisation_id, name) values (org_a, repeat('x', 121));
    raise exception 'FAIL: over-long name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.customers (organisation_id, name, email) values (org_a, 'Z', '');
    raise exception 'FAIL: empty email string was accepted';
  exception when check_violation then null;
  end;

  -- Edit, archive and restore.
  update public.customers set phone = '082 111 2222' where id = cust_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not edit a customer';
  update public.customers set archived_at = now() where id = cust_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not archive a customer';
  update public.customers set archived_at = null where id = cust_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not restore a customer';

  -- Never deleted; the organisation and the timestamps cannot be changed.
  begin
    delete from public.customers where id = cust_a;
    raise exception 'FAIL: customer delete was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.customers set organisation_id = org_b where id = cust_a;
    raise exception 'FAIL: organisation_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.customers set created_at = now() where id = cust_a;
    raise exception 'FAIL: created_at was updatable';
  exception when insufficient_privilege then null;
  end;

  -- Cannot add a customer to someone else's business.
  begin
    insert into public.customers (organisation_id, name) values (org_b, 'Planted');
    raise exception 'FAIL: A added a customer to B''s business';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- updated_at moves forward on update.
  select created_at, updated_at into created, updated from public.customers where id = cust_a;
  assert updated > created, 'updated_at was not advanced by the update trigger';

  -- The composite key later documents will use exists.
  assert exists (
    select 1 from pg_constraint
     where conrelid = 'public.customers'::regclass and conname = 'customers_org_id_unique' and contype = 'u'
  ), 'customers (organisation_id, id) is not unique-constrained';

  ----------------------------------------------------------------------
  -- Staff C: any member can add, edit and archive
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;

  select count(*) into n from public.customers where organisation_id = org_a;
  assert n = 2, format('staff should see A''s 2 customers, saw %s', n);
  insert into public.customers (organisation_id, name) values (org_a, 'Added by staff');
  update public.customers set notes = 'staff note' where id = cust_a;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not edit a customer';
  update public.customers set archived_at = now() where id = cust_a;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not archive a customer';
  reset role;

  ----------------------------------------------------------------------
  -- Business B: isolation
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;

  insert into public.customers (organisation_id, name) values (org_b, 'B customer') returning id into cust_b;
  select count(*) into n from public.customers;
  assert n = 1, format('B should see only its own customer, saw %s', n);
  select count(*) into n from public.customers where id = cust_a;
  assert n = 0, 'B can see A''s customer';

  update public.customers set name = 'Hijacked' where id = cust_a;
  get diagnostics n = row_count;
  assert n = 0, 'B edited A''s customer';
  update public.customers set archived_at = now() where id = cust_a;
  get diagnostics n = row_count;
  assert n = 0, 'B archived A''s customer';
  reset role;

  ----------------------------------------------------------------------
  -- Signed-out and ended sessions get nothing
  ----------------------------------------------------------------------
  set local role anon;
  begin
    perform count(*) from public.customers;
    raise exception 'FAIL: anon could read customers';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(a);
  delete from auth.sessions where user_id = a;
  set local role authenticated;
  select count(*) into n from public.customers;
  assert n = 0, 'a customer list was readable with an ended session';
  reset role;

  raise notice 'customers tests passed';
end
$$;

rollback;
