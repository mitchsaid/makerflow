-- Bank details: one set per business; every member reads, ONLY owners write; no delete; another
-- business sees nothing. And the per-quote switch. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(extra jsonb) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', null, 'issue_date', '2026-10-07', 'valid_until', '2026-10-21',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000012a1';  -- owner of org A
  b uuid := '00000000-0000-4000-8000-0000000012b1';  -- owner of org B
  c uuid := '00000000-0000-4000-8000-0000000012c1';  -- staff in A
  d uuid := '00000000-0000-4000-8000-0000000012d1';  -- admin in A
  org_a uuid;
  org_b uuid;
  q uuid;
begin
  insert into auth.users (id, email) values
    (a, 'ba@example.test'), (b, 'bb@example.test'), (c, 'bc@example.test'), (d, 'bd@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff'), (org_a, d, 'admin');

  ----------------------------------------------------------------------
  -- The owner writes
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.business_bank_details (organisation_id, country_code, details)
  values (org_a, 'ZA', '{"holder":"A Co","bank":"FNB","accountNumber":"62123456789","branchCode":"250655"}');
  update public.business_bank_details set details = details || '{"bank":"Nedbank"}', use_reference = false
   where organisation_id = org_a;
  assert (select details ->> 'bank' from public.business_bank_details where organisation_id = org_a) = 'Nedbank',
    'the owner could not change the details';
  assert (select use_reference from public.business_bank_details where organisation_id = org_a) = false, 'use_reference';

  begin
    insert into public.business_bank_details (organisation_id, country_code, details) values (org_a, 'ZA', '{}');
    raise exception 'FAIL: a second set of details was accepted';
  exception when unique_violation then null;
  end;
  begin
    update public.business_bank_details set details = '[]'::jsonb where organisation_id = org_a;
    raise exception 'FAIL: details that are not an object were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_bank_details set details = jsonb_build_object('x', repeat('y', 2100)) where organisation_id = org_a;
    raise exception 'FAIL: oversized details were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_bank_details set organisation_id = org_b where organisation_id = org_a;
    raise exception 'FAIL: the details moved to another business';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.business_bank_details where organisation_id = org_a;
    raise exception 'FAIL: the details were deleted';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Admins and staff read them but cannot change them
  ----------------------------------------------------------------------
  perform pg_temp.as_user(d);
  set local role authenticated;
  assert (select count(*) from public.business_bank_details where organisation_id = org_a) = 1, 'an admin cannot read them';
  update public.business_bank_details set details = '{"holder":"Fraud","bank":"X","accountNumber":"1","branchCode":"2"}'
   where organisation_id = org_a;
  assert (select details ->> 'holder' from public.business_bank_details where organisation_id = org_a) = 'A Co',
    'an admin changed the bank details';
  reset role;

  perform pg_temp.as_user(c);
  set local role authenticated;
  assert (select count(*) from public.business_bank_details where organisation_id = org_a) = 1, 'staff cannot read them';
  update public.business_bank_details set details = '{"holder":"Fraud"}' where organisation_id = org_a;
  assert (select details ->> 'holder' from public.business_bank_details where organisation_id = org_a) = 'A Co',
    'staff changed the bank details';
  reset role;

  -- Admins and staff cannot add details for a business that has none either.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.business_bank_details) = 0, 'another business can read the details';
  begin
    insert into public.business_bank_details (organisation_id, country_code, details) values (org_a, 'ZA', '{}');
    raise exception 'FAIL: another business added details';
  exception when insufficient_privilege or unique_violation then null;
  end;
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_b, d, 'admin');
  perform pg_temp.as_user(d);
  set local role authenticated;
  begin
    insert into public.business_bank_details (organisation_id, country_code, details) values (org_b, 'ZA', '{"holder":"Admin"}');
    raise exception 'FAIL: an admin added bank details';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- The per-quote switch: on by default, can be turned off, carried by the save function
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select show_bank_details from public.quotes where id = q), 'bank details are not on by default';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"show_bank_details": false}'), '[]'::jsonb);
  assert not (select show_bank_details from public.quotes where id = q), 'the switch was not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"show_bank_details": true}'), '[]'::jsonb);
  assert (select show_bank_details from public.quotes where id = q), 'the switch could not be turned back on';
  reset role;

  raise notice 'bank details tests passed';
end
$$;

rollback;
