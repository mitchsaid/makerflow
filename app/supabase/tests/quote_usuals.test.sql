-- "Your usual" (migration 20261102100000): the description usual and the deposit default "ask". Owners and admins set
-- them, staff do not, another business is untouched, bad values are refused. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000019a1';  -- owner of org A
  b uuid := '00000000-0000-4000-8000-0000000019b1';  -- owner of org B
  c uuid := '00000000-0000-4000-8000-0000000019c1';  -- staff in A
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ua@example.test'), (b, 'ub@example.test'), (c, 'uc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  -- A new business has no usual description and the deposit is not "ask".
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select default_description is null and default_deposit_kind = 'none' from public.business_profiles where organisation_id = org_a),
    'a new business should start with no usual description and no deposit default';

  -- The owner saves a usual description, and can change and clear it.
  update public.business_profiles set default_description = 'Thank you for asking about your order.' where organisation_id = org_a;
  assert (select default_description = 'Thank you for asking about your order.' from public.business_profiles where organisation_id = org_a),
    'the owner could not save the usual description';
  update public.business_profiles set default_description = null where organisation_id = org_a;
  assert (select default_description is null from public.business_profiles where organisation_id = org_a), 'could not clear it';

  -- Too long, or empty, is refused.
  begin
    update public.business_profiles set default_description = repeat('x', 2001) where organisation_id = org_a;
    raise exception 'FAIL: a 2001-character description was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set default_description = '' where organisation_id = org_a;
    raise exception 'FAIL: an empty description was accepted';
  exception when check_violation then null;
  end;

  -- "Ask each time" is a deposit default with nothing chosen: the value must be 0.
  update public.business_profiles set default_deposit_kind = 'ask', default_deposit_value = 0 where organisation_id = org_a;
  assert (select default_deposit_kind = 'ask' from public.business_profiles where organisation_id = org_a), 'could not choose ask each time';
  begin
    update public.business_profiles set default_deposit_kind = 'ask', default_deposit_value = 5000 where organisation_id = org_a;
    raise exception 'FAIL: ask with an amount was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set default_deposit_kind = 'whenever', default_deposit_value = 0 where organisation_id = org_a;
    raise exception 'FAIL: an unknown deposit default was accepted';
  exception when check_violation then null;
  end;
  -- The older kinds still work.
  update public.business_profiles set default_deposit_kind = 'percent', default_deposit_value = 5000 where organisation_id = org_a;
  update public.business_profiles set default_deposit_kind = 'none', default_deposit_value = 0 where organisation_id = org_a;
  reset role;

  -- Staff cannot change them (the update changes no row).
  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.business_profiles set default_description = 'Staff wrote this' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the usual description';
  update public.business_profiles set default_deposit_kind = 'ask' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the deposit default';
  reset role;

  -- Another business cannot change them, and its own are untouched.
  perform pg_temp.as_user(b);
  set local role authenticated;
  update public.business_profiles set default_description = 'B wrote this' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed the usual description';
  assert (select default_description is null and default_deposit_kind = 'none' from public.business_profiles where organisation_id = org_b),
    'org B should be untouched';
  reset role;

  raise notice 'quote usuals tests passed';
end
$$;

rollback;
