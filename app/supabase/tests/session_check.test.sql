-- session_is_active(): a token only counts while its session still exists.

begin;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000005a1';
  b uuid := '00000000-0000-4000-8000-0000000005b1';
  sess_a uuid := '00000000-0000-4000-8000-0000000005c1';
  sess_a2 uuid := '00000000-0000-4000-8000-0000000005c2';
  sess_b uuid := '00000000-0000-4000-8000-0000000005c3';
begin
  insert into auth.users (id, email) values (a, 'sa@example.test'), (b, 'sb@example.test');
  insert into auth.sessions (id, user_id) values (sess_a, a), (sess_a2, a), (sess_b, b);
  insert into auth.sessions (id, user_id, not_after)
    values ('00000000-0000-4000-8000-0000000005c4', a, now() - interval '1 minute');

  -- A live session is active.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'session_id', sess_a)::text, true);
  set local role authenticated;
  assert public.session_is_active(), 'a live session was reported inactive';
  reset role;

  -- Signing out on another device ends that session only.
  delete from auth.sessions where id = sess_a2;
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'session_id', sess_a2)::text, true);
  set local role authenticated;
  assert not public.session_is_active(), 'an ended session still counted as active';
  reset role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'session_id', sess_a)::text, true);
  set local role authenticated;
  assert public.session_is_active(), 'ending one session ended another';
  reset role;

  -- An expired session is not active.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated',
      'session_id', '00000000-0000-4000-8000-0000000005c4')::text, true);
  set local role authenticated;
  assert not public.session_is_active(), 'an expired session counted as active';
  reset role;

  -- A token cannot borrow someone else's session.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated', 'session_id', sess_b)::text, true);
  set local role authenticated;
  assert not public.session_is_active(), 'a token used another user''s session';
  reset role;

  -- No session claim at all is not active.
  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert not public.session_is_active(), 'a token with no session counted as active';
  reset role;

  -- Removing the user ends their sessions (cascade).
  delete from auth.users where id = b;
  assert (select count(*) from auth.sessions where user_id = b) = 0, 'sessions outlived their user';

  -- Anonymous callers cannot use it.
  set local role anon;
  begin
    perform public.session_is_active();
    raise exception 'FAIL: anon could call session_is_active';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;

\echo 'session check tests passed'
