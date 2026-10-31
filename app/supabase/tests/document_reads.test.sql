-- Document reads (the AI reader's count): a member can add a row for their own business as themselves, cannot read,
-- change or delete any, cannot add one as someone else or for another business, and is limited to 5 an hour as a
-- person and 20 a day as a business. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000031a1';
  b uuid := '00000000-0000-4000-8000-0000000031b1';
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'da31@example.test'), (b, 'db31@example.test');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');

  -- A read for my own business, as me.
  insert into public.document_reads (organisation_id, user_id) values (org_a, a);

  -- Not as someone else, not for another business.
  begin
    insert into public.document_reads (organisation_id, user_id) values (org_a, b);
    raise exception 'FAIL: a read as another person was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.document_reads (organisation_id, user_id) values (org_b, a);
    raise exception 'FAIL: a read for another business was accepted';
  exception when insufficient_privilege then null;
  end;

  -- Nothing can be read, changed or deleted through the app.
  begin
    perform count(*) from public.document_reads;
    raise exception 'FAIL: reads could be counted by the app';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.document_reads set created_at = now();
    raise exception 'FAIL: a read could be changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.document_reads;
    raise exception 'FAIL: reads could be deleted';
  exception when insufficient_privilege then null;
  end;

  -- At most 5 an hour for one person (one is in: four more are fine, the next is refused).
  for n in 1..4 loop
    insert into public.document_reads (organisation_id, user_id) values (org_a, a);
  end loop;
  begin
    insert into public.document_reads (organisation_id, user_id) values (org_a, a);
    raise exception 'FAIL: a sixth read in an hour was accepted';
  exception when program_limit_exceeded then null;
  end;
  reset role;

  -- Another person's hourly limit is their own, and another business's day is its own.
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.document_reads (organisation_id, user_id) values (org_b, b);
  reset role;

  -- At most 20 a day for one business: 15 more earlier today (written here as the database owner) make 20.
  insert into public.document_reads (organisation_id, user_id, created_at)
  select org_a, null, now() - interval '3 hours' from generate_series(1, 15);
  assert (select count(*) from public.document_reads where organisation_id = org_a) = 20, 'the count is not 20';
  begin
    insert into public.document_reads (organisation_id, user_id, created_at) values (org_a, null, now());
    raise exception 'FAIL: a 21st read in a day was accepted';
  exception when program_limit_exceeded then null;
  end;

  -- A person's account going away keeps the count but not the person.
  delete from public.memberships where user_id = a;
  delete from auth.users where id = a;
  assert (select count(*) from public.document_reads where organisation_id = org_a) = 20, 'the count went with the person';
  assert (select count(*) from public.document_reads where user_id = a) = 0, 'the person was not forgotten';

  raise notice 'document_reads tests passed';
end
$$;

rollback;
