-- Delete my account (migration 20261101100000): server only, deletes the businesses the person is alone in (every
-- table with an organisation_id ends up empty for them), keeps businesses that have other people, refuses the only
-- owner of a shared business and changes nothing then, and reminds us to rework it when invoices exist. Plain SQL,
-- one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', null, 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.line(i int, name text) returns jsonb language sql as $f$
  select jsonb_build_object('sort_order', i, 'kind', 'custom', 'name', name,
    'quantity_milli', 1000, 'unit_price_cents', 100000)
$f$;

/** How many rows a business has, over every table that has an organisation_id column. */
create function pg_temp.rows_of(org uuid) returns integer language plpgsql as $f$
declare t text; n integer; total integer := 0;
begin
  for t in
    select c.table_name from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'organisation_id'
  loop
    execute format('select count(*) from public.%I where organisation_id = $1', t) into n using org;
    total := total + n;
  end loop;
  return total + (select count(*) from public.organisations where id = org)::integer;
end
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000041a1';   -- alone in a business with real data
  b uuid := '00000000-0000-4000-8000-0000000041b1';   -- co-owns a shared business
  c uuid := '00000000-0000-4000-8000-0000000041c1';   -- the other owner, and the only owner of another shared one
  d uuid := '00000000-0000-4000-8000-0000000041d1';   -- staff in c's business
  e uuid := '00000000-0000-4000-8000-0000000041e1';   -- no business at all
  org_a uuid; org_shared uuid; org_c uuid; org_b_alone uuid;
  cust uuid; q uuid; job uuid; img uuid := gen_random_uuid();
  stamp timestamptz;
  result jsonb;
  before_c integer;
begin
  insert into auth.users (id, email) values
    (a, 'da@example.test'), (b, 'db@example.test'), (c, 'dc@example.test'), (d, 'dd@example.test'), (e, 'de@example.test');

  ----------------------------------------------------------------------
  -- A: alone in a business that has real data in many tables
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'A customer') returning id into cust;
  insert into public.products (organisation_id, kind, name, unit_price_cents) values (org_a, 'product', 'Cake', 50000);
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Flour', 'kg', 1000, 2500);
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(pg_temp.line(0, 'Cake')));
  insert into public.prompt_dismissals (user_id, organisation_id, prompt_key) values (a, org_a, 'business_types');
  reset role;
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img, org_a, 'logo', 'image/png', 10, 10, 100, 50);
  select updated_at into stamp from public.quotes where id = q;
  perform public.send_quote(org_a, q, a, 'marked', stamp, jsonb_build_object('number', 'QT-0001', 'version', 1), 1, 1, 1);
  job := public.create_job(org_a, a, cust, 'none', null, null, null,
    jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Shelf', 'quantityMilli', 1000)));
  assert pg_temp.rows_of(org_a) > 10, 'the test business has too little in it to prove anything';
  assert (select count(*) from public.quote_versions where organisation_id = org_a) = 1, 'no sent quote version';

  ----------------------------------------------------------------------
  -- Server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.delete_account(a);
    raise exception 'FAIL: a signed-in user called delete_account';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role anon;
  begin
    perform public.delete_account(a);
    raise exception 'FAIL: anon called delete_account';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert pg_temp.rows_of(org_a) > 10, 'a refused call deleted something';

  ----------------------------------------------------------------------
  -- Shared businesses: B co-owns one with C; C is the only owner of one with staff D
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_shared := public.ensure_organisation('Shared Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_shared, c, 'owner');
  perform pg_temp.as_user(c);
  set local role authenticated;
  org_c := public.ensure_organisation('C was here first Co');
  reset role;
  -- (ensure_organisation returns C's first business, which is the shared one: make C's own, with D as staff)
  delete from public.memberships where organisation_id = org_shared and user_id = c;
  org_c := (select o.id from public.organisations o where o.name = 'C was here first Co');
  if org_c is null then
    insert into public.organisations (name) values ('C Co') returning id into org_c;
  end if;
  insert into public.memberships (organisation_id, user_id, role) values (org_c, c, 'owner') on conflict do nothing;
  insert into public.memberships (organisation_id, user_id, role) values (org_c, d, 'staff') on conflict do nothing;
  insert into public.memberships (organisation_id, user_id, role) values (org_shared, c, 'owner') on conflict do nothing;

  -- C is the only owner of org_c, which has D too: refused, naming the business, and nothing changes.
  before_c := pg_temp.rows_of(org_c) + pg_temp.rows_of(org_shared);
  set local role service_role;
  begin
    perform public.delete_account(c);
    raise exception 'FAIL: the only owner of a shared business was allowed to delete their account';
  exception when sqlstate '55006' then null;
  end;
  reset role;
  assert pg_temp.rows_of(org_c) + pg_temp.rows_of(org_shared) = before_c, 'a refused delete changed something';
  assert exists (select 1 from public.memberships where user_id = c and organisation_id = org_c), 'a refusal removed a membership';
  assert exists (select 1 from public.memberships where user_id = c and organisation_id = org_shared), 'a refusal removed a membership';

  ----------------------------------------------------------------------
  -- B co-owns the shared business and has no other business: it stays, B's membership goes with their sign-in
  ----------------------------------------------------------------------
  set local role service_role;
  result := public.delete_account(b);
  reset role;
  assert result -> 'organisations' = '[]'::jsonb, 'a shared business was reported deleted';
  assert exists (select 1 from public.organisations where id = org_shared), 'a shared business was deleted';
  -- (The server then deletes the sign-in, which removes the membership by cascade.)
  delete from auth.users where id = b;
  assert not exists (select 1 from public.memberships where user_id = b), 'the membership stayed after the sign-in went';
  assert exists (select 1 from public.memberships where user_id = c and organisation_id = org_shared), 'the other owner was affected';

  ----------------------------------------------------------------------
  -- A: everything goes, and the pictures are listed so the files can be removed
  ----------------------------------------------------------------------
  set local role service_role;
  result := public.delete_account(a);
  reset role;
  assert result -> 'organisations' = to_jsonb(array[org_a]), 'the deleted business was not reported';
  assert result -> 'pictures' = jsonb_build_array(jsonb_build_object('organisationId', org_a, 'id', img)), 'the picture was not reported';
  assert pg_temp.rows_of(org_a) = 0, 'the business left rows behind in some table';
  assert not exists (select 1 from public.quote_versions where organisation_id = org_a), 'a sent quote version was left';
  assert not exists (select 1 from public.jobs where organisation_id = org_a), 'a job was left';
  delete from auth.users where id = a;
  assert not exists (select 1 from public.prompt_dismissals where user_id = a), 'the dismissals stayed';
  assert not exists (select 1 from public.profiles where id = a), 'the profile stayed';

  ----------------------------------------------------------------------
  -- Someone with no business at all is fine
  ----------------------------------------------------------------------
  set local role service_role;
  result := public.delete_account(e);
  reset role;
  assert result = '{"organisations": [], "pictures": []}'::jsonb, 'a person with no business got something back';
  begin
    set local role service_role;
    perform public.delete_account(null);
    raise exception 'FAIL: no person was accepted';
  exception when sqlstate '22023' then reset role;
  end;

  ----------------------------------------------------------------------
  -- Links between a business's own tables that do NOT cascade stop a parent being deleted while a child exists.
  -- delete_account deletes children first for the ones below. A new one must be added to the function (in order)
  -- and to this list.
  ----------------------------------------------------------------------
  assert (
    select array_agg(conrelid::regclass::text || '->' || confrelid::regclass::text order by conrelid::regclass::text, confrelid::regclass::text)
      from pg_constraint
     where contype = 'f' and connamespace = 'public'::regnamespace and confdeltype in ('a', 'r')
       and confrelid::regclass::text <> 'organisations'
  ) = array[
    'business_profiles->images', 'job_items->images', 'jobs->customers', 'jobs->quotes',
    'product_option_values->images', 'product_variations->images', 'products->images',
    'quote_lines->products', 'quote_versions->quotes', 'quotes->customers'
  ], 'a link between tables that does not cascade was added or removed: teach delete_account (and this list) about it';

  ----------------------------------------------------------------------
  -- Issued invoices and credit notes must never be deleted. None exist yet; when a table for them does, this
  -- function has to keep them (docs/plans/delete-account.md, decision 4) before this test is changed.
  ----------------------------------------------------------------------
  assert to_regclass('public.invoices') is null and to_regclass('public.credit_notes') is null,
    'an invoices or credit notes table now exists: rework delete_account to keep issued documents, then update this test';

  raise notice 'delete account tests passed';
end
$$;

rollback;
