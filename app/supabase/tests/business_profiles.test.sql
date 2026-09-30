-- Business profile and prompt-dismissal security tests. Plain SQL, one transaction,
-- rolled back at the end. Any failed assertion raises and fails the run.

begin;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000000a1';
  b uuid := '00000000-0000-4000-8000-0000000000b1';
  c uuid := '00000000-0000-4000-8000-0000000000c1';
  org_a uuid;
  org_b uuid;
  n int;
  created timestamptz;
  updated timestamptz;
begin
  insert into auth.users (id, email) values
    (a, 'pa@example.test'), (b, 'pb@example.test'), (c, 'pc@example.test');

  -- A and B each create a business.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  -- Calling again must not create a second profile or fail.
  perform public.ensure_organisation('ignored');
  reset role;

  -- Each new organisation got a default profile.
  assert (select count(*) from public.business_profiles where organisation_id in (org_a, org_b)) = 2,
    'ensure_organisation did not create a profile row per organisation';
  assert (select country_code || currency_code from public.business_profiles where organisation_id = org_a) = 'ZAZAR',
    'default country/currency is not ZA/ZAR';
  assert (select vat_registered from public.business_profiles where organisation_id = org_a) = false,
    'new profile should not be VAT registered';

  -- C joins A's business as staff.
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Owner A
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.business_profiles;
  assert n = 1, format('A should see exactly 1 profile, saw %s', n);

  update public.business_profiles
     set phone = '021 123 4567', email = 'hello@a.example',
         address_line1 = '1 Main Rd', city = 'Cape Town', region = 'Western Cape', postal_code = '8001'
   where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not update own profile';

  update public.business_profiles
     set vat_registered = true, vat_number = '4123456789'
   where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 1, 'owner could not set VAT details';

  -- updated_at moves forward on update.
  reset role;
  select created_at, updated_at into created, updated
    from public.business_profiles where organisation_id = org_a;
  assert updated > created, 'updated_at was not advanced by the update trigger';
  set local role authenticated;

  -- VAT consistency: registered needs a number, and a number needs registration.
  begin
    update public.business_profiles set vat_registered = true, vat_number = null
     where organisation_id = org_a;
    raise exception 'FAIL: registered without a VAT number was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.business_profiles set vat_registered = false
     where organisation_id = org_a;  -- number still present
    raise exception 'FAIL: VAT number without registration was accepted';
  exception when check_violation then null;
  end;

  update public.business_profiles set vat_registered = false, vat_number = null
   where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 1, 'could not clear VAT details cleanly';

  -- Empty strings are rejected (the app stores NULL for empty fields).
  begin
    update public.business_profiles set phone = '' where organisation_id = org_a;
    raise exception 'FAIL: empty phone string was accepted';
  exception when check_violation then null;
  end;

  -- Cannot touch another business.
  update public.business_profiles set phone = '000' where organisation_id = org_b;
  get diagnostics n = row_count;
  assert n = 0, 'A updated B''s profile';

  -- Cannot change protected columns, insert or delete.
  begin
    update public.business_profiles set organisation_id = org_b where organisation_id = org_a;
    raise exception 'FAIL: organisation_id was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.business_profiles set country_code = 'US' where organisation_id = org_a;
    raise exception 'FAIL: country_code was updatable by a user';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.business_profiles set created_at = now() where organisation_id = org_a;
    raise exception 'FAIL: created_at was updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.business_profiles (organisation_id) values (org_b);
    raise exception 'FAIL: direct profile insert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.business_profiles where organisation_id = org_a;
    raise exception 'FAIL: profile delete was allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Staff C: can read the business profile, cannot change it.
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.business_profiles where organisation_id = org_a;
  assert n = 1, 'staff cannot read their business profile';
  update public.business_profiles set phone = 'staff edit' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff member edited the business profile';
  reset role;

  ----------------------------------------------------------------------
  -- Prompt dismissals
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.prompt_dismissals (user_id, organisation_id, prompt_key)
  values (a, org_a, 'business-details');

  -- Dismissing twice is harmless.
  insert into public.prompt_dismissals (user_id, organisation_id, prompt_key)
  values (a, org_a, 'business-details')
  on conflict do nothing;
  get diagnostics n = row_count;
  assert n = 0, 'duplicate dismissal was not ignored';

  -- Cannot dismiss on behalf of someone else, or in a business you are not in.
  begin
    insert into public.prompt_dismissals (user_id, organisation_id, prompt_key)
    values (b, org_a, 'x');
    raise exception 'FAIL: dismissed a prompt as another user';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.prompt_dismissals (user_id, organisation_id, prompt_key)
    values (a, org_b, 'x');
    raise exception 'FAIL: dismissed a prompt in a business A does not belong to';
  exception when insufficient_privilege then null;
  end;

  -- Keys must be tidy identifiers.
  begin
    insert into public.prompt_dismissals (user_id, organisation_id, prompt_key)
    values (a, org_a, 'Bad Key!');
    raise exception 'FAIL: malformed prompt key was accepted';
  exception when check_violation then null;
  end;

  select count(*) into n from public.prompt_dismissals;
  assert n = 1, 'A should see exactly their own dismissal';
  reset role;

  -- B cannot see A's dismissals.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.prompt_dismissals;
  assert n = 0, 'B can see A''s dismissals';
  delete from public.prompt_dismissals;
  get diagnostics n = row_count;
  assert n = 0, 'B deleted A''s dismissals';
  reset role;

  -- A can undo their own dismissal.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.prompt_dismissals where prompt_key = 'business-details';
  get diagnostics n = row_count;
  assert n = 1, 'A could not remove their own dismissal';
  reset role;

  ----------------------------------------------------------------------
  -- Anonymous access is denied.
  ----------------------------------------------------------------------
  set local role anon;
  begin
    perform count(*) from public.business_profiles;
    raise exception 'FAIL: anon could read business profiles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.prompt_dismissals;
    raise exception 'FAIL: anon could read dismissals';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;

\echo 'business profile tests passed'
