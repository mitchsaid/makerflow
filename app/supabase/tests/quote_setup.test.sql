-- First-quote setup: usual_fulfilment and quote_setup_at. Owners and admins change them, staff do
-- not, another business is untouched, bad values are refused. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000018a1';  -- owner of org A
  b uuid := '00000000-0000-4000-8000-0000000018b1';  -- owner of org B
  c uuid := '00000000-0000-4000-8000-0000000018c1';  -- staff in A
  org_a uuid;
  org_b uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa@example.test'), (b, 'sb@example.test'), (c, 'sc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  -- A new business has not been through the setup and has no usual hand-over.
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select quote_setup_at is null and usual_fulfilment is null from public.business_profiles where organisation_id = org_a),
    'a new business should be unasked with nothing chosen';

  -- The owner answers: a hand-over, a deposit default and the stamp together.
  update public.business_profiles
     set usual_fulfilment = 'delivery', default_deposit_kind = 'percent', default_deposit_value = 5000, quote_setup_at = now()
   where organisation_id = org_a;
  assert (select usual_fulfilment = 'delivery' and quote_setup_at is not null and default_deposit_value = 5000
            from public.business_profiles where organisation_id = org_a), 'the owner could not answer';
  update public.business_profiles set usual_fulfilment = null where organisation_id = org_a;
  assert (select usual_fulfilment is null from public.business_profiles where organisation_id = org_a), 'could not clear it';

  begin
    update public.business_profiles set usual_fulfilment = 'courier' where organisation_id = org_a;
    raise exception 'FAIL: an unknown hand-over was accepted';
  exception when check_violation then null;
  end;
  reset role;

  -- Staff cannot change them (the update changes no row).
  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.business_profiles set usual_fulfilment = 'collection' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the hand-over';
  update public.business_profiles set quote_setup_at = null where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff reset the setup';
  reset role;

  -- Another business cannot read or change them, and its own are untouched.
  perform pg_temp.as_user(b);
  set local role authenticated;
  update public.business_profiles set usual_fulfilment = 'collection' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed the hand-over';
  assert (select quote_setup_at is null and usual_fulfilment is null from public.business_profiles where organisation_id = org_b),
    'org B should still be unasked';
  reset role;

  raise notice 'quote setup tests passed';
end
$$;

rollback;
