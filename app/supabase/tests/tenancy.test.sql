-- Tenancy isolation tests. Plain SQL so they run both against real Supabase
-- (local stack or CI) and against plain Postgres with tests/shim/auth_shim.sql.
-- Everything runs inside one transaction that is rolled back at the end.
-- Any failed assertion raises an exception and (with ON_ERROR_STOP) fails the run.

begin;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  c uuid := '00000000-0000-4000-8000-00000000000c';
  org_a uuid;
  org_a_again uuid;
  org_b uuid;
  n int;
  nm text;
begin
  -- Setup as superuser: three auth users. The trigger creates their profiles.
  insert into auth.users (id, email) values
    (a, 'a@example.test'), (b, 'b@example.test'), (c, 'c@example.test');

  assert (select count(*) from public.profiles where id in (a, b, c)) = 3,
    'profile trigger did not create a profile for each new user';

  -- User A signs in for the first time.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  org_a := public.ensure_organisation();
  org_a_again := public.ensure_organisation();
  assert org_a is not null, 'ensure_organisation returned null';
  assert org_a = org_a_again, 'ensure_organisation is not idempotent';
  reset role;

  -- User B signs in for the first time.
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  org_b := public.ensure_organisation();
  reset role;
  assert org_a <> org_b, 'two users share one organisation';

  -- A sees only their own organisation and membership.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.organisations;
  assert n = 1, format('A should see 1 organisation, saw %s', n);
  select count(*) into n from public.organisations where id = org_b;
  assert n = 0, 'A can read B''s organisation';
  select count(*) into n from public.memberships where organisation_id = org_b;
  assert n = 0, 'A can read B''s memberships';

  -- A cannot modify B's organisation (RLS filters the row, 0 rows updated).
  update public.organisations set name = 'hijacked' where id = org_b;
  get diagnostics n = row_count;
  assert n = 0, 'A updated B''s organisation';

  -- A can rename their own organisation (owner).
  update public.organisations set name = 'A Workshop' where id = org_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not rename own organisation';

  -- A cannot create organisations or memberships directly.
  begin
    insert into public.organisations (name) values ('sneaky');
    raise exception 'FAIL: direct organisation insert was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.memberships (organisation_id, user_id, role)
    values (org_b, a, 'owner');
    raise exception 'FAIL: A could add themselves to B''s organisation';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.memberships where organisation_id = org_a;
    raise exception 'FAIL: direct membership delete was allowed';
  exception when insufficient_privilege then null;
  end;

  -- A cannot change columns other than the granted ones.
  begin
    update public.organisations set id = gen_random_uuid() where id = org_a;
    raise exception 'FAIL: organisation id was updatable';
  exception when insufficient_privilege then null;
  end;

  -- A sees own profile only (no shared organisation with B yet).
  select count(*) into n from public.profiles;
  assert n = 1, format('A should see only their own profile, saw %s', n);
  update public.profiles set display_name = 'B pwned' where id = b;
  get diagnostics n = row_count;
  assert n = 0, 'A updated B''s profile';
  update public.profiles set display_name = 'Alice' where id = a;
  get diagnostics n = row_count;
  assert n = 1, 'A could not update own profile';

  reset role;

  -- C joins A's organisation as staff (done as superuser: invitations come later).
  insert into public.memberships (organisation_id, user_id, role)
  values (org_a, c, 'staff');

  -- Staff can see the organisation but cannot rename it.
  perform set_config('request.jwt.claims',
    json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select name into nm from public.organisations where id = org_a;
  assert nm = 'A Workshop', 'staff member cannot see their organisation';
  update public.organisations set name = 'staff rename' where id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff member renamed the organisation';

  -- Colleagues can see each other's profiles, but not strangers'.
  select count(*) into n from public.profiles where id in (a, c);
  assert n = 2, 'colleagues cannot see each other''s profiles';
  select count(*) into n from public.profiles where id = b;
  assert n = 0, 'C can see the profile of someone in a different organisation';

  reset role;

  -- Unauthenticated (anon) access is denied outright.
  set local role anon;
  begin
    perform count(*) from public.organisations;
    raise exception 'FAIL: anon could read organisations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ensure_organisation();
    raise exception 'FAIL: anon could call ensure_organisation';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;

\echo 'tenancy tests passed'
