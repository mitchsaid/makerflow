-- Quote lines that come from products. Plain SQL, one transaction, rolled back at the end.

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
    'customer_id', null, 'issue_date', '2026-10-03', 'valid_until', '2026-10-17',
    'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'country_code', 'ZA', 'currency_code', 'ZAR', 'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0)
$f$;

create function pg_temp.product_line(product uuid, kind text) returns jsonb language sql as $f$
  select jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', kind, 'product_id', product,
    'name', 'Wedding cake', 'quantity_milli', 1000, 'unit_price_cents', 80000))
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000aaa1';
  b uuid := '00000000-0000-4000-8000-00000000bbb1';
  org_a uuid;
  org_b uuid;
  prod_a uuid;
  prod_b uuid;
  qa uuid;
begin
  insert into auth.users (id, email) values (a, 'qlpa@example.test'), (b, 'qlpb@example.test');

  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.products (organisation_id, name, unit_price_cents) values (org_b, 'B cake', 100)
  returning id into prod_b;
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.products (organisation_id, name, unit_price_cents) values (org_a, 'Wedding cake', 80000)
  returning id into prod_a;

  -- A line from A's own product is kept, with where it came from.
  qa := public.save_quote_draft(org_a, null, pg_temp.quote_json(), pg_temp.product_line(prod_a, 'product'));
  assert (select product_id from public.quote_lines where quote_id = qa) = prod_a, 'the product link was not saved';

  -- The line keeps its own price when the product's price changes.
  update public.products set unit_price_cents = 99000 where id = prod_a;
  assert (select unit_price_cents from public.quote_lines where quote_id = qa) = 80000,
    'a product price change moved a quote line';

  -- Another business's product can never be put on a line.
  begin
    perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(), pg_temp.product_line(prod_b, 'product'));
    raise exception 'FAIL: a line used another business''s product';
  exception when foreign_key_violation then null;
  end;
  assert (select product_id from public.quote_lines where quote_id = qa) = prod_a,
    'a refused save changed the lines';

  -- A product line is a product or service line, never a one-off kind.
  begin
    perform public.save_quote_draft(org_a, qa, pg_temp.quote_json(), pg_temp.product_line(prod_a, 'custom'));
    raise exception 'FAIL: a custom line with a product was accepted';
  exception when check_violation then null;
  end;
  reset role;

  raise notice 'quote line product tests passed';
end
$$;

rollback;
