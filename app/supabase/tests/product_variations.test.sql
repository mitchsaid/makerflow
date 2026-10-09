-- Product variations: save_product keeps, adds and removes them in one go; one usual at most; the
-- list needs a name; the "from" price; limits; isolation; quote items keep their copy when a
-- variation goes. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.product(name text, price bigint, label text) returns jsonb language sql as $f$
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', price,
    'unit', '', 'variation_label', label)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000020a1';
  b uuid := '00000000-0000-4000-8000-0000000020b1';
  c uuid := '00000000-0000-4000-8000-0000000020c1';  -- staff in A
  org_a uuid;
  org_b uuid;
  cake uuid;
  plain uuid;
  b_product uuid;
  small uuid;
  large uuid;
  b_var uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'va@example.test'), (b, 'vb@example.test'), (c, 'vc@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  b_product := public.save_product(org_b, null, pg_temp.product('B cake', 100, 'Size'),
    '[{"name": "Only", "price_cents": 100}]'::jsonb);
  select id into b_var from public.product_variations where product_id = b_product;
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- Adding a product with variations
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product(org_a, null, pg_temp.product('Cake', 99999, 'Size'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000, "usual": true}]'::jsonb);
  assert (select count(*) from public.product_variations where product_id = cake) = 2, 'variations were not added';
  assert (select unit_price_cents from public.products where id = cake) = 30000, 'the product price should be the lowest variation';
  assert (select variation_label from public.products where id = cake) = 'Size', 'the list name was not kept';
  select id into small from public.product_variations where product_id = cake and name = 'Small';
  select id into large from public.product_variations where product_id = cake and name = 'Large';
  assert (select usual from public.product_variations where id = large), 'the usual one was not marked';
  assert (select array_agg(name order by sort_order) from public.product_variations where product_id = cake) = array['Small', 'Large'],
    'the order was not kept';

  -- A product without variations keeps its own price and no list name.
  plain := public.save_product(org_a, null, pg_temp.product('Card', 2500, 'Size'), '[]'::jsonb);
  assert (select unit_price_cents = 2500 and variation_label is null from public.products where id = plain),
    'a product without variations should keep its price and have no list name';

  -- Changing: keep Small (renamed, same id), drop Large, add Medium as usual, reorder.
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, 'Tiers'),
    jsonb_build_array(
      jsonb_build_object('name', 'Medium', 'price_cents', 45000, 'usual', true),
      jsonb_build_object('id', small, 'name', 'Small round', 'price_cents', 32000)));
  assert (select name from public.product_variations where id = small) = 'Small round', 'a kept variation lost its id';
  assert not exists (select 1 from public.product_variations where id = large), 'a removed variation is still there';
  assert (select count(*) from public.product_variations where product_id = cake and usual) = 1, 'more than one usual';
  assert (select name from public.product_variations where product_id = cake and usual) = 'Medium', 'the usual one moved wrongly';
  assert (select array_agg(name order by sort_order) from public.product_variations where product_id = cake) = array['Medium', 'Small round'],
    'the new order was not kept';
  assert (select unit_price_cents from public.products where id = cake) = 32000, 'the from price did not follow';

  -- No list at all leaves the variations and their name alone (a form that doesn't know about them).
  perform public.save_product(org_a, cake, pg_temp.product('Cake renamed', 1, null), null);
  assert (select count(*) from public.product_variations where product_id = cake) = 2, 'a missing list removed variations';
  assert (select variation_label from public.products where id = cake) = 'Tiers', 'a missing list cleared the name';
  assert (select name from public.products where id = cake) = 'Cake renamed', 'the product was not saved';
  -- The from price is kept, not the price sent, while variations stay.
  assert (select unit_price_cents from public.products where id = cake) = 32000, 'the from price should stay the lowest variation';

  -- Rules.
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, ''), '[{"name": "One", "price_cents": 1}]'::jsonb);
    raise exception 'FAIL: variations without a list name were accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, 'Size'),
      '[{"name": "A", "price_cents": 1, "usual": true}, {"name": "B", "price_cents": 2, "usual": true}]'::jsonb);
    raise exception 'FAIL: two usual variations were accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, 'Size'), '[{"name": "", "price_cents": 1}]'::jsonb);
    raise exception 'FAIL: a nameless variation was accepted';
  exception when check_violation or not_null_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, 'Size'),
      (select jsonb_agg(jsonb_build_object('name', 'V' || i, 'price_cents', i)) from generate_series(1, 51) i));
    raise exception 'FAIL: 51 variations were accepted';
  exception when program_limit_exceeded then null;
  end;

  -- Someone else's variation id is never taken over: it is treated as a new one.
  perform public.save_product(org_a, plain, pg_temp.product('Card', 2500, 'Size'),
    jsonb_build_array(jsonb_build_object('id', b_var, 'name', 'Mine', 'price_cents', 1)));
  reset role;
  assert (select product_id from public.product_variations where id = b_var) = b_product, 'another business''s variation was moved';
  assert (select count(*) from public.product_variations where product_id = plain) = 1, 'the variation was not added as new';

  -- Another business cannot change A's product, nor see its variations.
  perform pg_temp.as_user(b);
  set local role authenticated;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Hijack', 1, ''), '[]'::jsonb);
    raise exception 'FAIL: another business changed a product';
  exception when no_data_found or insufficient_privilege then null;
  end;
  assert (select count(*) from public.product_variations where product_id = cake) = 0, 'another business can see variations';
  update public.product_variations set price_cents = 1 where id = small;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed a variation';
  reset role;

  -- Staff manage variations like products.
  perform pg_temp.as_user(c);
  set local role authenticated;
  update public.product_variations set price_cents = 33000 where id = small;
  get diagnostics n = row_count;
  assert n = 1, 'staff could not change a variation';
  reset role;

  ----------------------------------------------------------------------
  -- Quote items
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null,
    jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23', 'country_code', 'ZA', 'currency_code', 'ZAR'),
    jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'product', 'product_id', cake, 'name', 'Cake',
      'quantity_milli', 1000, 'unit_price_cents', 32000,
      'variation_id', small, 'variation_label', 'Tiers', 'variation_name', 'Small round')));
  assert (select variation_name from public.quote_lines where quote_id = q) = 'Small round', 'the item did not keep its variation';

  -- Another business's variation cannot be put on an item.
  begin
    perform public.save_quote_draft(org_a, q,
      jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23'),
      jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'product', 'product_id', cake, 'name', 'Cake',
        'quantity_milli', 1000, 'unit_price_cents', 100,
        'variation_id', b_var, 'variation_label', 'Size', 'variation_name', 'Only')));
    raise exception 'FAIL: another business''s variation was put on an item';
  exception when foreign_key_violation then null;
  end;

  -- A variation on a one-off item, or a name without its list name, is refused.
  begin
    perform public.save_quote_draft(org_a, q,
      jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23'),
      jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Thing',
        'quantity_milli', 1000, 'unit_price_cents', 100, 'variation_label', '', 'variation_name', 'Large')));
    raise exception 'FAIL: a variation name without a list name was accepted';
  exception when check_violation then null;
  end;

  -- Removing the variation keeps the item's copy of its words.
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 0, 'Tiers'),
    '[{"name": "Medium", "price_cents": 45000, "usual": true}]'::jsonb);
  assert (select variation_id is null and variation_name = 'Small round' from public.quote_lines where quote_id = q),
    'removing a variation should clear only the link';
  reset role;

  raise notice 'product variations tests passed';
end
$$;

rollback;
