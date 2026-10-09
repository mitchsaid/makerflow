-- Quote wording and units: optional fields stored as NULL when empty, length limits, who can set
-- the business's wording defaults. Plain SQL, one transaction, rolled back at the end.

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
    'customer_id', null, 'issue_date', '2026-10-05', 'valid_until', '2026-10-19',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

create function pg_temp.line(unit text) returns jsonb language sql as $f$
  select jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Flour',
    'quantity_milli', 2000, 'unit_price_cents', 5000, 'unit', unit)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000010a1';
  c uuid := '00000000-0000-4000-8000-0000000010c1';
  org_a uuid;
  q uuid;
begin
  insert into auth.users (id, email) values (a, 'wa@example.test'), (c, 'wc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Wording on a quote, and a unit on a line
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null,
    pg_temp.quote_json('{"title":"Wedding cake","description":"Three tiers","sign_off":"Yours in sweetness","terms":"Ignored now","payment_instructions":"EFT to 123"}'),
    jsonb_build_array(pg_temp.line('kg')));
  assert (select title from public.quotes where id = q) = 'Wedding cake', 'title not saved';
  assert (select description from public.quotes where id = q) = 'Three tiers', 'description not saved';
  assert (select sign_off from public.quotes where id = q) = 'Yours in sweetness', 'sign-off not saved';
  -- The old Terms box became a term (20261023100000_terms.sql): a payload that still sends it saves without it.
  assert not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'quotes' and column_name = 'terms'),
    'quotes.terms should be gone';
  assert (select payment_instructions from public.quotes where id = q) = 'EFT to 123', 'payment instructions not saved';
  assert (select unit from public.quote_lines where quote_id = q) = 'kg', 'unit not saved';

  -- Saving again with empty text clears them to NULL, never ''.
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json('{"title":"","description":"","sign_off":"","payment_instructions":""}'),
    jsonb_build_array(pg_temp.line('')));
  assert (select title is null and description is null and sign_off is null
                 and payment_instructions is null from public.quotes where id = q), 'empty wording was not NULL';
  assert (select unit is null from public.quote_lines where quote_id = q), 'empty unit was not NULL';

  -- Length limits.
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json(jsonb_build_object('title', repeat('x', 121))), '[]'::jsonb);
    raise exception 'FAIL: a 121-character title was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), jsonb_build_array(pg_temp.line(repeat('u', 21))));
    raise exception 'FAIL: a 21-character unit was accepted';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Products carry a default unit
  ----------------------------------------------------------------------
  insert into public.products (organisation_id, name, unit_price_cents, unit) values (org_a, 'Sourdough', 8000, 'loaf');
  assert (select unit from public.products where name = 'Sourdough') = 'loaf', 'product unit not saved';
  update public.products set unit = 'dozen' where name = 'Sourdough';
  assert (select unit from public.products where name = 'Sourdough') = 'dozen', 'product unit not updated';
  begin
    insert into public.products (organisation_id, name, unit_price_cents, unit) values (org_a, 'Bad', 1, '');
    raise exception 'FAIL: an empty-string unit was accepted';
  exception when check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- The business's wording defaults: owners and admins only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.business_profiles
     set default_sign_off = 'Warmly', payment_instructions = 'EFT'
   where organisation_id = org_a;
  assert (select default_sign_off from public.business_profiles where organisation_id = org_a) = 'Warmly',
    'the owner could not set the default sign-off';
  assert not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'business_profiles' and column_name = 'default_terms'),
    'business_profiles.default_terms should be gone: default terms are library terms now';
  reset role;

  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.business_profiles set default_sign_off = 'Hijacked' where organisation_id = org_a;
  assert (select default_sign_off from public.business_profiles where organisation_id = org_a) = 'Warmly',
    'staff changed the business defaults';
  reset role;

  raise notice 'quote wording tests passed';
end
$$;

rollback;
