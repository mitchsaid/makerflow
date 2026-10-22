-- The margin a business aims for (docs/plans/costing-slice-c.md; migration 20261118100000): one nullable column on the
-- business profile, 1% to 99%, changed by owners and admins only. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000032a1';
  b uuid := '00000000-0000-4000-8000-0000000032b1';
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ta32@example.test'), (b, 'tb32@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  -- A new business has no target.
  assert (select target_margin_bp from public.business_profiles where organisation_id = org_a) is null, 'a target was set by default';

  -- The owner sets it, changes it and clears it.
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.business_profiles set target_margin_bp = 4000 where organisation_id = org_a;
  assert (select target_margin_bp from public.business_profiles where organisation_id = org_a) = 4000, 'the target was not saved';
  update public.business_profiles set target_margin_bp = 100 where organisation_id = org_a;
  update public.business_profiles set target_margin_bp = 9900 where organisation_id = org_a;
  update public.business_profiles set target_margin_bp = null where organisation_id = org_a;
  assert (select target_margin_bp from public.business_profiles where organisation_id = org_a) is null, 'the target was not cleared';

  -- Outside 1% to 99% is refused, including zero, negative and a hundred percent.
  begin
    update public.business_profiles set target_margin_bp = 0 where organisation_id = org_a;
    raise exception 'a zero target was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set target_margin_bp = -500 where organisation_id = org_a;
    raise exception 'a negative target was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set target_margin_bp = 10000 where organisation_id = org_a;
    raise exception 'a target of a hundred percent was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set target_margin_bp = 99 where organisation_id = org_a;
    raise exception 'a target under one percent was accepted';
  exception when check_violation then null;
  end;
  reset role;

  -- Another business changes nothing of A's.
  update public.business_profiles set target_margin_bp = 3000 where organisation_id = org_a;
  perform pg_temp.as_user(b);
  set local role authenticated;
  update public.business_profiles set target_margin_bp = 9000 where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed the target';
  assert (select count(*) from public.business_profiles where organisation_id = org_a) = 0, 'another business could read the profile';
  reset role;
  assert (select target_margin_bp from public.business_profiles where organisation_id = org_a) = 3000, 'the target was changed from outside';

  -- No session: nothing, and no writing.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.business_profiles set target_margin_bp = 5000 where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'the target was changed without a session';
  reset role;
  assert (select target_margin_bp from public.business_profiles where organisation_id = org_a) = 3000, 'the target changed without a session';
end
$$;

rollback;
