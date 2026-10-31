-- Demo accounts: only an anonymous visitor can make a demo business, it carries its flags and an expiry, nobody can
-- set the flags another way, a real person cannot flag a business, and at most 300 are alive at once.
-- Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid, anon boolean) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid, 'is_anonymous', anon)::text, true);
end
$f$;

do $$
declare
  visitor uuid := '00000000-0000-4000-8000-0000000032a1';
  visitor2 uuid := '00000000-0000-4000-8000-0000000032a2';
  maker uuid := '00000000-0000-4000-8000-0000000032b1';
  demo_org uuid;
  again uuid;
  maker_org uuid;
begin
  insert into auth.users (id, email, is_anonymous) values (visitor, null, true), (visitor2, null, true), (maker, 'maker32@example.test', false);

  -- An anonymous visitor makes a demo: flagged, with an expiry about six hours away, theirs and an owner.
  perform pg_temp.as_user(visitor, true);
  set local role authenticated;
  demo_org := public.create_demo_organisation('baker', 'Sweet Crumbs Bakery');
  again := public.create_demo_organisation('woodworker', 'Another name');
  assert again = demo_org, 'a second call made a second demo';
  assert (select demo_kind from public.organisations where id = demo_org) = 'baker', 'the demo is not flagged';
  assert (select demo_expires_at from public.organisations where id = demo_org) between now() + interval '5 hours' and now() + interval '7 hours', 'the expiry is not about six hours away';
  assert (select role from public.memberships where organisation_id = demo_org and user_id = visitor) = 'owner', 'the visitor does not own it';
  assert (select count(*) from public.business_profiles where organisation_id = demo_org) = 1, 'no business profile';

  -- Not another way to set the flags, and not an unknown kind.
  begin
    update public.organisations set demo_kind = null, demo_expires_at = null where id = demo_org;
    raise exception 'FAIL: the demo flags could be cleared through the app';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(visitor2, true);
  set local role authenticated;
  begin
    perform public.create_demo_organisation('florist', 'X');
    raise exception 'FAIL: an unknown kind was accepted';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  -- A real person (an email address, not anonymous) cannot make one.
  perform pg_temp.as_user(maker, false);
  set local role authenticated;
  begin
    perform public.create_demo_organisation('baker', 'Not a demo');
    raise exception 'FAIL: a signed-in person made a demo';
  exception when insufficient_privilege then null;
  end;
  maker_org := public.ensure_organisation('Real Co');
  begin
    update public.organisations set demo_kind = 'baker', demo_expires_at = now() + interval '1 hour' where id = maker_org;
    raise exception 'FAIL: a real business could be flagged as a demo';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- The signed-out role cannot call it at all.
  set local role anon;
  begin
    perform public.create_demo_organisation('baker', 'X');
    raise exception 'FAIL: the signed-out role called it';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- At most 300 alive at once.
  insert into public.organisations (name, demo_kind, demo_expires_at)
  select 'Filler ' || g, 'baker', now() + interval '1 hour' from generate_series(1, 299) g;
  perform pg_temp.as_user(visitor2, true);
  set local role authenticated;
  begin
    perform public.create_demo_organisation('baker', 'One too many');
    raise exception 'FAIL: a 301st live demo was accepted';
  exception when program_limit_exceeded then null;
  end;
  reset role;

  raise notice 'demo accounts tests passed';
end
$$;

rollback;
