-- Feedback: a member can add feedback for their own business as themselves, cannot read, change or delete any (even
-- their own), cannot send it as someone else or for another business, and is limited to 10 an hour.
-- Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000030a1';
  b uuid := '00000000-0000-4000-8000-0000000030b1';
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'fa30@example.test'), (b, 'fb30@example.test');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');

  -- Adding feedback for my own business, as me.
  insert into public.feedback (organisation_id, user_id, kind, message, page, user_agent, viewport, contact_email)
  values (org_a, a, 'problem', 'The total looks wrong', '/app/quotes/abc', 'Mozilla/5.0', '412x839', 'fa30@example.test');

  -- Not as someone else, not for another business, not empty, not too long, not a bad viewport.
  begin
    insert into public.feedback (organisation_id, user_id, message) values (org_a, b, 'as someone else');
    raise exception 'FAIL: feedback as another person was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback (organisation_id, user_id, message) values (org_b, a, 'for another business');
    raise exception 'FAIL: feedback for another business was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.feedback (organisation_id, user_id, message) values (org_a, a, '   ');
    raise exception 'FAIL: an empty message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.feedback (organisation_id, user_id, message) values (org_a, a, repeat('x', 2001));
    raise exception 'FAIL: a long message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.feedback (organisation_id, user_id, message, viewport) values (org_a, a, 'x', 'wide');
    raise exception 'FAIL: a bad viewport was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.feedback (organisation_id, user_id, kind, message) values (org_a, a, 'rant', 'x');
    raise exception 'FAIL: an unknown kind was accepted';
  exception when check_violation then null;
  end;

  -- Nothing can be read, changed or deleted through the app, even by the person who wrote it.
  begin
    perform count(*) from public.feedback;
    raise exception 'FAIL: feedback could be read';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.feedback set message = 'changed';
    raise exception 'FAIL: feedback could be changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.feedback;
    raise exception 'FAIL: feedback could be deleted';
  exception when insufficient_privilege then null;
  end;

  -- At most 10 in an hour (one is already in: nine more are fine, the next is refused).
  for n in 1..9 loop
    insert into public.feedback (organisation_id, user_id, message) values (org_a, a, 'again ' || n);
  end loop;
  begin
    insert into public.feedback (organisation_id, user_id, message) values (org_a, a, 'one too many');
    raise exception 'FAIL: an eleventh feedback in an hour was accepted';
  exception when program_limit_exceeded then null;
  end;
  reset role;

  -- Written as asked, and kept (read here as the database owner).
  assert (select count(*) from public.feedback where organisation_id = org_a) = 10, 'feedback was not kept';
  assert (select contact_email from public.feedback where message = 'The total looks wrong') = 'fa30@example.test', 'the email was not kept';

  -- A person's account going away keeps the message but clears who it was and how to reach them.
  assert (select user_id from public.feedback where message = 'The total looks wrong') = a, 'the feedback is not the person''s';
  delete from public.memberships where user_id = a;
  delete from auth.users where id = a;
  assert (select user_id is null and contact_email is null from public.feedback where message = 'The total looks wrong'), 'the person was not forgotten';
  assert (select count(*) from public.feedback where organisation_id = org_a) = 10, 'the feedback went with the person';

  -- Another person's limit is their own.
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.feedback (organisation_id, user_id, message) values (org_b, b, 'mine');
  reset role;

  raise notice 'feedback tests passed';
end
$$;

rollback;
