-- Business types: null = never asked, {} = skipped; owners and admins change them, staff do not;
-- another business is untouched; the size is limited. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000013a1';  -- owner of org A
  b uuid := '00000000-0000-4000-8000-0000000013b1';  -- owner of org B
  c uuid := '00000000-0000-4000-8000-0000000013c1';  -- staff in A
  d uuid := '00000000-0000-4000-8000-0000000013d1';  -- admin in A
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values
    (a, 'ta@example.test'), (b, 'tb@example.test'), (c, 'tc@example.test'), (d, 'td@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff'), (org_a, d, 'admin');

  -- A new business has never been asked.
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select business_types is null from public.business_profiles where organisation_id = org_a),
    'a new business should have null business_types (never asked)';

  -- The owner answers; skipping is an empty list, different from never asked.
  update public.business_profiles set business_types = array['food', 'workshops'] where organisation_id = org_a;
  assert (select business_types from public.business_profiles where organisation_id = org_a) = array['food', 'workshops'],
    'the owner could not set the types';
  update public.business_profiles set business_types = '{}' where organisation_id = org_a;
  assert (select business_types is not null and cardinality(business_types) = 0
            from public.business_profiles where organisation_id = org_a), 'skipped should be an empty list';

  -- Size limits: at most 10 entries, and a small total size.
  begin
    update public.business_profiles set business_types = array['a','b','c','d','e','f','g','h','i','j','k'] where organisation_id = org_a;
    raise exception 'FAIL: more than 10 types were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set business_types = array[repeat('x', 301)] where organisation_id = org_a;
    raise exception 'FAIL: an over-long type was accepted';
  exception when check_violation then null;
  end;
  reset role;

  -- An admin may change them; staff may not (the update changes no row).
  perform pg_temp.as_user(d);
  set local role authenticated;
  update public.business_profiles set business_types = array['jewellery'] where organisation_id = org_a;
  assert (select business_types from public.business_profiles where organisation_id = org_a) = array['jewellery'],
    'an admin could not change the types';
  reset role;

  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.business_profiles set business_types = array['flowers'] where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the types';
  assert (select business_types from public.business_profiles where organisation_id = org_a) = array['jewellery'],
    'staff can read the types';
  reset role;

  -- Another business cannot read or change them.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.business_profiles where organisation_id = org_a) = 0,
    'another business can read the profile';
  update public.business_profiles set business_types = array['art'] where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed the types';
  assert (select business_types is null from public.business_profiles where organisation_id = org_b),
    'org B should still never have been asked';
  reset role;

  raise notice 'business types tests passed';
end
$$;

rollback;
