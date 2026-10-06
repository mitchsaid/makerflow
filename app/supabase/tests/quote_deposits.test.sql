-- Quote deposits: the terms are saved with the draft (and an older payload still saves with none);
-- the database limits the values; the business default is changed by owners and admins only.
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

create function pg_temp.quote_json(extra jsonb) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', null, 'issue_date', '2026-10-10', 'valid_until', '2026-10-24',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000014a1';  -- owner of org A
  c uuid := '00000000-0000-4000-8000-0000000014c1';  -- staff in A
  d uuid := '00000000-0000-4000-8000-0000000014d1';  -- admin in A
  org_a uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'da@example.test'), (c, 'dc@example.test'), (d, 'dd@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff'), (org_a, d, 'admin');

  ----------------------------------------------------------------------
  -- The terms are saved with the draft; an older payload means no deposit
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select deposit_kind = 'none' and deposit_value = 0 and balance_due = 'handover' and balance_due_date is null
            from public.quotes where id = q), 'an older payload should mean no deposit, balance on handover';

  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json('{"deposit_kind":"percent","deposit_value":5000,"balance_due":"date","balance_due_date":"2026-11-14"}'), '[]'::jsonb);
  assert (select deposit_kind = 'percent' and deposit_value = 5000 and balance_due = 'date' and balance_due_date = '2026-11-14'
            from public.quotes where id = q), 'the deposit terms were not saved';

  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json('{"deposit_kind":"fixed","deposit_value":125000,"balance_due":"handover"}'), '[]'::jsonb);
  assert (select deposit_kind = 'fixed' and deposit_value = 125000 and balance_due_date is null
            from public.quotes where id = q), 'a fixed deposit with the balance on handover was not saved';

  -- An older app (no deposit keys) saving a draft that has a deposit leaves the deposit alone.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select deposit_kind = 'fixed' and deposit_value = 125000 and balance_due = 'handover'
            from public.quotes where id = q), 'an older payload dropped the deposit';
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json('{"deposit_kind":"percent","deposit_value":5000,"balance_due":"date","balance_due_date":"2026-11-14"}'), '[]'::jsonb);
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select balance_due = 'date' and balance_due_date = '2026-11-14' from public.quotes where id = q),
    'an older payload dropped the balance date';
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json('{"deposit_kind":"fixed","deposit_value":125000,"balance_due":"handover","balance_due_date":null}'), '[]'::jsonb);

  ----------------------------------------------------------------------
  -- The database limits the values
  ----------------------------------------------------------------------
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"deposit_kind":"percent","deposit_value":10001}'), '[]'::jsonb);
    raise exception 'FAIL: a deposit above 100 percent was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"deposit_kind":"fixed","deposit_value":-1}'), '[]'::jsonb);
    raise exception 'FAIL: a negative deposit was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"deposit_kind":"lottery","deposit_value":1}'), '[]'::jsonb);
    raise exception 'FAIL: an unknown deposit kind was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"deposit_kind":"none","deposit_value":500}'), '[]'::jsonb);
    raise exception 'FAIL: a value with no deposit was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"balance_due":"date"}'), '[]'::jsonb);
    raise exception 'FAIL: a by-date balance with no date was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"balance_due":"handover","balance_due_date":"2026-11-14"}'), '[]'::jsonb);
    raise exception 'FAIL: a date with the balance on handover was accepted';
  exception when check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- The business default: owners and admins change it, staff do not
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  assert (select default_deposit_kind = 'none' and default_deposit_value = 0
            from public.business_profiles where organisation_id = org_a), 'a new business should have no default deposit';
  update public.business_profiles set default_deposit_kind = 'percent', default_deposit_value = 5000 where organisation_id = org_a;
  assert (select default_deposit_value from public.business_profiles where organisation_id = org_a) = 5000, 'the owner could not set the default';
  begin
    update public.business_profiles set default_deposit_kind = 'percent', default_deposit_value = 20000 where organisation_id = org_a;
    raise exception 'FAIL: a default above 100 percent was accepted';
  exception when check_violation then null;
  end;
  reset role;

  perform pg_temp.as_user(d);
  set local role authenticated;
  update public.business_profiles set default_deposit_kind = 'fixed', default_deposit_value = 100000 where organisation_id = org_a;
  assert (select default_deposit_kind from public.business_profiles where organisation_id = org_a) = 'fixed', 'an admin could not change the default';
  reset role;

  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.business_profiles set default_deposit_kind = 'none', default_deposit_value = 0 where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the default deposit';
  reset role;

  raise notice 'quote deposits tests passed';
end
$$;

rollback;
