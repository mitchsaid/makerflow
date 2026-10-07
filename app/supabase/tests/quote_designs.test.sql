-- Quote designs: a draft's design and options are saved, a sent quote's cannot change, the business
-- default and brand colour are for owners and admins, and the values are limited to sane ones.
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

create function pg_temp.quote_json() returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', null, 'issue_date', '2026-10-14', 'valid_until', '2026-10-28',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000017a1';  -- owner of org A
  s uuid := '00000000-0000-4000-8000-0000000017a2';  -- staff in A
  b uuid := '00000000-0000-4000-8000-0000000017b1';  -- owner of org B
  org_a uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'da@example.test'), (s, 'ds@example.test'), (b, 'db@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, s, 'staff');
  perform pg_temp.as_user(b);
  set local role authenticated;
  perform public.ensure_organisation('B Co');
  reset role;

  ----------------------------------------------------------------------
  -- A quote follows the business's default until it chooses (null)
  ----------------------------------------------------------------------
  perform pg_temp.as_user(s);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select design is null and design_options is null from public.quotes where id = q),
    'a new quote should follow the default';

  -- Any member can pick a design for a draft, and change its options.
  update public.quotes set design = 'warm', design_options = '{"accent":"#b45309","header":"band"}' where id = q;
  assert (select design = 'warm' and design_options ->> 'header' = 'band' from public.quotes where id = q), 'design not saved';
  -- Saving the draft's content again leaves the design alone.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(), '[]'::jsonb);
  assert (select design = 'warm' from public.quotes where id = q), 'saving the draft changed its design';
  -- And back to following the default.
  update public.quotes set design = null, design_options = null where id = q;
  assert (select design is null from public.quotes where id = q), 'design not cleared';

  -- Limits.
  begin
    update public.quotes set design = 'fancy' where id = q;
    raise exception 'FAIL: an unknown design was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.quotes set design_options = '[1,2]' where id = q;
    raise exception 'FAIL: options that are not an object were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.quotes set design_options = jsonb_build_object('x', repeat('a', 700)) where id = q;
    raise exception 'FAIL: oversized options were accepted';
  exception when check_violation then null;
  end;
  reset role;

  -- A sent quote's design cannot change.
  update public.quotes set status = 'sent', design = 'bold' where id = q;
  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.quotes set design = 'soft' where id = q;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote''s design was changed';
  reset role;

  -- Another business cannot change it either.
  perform pg_temp.as_user(b);
  set local role authenticated;
  update public.quotes set design = 'soft' where id = q;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed a design';
  reset role;

  ----------------------------------------------------------------------
  -- The business's default design and brand colour: owners and admins
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.business_profiles
     set brand_color = '#be185d', default_design = 'soft', default_design_options = '{"corners":"round"}'
   where organisation_id = org_a;
  assert (select brand_color = '#be185d' and default_design = 'soft' and default_design_options ->> 'corners' = 'round'
            from public.business_profiles where organisation_id = org_a), 'the default was not saved';
  begin
    update public.business_profiles set brand_color = 'red' where organisation_id = org_a;
    raise exception 'FAIL: a colour name was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set brand_color = '#BE185D' where organisation_id = org_a;
    raise exception 'FAIL: an upper-case colour was accepted (the app writes lower case)';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set default_design = 'fancy' where organisation_id = org_a;
    raise exception 'FAIL: an unknown default design was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.business_profiles set default_design_options = '"x"' where organisation_id = org_a;
    raise exception 'FAIL: default options that are not an object were accepted';
  exception when check_violation then null;
  end;
  reset role;

  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.business_profiles set brand_color = '#000000' where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the brand colour';
  reset role;

  raise notice 'quote designs tests passed';
end
$$;

rollback;
