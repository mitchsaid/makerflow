-- Session-bound data access: a token whose session has ended gets nothing, even when
-- used directly against the database. Also guards that no table or function can be
-- added later without the same protection.

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
  a uuid := '00000000-0000-4000-8000-0000000006a1';
  b uuid := '00000000-0000-4000-8000-0000000006b1';
  org_a uuid;
  org_b uuid;
  t text;
  n int;
  missing text;
begin
  ----------------------------------------------------------------------
  -- Guards: nothing in public can be added without the protection.
  ----------------------------------------------------------------------
  select string_agg(c.relname, ', ') into missing
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p')
     and not exists (
       select 1 from pg_policy p
        where p.polrelid = c.oid and p.polname = 'session_required' and not p.polpermissive
     );
  assert missing is null,
    format('tables without the session_required restrictive policy: %s', missing);

  select string_agg(c.relname, ', ') into missing
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  assert missing is null, format('tables without row-level security: %s', missing);

  -- Functions signed-in users can call are exactly this list. Adding one means
  -- deciding, on purpose, that it checks the session itself.
  select string_agg(p.proname, ', ' order by p.proname) into missing
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in (
       'ensure_organisation', 'has_org_role', 'is_org_member', 'session_is_active',
       -- security invoker: every statement runs under the caller's row-level security
       'save_quote_draft', 'save_product',
       -- security definer, checks the session and the owner/admin role itself
       'set_document_numbering'
     );
  assert missing is null,
    format('unexpected functions callable by signed-in users (do they check the session?): %s', missing);

  ----------------------------------------------------------------------
  -- Setup: two users with businesses.
  ----------------------------------------------------------------------
  insert into auth.users (id, email) values (a, 'sra@example.test'), (b, 'srb@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.prompt_dismissals (user_id, organisation_id, prompt_key) values (a, org_a, 'k');
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  -- With a live session A sees their data in every table.
  perform pg_temp.as_user(a);
  set local role authenticated;
  foreach t in array array['organisations', 'memberships', 'profiles', 'business_profiles', 'prompt_dismissals'] loop
    execute format('select count(*) from public.%I', t) into n;
    assert n >= 1, format('live session cannot read %s', t);
  end loop;
  reset role;

  ----------------------------------------------------------------------
  -- A's session ends (signed out on another device). Same token, nothing works.
  ----------------------------------------------------------------------
  delete from auth.sessions where user_id = a;

  perform set_config('request.jwt.claims',
    json_build_object('sub', a, 'role', 'authenticated',
      'session_id', md5('session-' || a::text)::uuid)::text, true);
  set local role authenticated;

  foreach t in array array['organisations', 'memberships', 'profiles', 'business_profiles', 'prompt_dismissals'] loop
    execute format('select count(*) from public.%I', t) into n;
    assert n = 0, format('ended session still reads %s (%s rows)', t, n);
  end loop;

  update public.organisations set name = 'x' where id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'ended session could rename the organisation';

  update public.business_profiles set phone = '000' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'ended session could change the business profile';

  update public.profiles set display_name = 'x' where id = a;
  get diagnostics n = row_count;
  assert n = 0, 'ended session could change their profile';

  delete from public.prompt_dismissals;
  get diagnostics n = row_count;
  assert n = 0, 'ended session could delete dismissals';

  begin
    insert into public.prompt_dismissals (user_id, organisation_id, prompt_key) values (a, org_a, 'new');
    raise exception 'FAIL: ended session could insert';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.ensure_organisation('Sneaky');
    raise exception 'FAIL: ended session could call ensure_organisation';
  exception when invalid_authorization_specification then null;
  end;
  reset role;

  -- The data itself is untouched, and B is unaffected throughout.
  assert (select name from public.organisations where id = org_a) = 'A Co', 'data changed';
  assert (select count(*) from public.prompt_dismissals where organisation_id = org_a) = 1, 'dismissal changed';

  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.organisations) = 1, 'B lost access';
  assert (select name from public.organisations where id = org_b) = 'B Co', 'B data changed';
  reset role;

  -- A token with no session claim at all gets nothing either.
  perform set_config('request.jwt.claims',
    json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert (select count(*) from public.organisations) = 0, 'token without a session read data';
  reset role;
end;
$$;

rollback;

\echo 'session required tests passed'
