-- Products security tests. Plain SQL, one transaction, rolled back at the end.
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
  a uuid := '00000000-0000-4000-8000-0000000009a1';
  b uuid := '00000000-0000-4000-8000-0000000009b1';
  c uuid := '00000000-0000-4000-8000-0000000009c1';
  org_a uuid;
  org_b uuid;
  prod_a uuid;
  n int;
  created timestamptz;
  updated timestamptz;
begin
  insert into auth.users (id, email) values
    (a, 'pra@example.test'), (b, 'prb@example.test'), (c, 'prc@example.test');

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
  -- Owner A: name and price are enough
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;

  insert into public.products (organisation_id, name, unit_price_cents)
  values (org_a, 'Wedding cake', 80000) returning id into prod_a;
  assert (select kind from public.products where id = prod_a) = 'product', 'a new product should default to kind product';
  insert into public.products (organisation_id, kind, name, description, unit_price_cents)
  values (org_a, 'service', 'Cake tasting', 'An hour at the studio', 0);

  -- Shape rules.
  begin
    insert into public.products (organisation_id, name, unit_price_cents) values (org_a, '', 100);
    raise exception 'FAIL: empty name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.products (organisation_id, name, unit_price_cents) values (org_a, 'Neg', -1);
    raise exception 'FAIL: negative price was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.products (organisation_id, kind, name, unit_price_cents) values (org_a, 'gadget', 'X', 1);
    raise exception 'FAIL: unknown kind was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.products (organisation_id, name, description, unit_price_cents) values (org_a, 'X', '', 1);
    raise exception 'FAIL: empty description string was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.products (organisation_id, name) values (org_a, 'No price');
    raise exception 'FAIL: a product without a price was accepted';
  exception when not_null_violation then null;
  end;

  -- Edit, archive and restore.
  update public.products set unit_price_cents = 85000, description = 'Three tiers' where id = prod_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not edit a product';
  update public.products set archived_at = now() where id = prod_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not archive a product';
  update public.products set archived_at = null where id = prod_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not restore a product';

  -- Never deleted; the organisation and the timestamps cannot be changed.
  begin
    delete from public.products where id = prod_a;
    raise exception 'FAIL: product delete was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.products set organisation_id = org_b where id = prod_a;
    raise exception 'FAIL: organisation_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.products set created_at = now() where id = prod_a;
    raise exception 'FAIL: created_at was updatable';
  exception when insufficient_privilege then null;
  end;

  -- Cannot add a product to someone else's business.
  begin
    insert into public.products (organisation_id, name, unit_price_cents) values (org_b, 'Planted', 1);
    raise exception 'FAIL: A added a product to B''s business';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select created_at, updated_at into created, updated from public.products where id = prod_a;
  assert updated > created, 'updated_at was not advanced by the update trigger';
  assert exists (
    select 1 from pg_constraint
     where conrelid = 'public.products'::regclass and conname = 'products_org_id_unique' and contype = 'u'
  ), 'products (organisation_id, id) is not unique-constrained';

  ----------------------------------------------------------------------
  -- Staff C: any member can add, edit and archive
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  select count(*) into n from public.products where organisation_id = org_a;
  assert n = 2, format('staff should see A''s 2 products, saw %s', n);
  insert into public.products (organisation_id, name, unit_price_cents) values (org_a, 'Staff product', 100);
  update public.products set unit_price_cents = 90000 where id = prod_a;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not edit a product';
  update public.products set archived_at = now() where id = prod_a;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not archive a product';
  reset role;

  ----------------------------------------------------------------------
  -- Business B: isolation
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.products;
  assert n = 0, format('B sees products it should not: %s', n);
  update public.products set name = 'Hijacked' where id = prod_a;
  get diagnostics n = row_count;
  assert n = 0, 'B edited A''s product';
  update public.products set archived_at = null where id = prod_a;
  get diagnostics n = row_count;
  assert n = 0, 'B restored A''s product';
  reset role;

  ----------------------------------------------------------------------
  -- Signed-out and ended sessions get nothing
  ----------------------------------------------------------------------
  set local role anon;
  begin
    perform count(*) from public.products;
    raise exception 'FAIL: anon could read products';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(a);
  delete from auth.sessions where user_id = a;
  set local role authenticated;
  select count(*) into n from public.products;
  assert n = 0, 'products were readable with an ended session';
  reset role;

  raise notice 'products tests passed';
end
$$;

rollback;
