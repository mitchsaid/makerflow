-- Extras (docs/plans/product-extras.md): shared and product-only extras, save_product keeping ids, the
-- sharing rules (a shared extra changes everywhere, turning it "this product only" copies it), prices by
-- variation, unique shared names, limits, isolation, quote items keep their own copy.
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

create function pg_temp.product(name text, label text default '') returns jsonb language sql as $f$
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 30000, 'unit', '', 'variation_label', label)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000025a1';
  b uuid := '00000000-0000-4000-8000-0000000025b1';
  org_a uuid;
  org_b uuid;
  cake uuid;
  cupcakes uuid;
  wrap uuid;
  wrap2 uuid;
  engraving uuid;
  gold uuid;
  small uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ea25@example.test'), (b, 'eb25@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;

  ----------------------------------------------------------------------
  -- Adding: a shared extra, one that asks for wording, a product-only one
  ----------------------------------------------------------------------
  cake := public.save_product(org_a, null, pg_temp.product('Cake'), '[]'::jsonb, null, '[
    {"name": "Gift wrap", "price_cents": 3000, "shared": true},
    {"name": "Engraving", "price_cents": 5000, "asks_for_wording": true, "text_max": 40, "shared": true},
    {"name": "Gold leaf", "price_cents": 2000, "shared": false}
  ]'::jsonb);
  assert (select count(*) from public.product_extras where product_id = cake) = 3, 'extras were not added';
  assert (select array_agg(e.name order by pe.sort_order) from public.product_extras pe join public.extras e on e.id = pe.extra_id where pe.product_id = cake)
    = array['Gift wrap', 'Engraving', 'Gold leaf'], 'the order was not kept';
  select id into wrap from public.extras where organisation_id = org_a and name = 'Gift wrap';
  select id into engraving from public.extras where organisation_id = org_a and name = 'Engraving';
  select id into gold from public.extras where organisation_id = org_a and name = 'Gold leaf';
  assert (select product_id is null from public.extras where id = wrap), 'a shared extra belongs to a product';
  assert (select product_id = cake from public.extras where id = gold), 'a product-only extra lost its product';
  assert (select asks_for_wording and text_max = 40 from public.extras where id = engraving), 'wording settings were lost';

  ----------------------------------------------------------------------
  -- Reuse: another product picks the shared extra; its price is one price everywhere
  ----------------------------------------------------------------------
  cupcakes := public.save_product(org_a, null, pg_temp.product('Cupcakes'), '[]'::jsonb, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3000, 'shared', true)));
  assert (select count(*) from public.extras where organisation_id = org_a and name = 'Gift wrap') = 1, 'picking a shared extra copied it';
  assert (select count(*) from public.product_extras where extra_id = wrap) = 2, 'the shared extra is not on both products';

  -- Changing its price from one product changes it on the other.
  perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3500, 'shared', true)));
  assert (select price_cents from public.extras where id = wrap) = 3500, 'the shared price did not change';
  assert (select count(*) from public.product_extras where product_id = cake and extra_id = wrap) = 1, 'the cake lost the shared extra';

  -- A shared extra the form did not change is left as it is: an old form must not put an old price back everywhere.
  perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 100, 'shared', true, 'changed', false)));
  assert (select price_cents from public.extras where id = wrap) = 3500, 'an unchanged shared extra was overwritten';
  assert exists (select 1 from public.product_extras where product_id = cupcakes and extra_id = wrap), 'its place on the product was lost';

  -- A shared name is used once; a different case counts as the same.
  begin
    perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
      jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3500, 'shared', true),
                        jsonb_build_object('name', 'GIFT WRAP', 'price_cents', 1, 'shared', true)));
    raise exception 'FAIL: a second shared extra with the same name was accepted';
  exception when unique_violation then null;
  end;

  ----------------------------------------------------------------------
  -- "This product only" on a shared extra other products have: this product gets its own copy
  ----------------------------------------------------------------------
  perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 1000, 'shared', false)));
  assert (select price_cents from public.extras where id = wrap) = 3500, 'the shared extra changed when one product went its own way';
  assert exists (select 1 from public.product_extras where product_id = cake and extra_id = wrap), 'the cake lost the shared extra';
  assert not exists (select 1 from public.product_extras where product_id = cupcakes and extra_id = wrap), 'the cupcakes kept the shared extra';
  select e.id into wrap2 from public.extras e join public.product_extras pe on pe.extra_id = e.id where pe.product_id = cupcakes;
  assert (select product_id = cupcakes and price_cents = 1000 and name = 'Gift wrap' from public.extras where id = wrap2), 'the copy is wrong';

  -- Turned shared again (nobody has the name): it becomes shared. With the name taken, it is refused.
  begin
    perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
      jsonb_build_array(jsonb_build_object('id', wrap2, 'name', 'Gift wrap', 'price_cents', 1000, 'shared', true)));
    raise exception 'FAIL: a shared extra took a name that is already shared';
  exception when unique_violation then null;
  end;
  perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap2, 'name', 'Wrapping', 'price_cents', 1000, 'shared', true)));
  assert (select product_id is null from public.extras where id = wrap2), 'a product-only extra did not become shared';

  -- A shared extra only this product has can be turned "this product only" in place (no copy).
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, jsonb_build_array(
    jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3500, 'shared', true),
    jsonb_build_object('id', engraving, 'name', 'Engraving', 'price_cents', 5000, 'asks_for_wording', true, 'text_max', 40, 'shared', false),
    jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 2000, 'shared', false)));
  assert (select product_id = cake from public.extras where id = engraving), 'a lone shared extra was not made product-only in place';

  ----------------------------------------------------------------------
  -- Removing: a product-only extra goes; a shared one comes off; a shared one nobody has goes
  ----------------------------------------------------------------------
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Gift wrap', 'price_cents', 3500, 'shared', true)));
  assert not exists (select 1 from public.extras where id = gold), 'a removed product-only extra is still there';
  assert not exists (select 1 from public.extras where id = engraving), 'a removed extra is still there';
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '[]'::jsonb);
  assert not exists (select 1 from public.extras where id = wrap), 'a shared extra no product has is still there';
  assert exists (select 1 from public.extras where id = wrap2), 'a shared extra another product has was removed';
  -- No list leaves the extras alone.
  perform public.save_product(org_a, cupcakes, pg_temp.product('Cupcakes'), null, null, null);
  assert (select count(*) from public.product_extras where product_id = cupcakes) = 1, 'a missing list removed extras';

  ----------------------------------------------------------------------
  -- Prices by variation: a product-only extra can cost more on a bigger size
  ----------------------------------------------------------------------
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 'Size'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb, null,
    '[{"name": "Gold leaf", "price_cents": 5000, "shared": false, "price_by_variation": true,
       "prices": [{"variation_index": 0, "price_cents": 5000}, {"variation_index": 1, "price_cents": 12000}]}]'::jsonb);
  select id into gold from public.extras where organisation_id = org_a and name = 'Gold leaf';
  select id into small from public.product_variations where product_id = cake and name = 'Small';
  assert (select price_by_variation from public.extras where id = gold), 'the switch was not kept';
  assert (select count(*) from public.extra_variation_prices where extra_id = gold) = 2, 'prices by size were not stored';
  assert (select price_cents from public.extra_variation_prices where extra_id = gold and variation_id = small) = 5000, 'small price wrong';

  -- Saved with the switch off: the prices go. On again, then a size removed: its price goes.
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 'Size'), null, null,
    jsonb_build_array(jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 5000, 'shared', false)));
  assert (select count(*) from public.extra_variation_prices where extra_id = gold) = 0, 'prices stayed with the switch off';
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 'Size'), null, null,
    jsonb_build_array(jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 5000, 'shared', false, 'price_by_variation', true,
      'prices', '[{"variation_index": 0, "price_cents": 4000}, {"variation_index": 1, "price_cents": 9000}]'::jsonb)));
  assert (select count(*) from public.extra_variation_prices where extra_id = gold) = 2, 'prices were not stored again';
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 'Size'),
    jsonb_build_array(jsonb_build_object('id', small, 'name', 'Small', 'price_cents', 30000)), null, null);
  assert (select count(*) from public.extra_variation_prices where extra_id = gold) = 1, 'a removed size''s price stayed';

  -- A shared extra has no sizes to ask about: its switch is off whatever is sent.
  perform public.save_product(org_a, cake, pg_temp.product('Cake', 'Size'), null, null,
    jsonb_build_array(
      jsonb_build_object('id', gold, 'name', 'Gold leaf', 'price_cents', 5000, 'shared', false, 'price_by_variation', true,
        'prices', '[{"variation_index": 0, "price_cents": 4000}]'::jsonb),
      jsonb_build_object('name', 'Ribbon', 'price_cents', 100, 'shared', true, 'price_by_variation', true,
        'prices', '[{"variation_index": 0, "price_cents": 1}]'::jsonb)));
  assert not (select price_by_variation from public.extras where organisation_id = org_a and name = 'Ribbon'), 'a shared extra was priced by size';
  begin
    update public.extras set price_by_variation = true where organisation_id = org_a and name = 'Ribbon';
    raise exception 'FAIL: a shared extra was priced by variation';
  exception when check_violation then null;
  end;
  -- A price for a size of another product is refused; an extra for one product cannot be on another.
  begin
    insert into public.extra_variation_prices (organisation_id, extra_id, variation_id, price_cents)
    values (org_a, gold, (select id from public.product_variations where product_id <> cake limit 1), 1);
    raise exception 'FAIL: a price for another product''s size was accepted';
  exception when check_violation or foreign_key_violation then null;
  end;
  begin
    insert into public.product_extras (organisation_id, product_id, extra_id) values (org_a, cupcakes, gold);
    raise exception 'FAIL: an extra for one product was put on another';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Rules: names, prices, limits
  ----------------------------------------------------------------------
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '[{"name": "", "price_cents": 1, "shared": false}]'::jsonb);
    raise exception 'FAIL: an extra with no name was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '[{"name": "X", "price_cents": -1, "shared": false}]'::jsonb);
    raise exception 'FAIL: a negative price was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '[{"name": "X", "price_cents": 1, "text_max": 501, "shared": false}]'::jsonb);
    raise exception 'FAIL: an over-long wording limit was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '{"not": "a list"}'::jsonb);
    raise exception 'FAIL: extras that are not a list were accepted';
  exception when invalid_parameter_value then null;
  end;
  -- A product with the most it can have still saves again (the limit counts new rows only).
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
    (select jsonb_agg(jsonb_build_object('name', 'F' || i, 'price_cents', 1, 'shared', false)) from generate_series(1, 40) i));
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
    (select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'price_cents', 2, 'shared', false) order by pe.sort_order)
       from public.product_extras pe join public.extras e on e.id = pe.extra_id where pe.product_id = cake));
  assert (select count(*) from public.product_extras where product_id = cake) = 40, 'a full product lost extras on a second save';
  assert (select bool_and(price_cents = 2) from public.extras e join public.product_extras pe on pe.extra_id = e.id where pe.product_id = cake), 'a full product did not save its changes';
  begin
    perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
      (select jsonb_agg(jsonb_build_object('name', 'E' || i, 'price_cents', 1, 'shared', false)) from generate_series(1, 41) i));
    raise exception 'FAIL: 41 extras were accepted';
  exception when program_limit_exceeded then null;
  end;

  ----------------------------------------------------------------------
  -- A quote item keeps its own copy, whatever happens to the extra
  ----------------------------------------------------------------------
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
    '[{"name": "Gift box", "price_cents": 3000, "shared": true}]'::jsonb);
  select id into wrap from public.extras where organisation_id = org_a and name = 'Gift box';
  q := public.save_quote_draft(org_a, null,
    jsonb_build_object('issue_date', '2026-10-09', 'valid_until', '2026-10-23', 'country_code', 'ZA', 'currency_code', 'ZAR'),
    jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'product', 'product_id', cake, 'name', 'Cake',
      'quantity_milli', 12000, 'unit_price_cents', 30000,
      'options', jsonb_build_array(jsonb_build_object('group_id', null, 'group', 'Extras', 'kind', 'any', 'value_id', wrap,
        'value', 'Gift box', 'amount_cents', 3000, 'quantity_milli', 1000)))));
  assert (select options -> 0 ->> 'quantity_milli' from public.quote_lines where quote_id = q) = '1000', 'the item did not keep the quantity';
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null, '[]'::jsonb);
  assert (select options -> 0 ->> 'value' from public.quote_lines where quote_id = q) = 'Gift box', 'the item lost its copy';
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees and changes nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product(org_a, cake, pg_temp.product('Cake'), null, null,
    '[{"name": "Secret", "price_cents": 1, "shared": true}, {"name": "Mine", "price_cents": 1, "shared": false}]'::jsonb);
  select id into wrap from public.extras where organisation_id = org_a and name = 'Secret';
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.extras where organisation_id = org_a) = 0, 'another business can see extras';
  assert (select count(*) from public.product_extras where product_id = cake) = 0, 'another business can see product extras';
  update public.extras set price_cents = 99 where id = wrap;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed an extra';
  delete from public.extras where id = wrap;
  get diagnostics n = row_count;
  assert n = 0, 'another business deleted an extra';
  begin
    perform public.save_product(org_b, cake, pg_temp.product('Hijack'), null, null, '[]'::jsonb);
    raise exception 'FAIL: another business changed a product';
  exception when no_data_found then null;
  end;
  -- A shared extra of another business cannot be picked by id: a new one is made instead.
  perform public.save_product(org_b, null, pg_temp.product('Own'), '[]'::jsonb, null,
    jsonb_build_array(jsonb_build_object('id', wrap, 'name', 'Secret', 'price_cents', 5, 'shared', true)));
  assert (select price_cents from public.extras where organisation_id = org_a and name = 'Secret') is null, 'unreadable';
  reset role;
  assert (select price_cents from public.extras where id = wrap) = 1, 'another business changed a shared extra by id';
  assert (select count(*) from public.extras where organisation_id = org_b and name = 'Secret') = 1, 'the other business could not make its own';

  raise notice 'extras tests passed';
end
$$;

rollback;
