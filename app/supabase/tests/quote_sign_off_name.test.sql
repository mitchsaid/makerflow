-- Who signs a quote (migration 20261120100000): the owner's name and the usual on the business profile, and the choice
-- on a quote (the business name unless chosen otherwise). save_quote_draft carries it; a payload without it keeps the
-- draft's. Another business cannot read or change any of it. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid, extra jsonb default '{}') returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000033a1';
  b uuid := '00000000-0000-4000-8000-0000000033b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  q uuid;
  changed integer;
begin
  insert into auth.users (id, email) values (a, 'so33a@example.test'), (b, 'so33b@example.test');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi Nkosi') returning id into cust;

  -- The business signs unless the maker chooses otherwise; the owner's name is optional.
  assert (select sign_off_as from public.business_profiles where organisation_id = org_a) = 'business', 'the usual should be the business';
  assert (select owner_name is null from public.business_profiles where organisation_id = org_a), 'no owner name to start with';
  update public.business_profiles set owner_name = 'Thandi Nkosi', sign_off_as = 'owner' where organisation_id = org_a;
  assert (select owner_name from public.business_profiles where organisation_id = org_a) = 'Thandi Nkosi', 'the owner name was not saved';
  begin
    update public.business_profiles set sign_off_as = 'someone' where organisation_id = org_a;
    raise exception 'a fifth choice was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set owner_name = '   ' where organisation_id = org_a;
    raise exception 'a blank owner name was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set owner_name = repeat('x', 121) where organisation_id = org_a;
    raise exception 'an owner name of 121 characters was accepted';
  exception when check_violation then null;
  end;

  -- A quote signs with the business unless it says otherwise; a payload without the choice keeps the draft's.
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), '[]'::jsonb);
  assert (select sign_off_as from public.quotes where id = q) = 'business', 'a quote should sign with the business by default';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "owner"}'), '[]'::jsonb);
  assert (select sign_off_as from public.quotes where id = q) = 'owner', 'the choice was not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), '[]'::jsonb);
  assert (select sign_off_as from public.quotes where id = q) = 'owner', 'a payload without the choice should keep it';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "none"}'), '[]'::jsonb);
  assert (select sign_off_as from public.quotes where id = q) = 'none', 'no name was not saved';
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "someone"}'), '[]'::jsonb);
    raise exception 'a quote took a fifth choice';
  exception when check_violation then null;
  end;

  -- Another name (migration 20261121100000): kept with its choice, never without its name, dropped with another choice.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "other", "sign_off_other": "  The Nkosi family "}'), '[]'::jsonb);
  assert (select sign_off_as = 'other' and sign_off_other = 'The Nkosi family' from public.quotes where id = q), 'the other name was not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust), '[]'::jsonb);
  assert (select sign_off_other from public.quotes where id = q) = 'The Nkosi family', 'a payload without the choice should keep the name';
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "other", "sign_off_other": "  "}'), '[]'::jsonb);
    raise exception 'another name was accepted without a name';
  exception when check_violation then null;
  end;
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(cust, '{"sign_off_as": "none"}'), '[]'::jsonb);
  assert (select sign_off_other is null from public.quotes where id = q), 'the other name should go with its choice';
  update public.business_profiles set sign_off_as = 'other', sign_off_other = 'Studio Nkosi' where organisation_id = org_a;
  begin
    update public.business_profiles set sign_off_other = null where organisation_id = org_a;
    raise exception 'the usual took another name without a name';
  exception when check_violation then null;
  end;
  reset role;

  -- Another business sees none of it and changes none of it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.business_profiles where organisation_id = org_a) = 0, 'B can read A''s profile';
  assert (select count(*) from public.quotes where id = q) = 0, 'B can read A''s quote';
  update public.business_profiles set owner_name = 'Mallory', sign_off_as = 'none' where organisation_id = org_a;
  get diagnostics changed = row_count;
  assert changed = 0, 'B changed A''s owner name';
  update public.quotes set sign_off_as = 'business' where id = q;
  get diagnostics changed = row_count;
  assert changed = 0, 'B changed A''s quote';
  reset role;
  assert (select owner_name from public.business_profiles where organisation_id = org_a) = 'Thandi Nkosi', 'A''s owner name changed';
  assert (select sign_off_as from public.quotes where id = q) = 'none', 'A''s quote changed';
  raise notice 'quote sign-off name tests passed';
end
$$;

rollback;
