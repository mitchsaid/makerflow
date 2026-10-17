-- Quantity prices (docs/plans/quantity-prices-and-steps.md, slice 1, and 20261109100000: per variation, percent or
-- amount): a product's "from this quantity, this much off" rows. Isolation between businesses, members manage them, session required (the shared guard also checks the
-- policy exists), limits and bounds, one row per quantity, and save_product_layers: null leaves them, a list replaces
-- them, a bad list saves nothing. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.product(name text) returns jsonb language sql as $f$
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 10000, 'unit', '', 'variation_label', '')
$f$;

create function pg_temp.sized(name text) returns jsonb language sql as $f$
  select jsonb_build_object('kind', 'product', 'name', name, 'description', '', 'unit_price_cents', 0, 'unit', '', 'variation_label', 'Size')
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000028a1';
  b uuid := '00000000-0000-4000-8000-0000000028b1';
  c uuid := '00000000-0000-4000-8000-0000000028c1';
  org_a uuid;
  org_b uuid;
  cake uuid;
  other uuid;
  tea uuid;
  wedding uuid;
  small uuid;
  large uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'qa28@example.test'), (b, 'qb28@example.test'), (c, 'qc28@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- A product is saved with its quantity prices; they are read back
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  cake := public.save_product_layers(org_a, null, pg_temp.product('Cupcakes'), null, null, null,
    '[{"from_quantity_milli": 10000, "percent_off_bp": 1000}, {"from_quantity_milli": 50000, "percent_off_bp": 2500}]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 2, 'the quantity prices were not saved';
  assert (select percent_off_bp from public.product_price_breaks where product_id = cake and from_quantity_milli = 50000) = 2500, 'wrong percent';

  ----------------------------------------------------------------------
  -- null leaves them as they are; a list replaces them; an empty list removes them
  ----------------------------------------------------------------------
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null, null);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 2, 'null should leave the quantity prices alone';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
    '[{"from_quantity_milli": 12000, "percent_off_bp": 500}]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 1, 'a list should replace the quantity prices';
  assert (select from_quantity_milli from public.product_price_breaks where product_id = cake) = 12000, 'the new row was not kept';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null, '[]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 0, 'an empty list should remove them';

  ----------------------------------------------------------------------
  -- A bad list saves nothing (not even the product's own changes): the whole call is one transaction
  ----------------------------------------------------------------------
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
    '[{"from_quantity_milli": 10000, "percent_off_bp": 1000}]'::jsonb);
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null,
      '[{"from_quantity_milli": 10000, "percent_off_bp": 1000}, {"from_quantity_milli": 10000, "percent_off_bp": 2000}]'::jsonb);
    raise exception 'a repeated quantity was accepted';
  exception when unique_violation then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null,
      '[{"from_quantity_milli": 10000, "percent_off_bp": 0}]'::jsonb);
    raise exception 'a percent of zero was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null,
      '[{"from_quantity_milli": 10000, "percent_off_bp": 10000}]'::jsonb);
    raise exception 'a percent of 100 or more was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null,
      '[{"from_quantity_milli": 0, "percent_off_bp": 1000}]'::jsonb);
    raise exception 'a quantity of zero was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, '{"a": 1}'::jsonb);
    raise exception 'something that is not a list was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null, '[{"from_quantity_milli": "x", "percent_off_bp": 5}]'::jsonb);
    raise exception 'a row that is not numbers was accepted';
  exception when sqlstate '22023' then null;
  end;
  assert (select name from public.products where id = cake) = 'Cupcakes', 'a refused list should not have renamed the product';
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 1, 'a refused list should have left the rows alone';

  ----------------------------------------------------------------------
  -- At most 10 per product
  ----------------------------------------------------------------------
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
    (select jsonb_agg(jsonb_build_object('from_quantity_milli', i * 1000, 'percent_off_bp', 100 + i)) from generate_series(1, 10) i));
  tea := public.save_product_layers(org_a, null, pg_temp.product('Tea'), null, null, null, '[{"from_quantity_milli": 2000, "percent_off_bp": 500}]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 10, 'ten should be allowed';
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
      (select jsonb_agg(jsonb_build_object('from_quantity_milli', i * 1000, 'percent_off_bp', 100 + i)) from generate_series(1, 11) i));
    raise exception 'eleven were accepted';
  exception when sqlstate '54000' then null;
  end;
  begin
    insert into public.product_price_breaks (organisation_id, product_id, from_quantity_milli, percent_off_bp) values (org_a, cake, 99000, 100);
    raise exception 'an eleventh row was inserted directly';
  exception when sqlstate '54000' then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees none, cannot save over the product, cannot point a row at it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.product_price_breaks;
  assert n = 0, 'another business can read quantity prices';
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Mine now'), null, null, null, '[]'::jsonb);
    raise exception 'another business saved over the product';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    insert into public.product_price_breaks (organisation_id, product_id, from_quantity_milli, percent_off_bp) values (org_b, tea, 1000, 100);
    raise exception 'a row was pointed at another business''s product';
  exception when foreign_key_violation then null;
  end;
  other := public.save_product_layers(org_b, null, pg_temp.product('Candles'), null, null, null, '[{"from_quantity_milli": 5000, "percent_off_bp": 1500}]'::jsonb);
  assert (select count(*) from public.product_price_breaks) = 1, 'B should see only its own';
  reset role;

  ----------------------------------------------------------------------
  -- Any member manages them (staff included)
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null, '[{"from_quantity_milli": 24000, "percent_off_bp": 1200}]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = cake) = 1, 'staff could not save quantity prices';
  reset role;


  ----------------------------------------------------------------------
  -- An amount instead of a percent, and exactly one of the two
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
    '[{"from_quantity_milli": 10000, "amount_off_cents": 1500}, {"from_quantity_milli": 20000, "percent_off_bp": 2000}]'::jsonb);
  assert (select amount_off_cents from public.product_price_breaks where product_id = cake and from_quantity_milli = 10000) = 1500, 'the amount was not kept';
  assert (select percent_off_bp is null from public.product_price_breaks where product_id = cake and from_quantity_milli = 10000), 'a row with an amount has a percent too';
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
      '[{"from_quantity_milli": 10000, "percent_off_bp": 1000, "amount_off_cents": 500}]'::jsonb);
    raise exception 'a row with both a percent and an amount was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null, '[{"from_quantity_milli": 10000}]'::jsonb);
    raise exception 'a row with neither was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
      '[{"from_quantity_milli": 10000, "amount_off_cents": 0}]'::jsonb);
    raise exception 'an amount of nothing was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
      '[{"from_quantity_milli": 10000, "amount_off_cents": "5"}]'::jsonb);
    raise exception 'an amount that is text was accepted';
  exception when sqlstate '22023' then null;
  end;
  -- The product costs 100,00: taking off that much or more is refused, and nothing is saved.
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Renamed'), null, null, null,
      '[{"from_quantity_milli": 10000, "amount_off_cents": 10000}]'::jsonb);
    raise exception 'taking off the whole price was accepted';
  exception when sqlstate '22023' then null;
  end;
  assert (select name from public.products where id = cake) = 'Cupcakes', 'a refused amount renamed the product';
  perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
    '[{"from_quantity_milli": 10000, "amount_off_cents": 9999}]'::jsonb);
  reset role;

  ----------------------------------------------------------------------
  -- Per variation: each variation has its own rows; none belong to the product itself
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  wedding := public.save_product_layers(org_a, null, pg_temp.sized('Wedding cake'),
    '[{"name": "Small", "price_cents": 30000}, {"name": "Large", "price_cents": 60000}]'::jsonb, null, null,
    '[{"from_quantity_milli": 2000, "percent_off_bp": 1000, "variation": 0},
      {"from_quantity_milli": 2000, "amount_off_cents": 10000, "variation": 1},
      {"from_quantity_milli": 5000, "amount_off_cents": 20000, "variation": 1}]'::jsonb);
  select id into small from public.product_variations where product_id = wedding and name = 'Small';
  select id into large from public.product_variations where product_id = wedding and name = 'Large';
  assert (select count(*) from public.product_price_breaks where product_id = wedding and variation_id = small) = 1, 'small has the wrong rows';
  assert (select count(*) from public.product_price_breaks where product_id = wedding and variation_id = large) = 2, 'large has the wrong rows';
  assert (select amount_off_cents from public.product_price_breaks where variation_id = large and from_quantity_milli = 5000) = 20000, 'the amount for large was lost';
  -- (the same quantity on two variations is fine; on one variation twice is not)
  begin
    perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
      '[{"from_quantity_milli": 2000, "percent_off_bp": 1000, "variation": 0}, {"from_quantity_milli": 2000, "percent_off_bp": 500, "variation": 0}]'::jsonb);
    raise exception 'a quantity repeated on one variation was accepted';
  exception when unique_violation then null;
  end;
  -- An amount is taken from the variation's own price: 300,00 is not less than Small's 300,00.
  begin
    perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
      '[{"from_quantity_milli": 2000, "amount_off_cents": 30000, "variation": 0}]'::jsonb);
    raise exception 'taking off all of the small price was accepted';
  exception when sqlstate '22023' then null;
  end;
  perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
    '[{"from_quantity_milli": 2000, "amount_off_cents": 30000, "variation": 1}]'::jsonb);
  -- A variation that is not there, a row for the product when it has variations, and a nonsense place.
  begin
    perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
      '[{"from_quantity_milli": 2000, "percent_off_bp": 500, "variation": 7}]'::jsonb);
    raise exception 'a row for a variation that is not there was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
      '[{"from_quantity_milli": 2000, "percent_off_bp": 500}]'::jsonb);
    raise exception 'a row for the product itself was accepted when it has variations';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
      '[{"from_quantity_milli": 2000, "percent_off_bp": 500, "variation": "a"}]'::jsonb);
    raise exception 'a variation place that is text was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.save_product_layers(org_a, cake, pg_temp.product('Cupcakes'), null, null, null,
      '[{"from_quantity_milli": 2000, "percent_off_bp": 500, "variation": 0}]'::jsonb);
    raise exception 'a row for a variation was accepted on a product with none';
  exception when sqlstate '22023' then null;
  end;
  -- Ten for each variation, not ten for the product.
  perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'), null, null, null,
    (select jsonb_agg(jsonb_build_object('from_quantity_milli', i * 1000, 'percent_off_bp', 100 + i, 'variation', v))
       from generate_series(1, 10) i, generate_series(0, 1) v));
  assert (select count(*) from public.product_price_breaks where product_id = wedding) = 20, 'ten for each variation should be allowed';
  begin
    insert into public.product_price_breaks (organisation_id, product_id, variation_id, from_quantity_milli, percent_off_bp) values (org_a, wedding, small, 99000, 100);
    raise exception 'an eleventh row on one variation was inserted';
  exception when sqlstate '54000' then null;
  end;
  -- Rows are saved with the variations in the same call; they follow them when they are replaced.
  perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'),
    jsonb_build_array(jsonb_build_object('id', small, 'name', 'Small', 'price_cents', 30000), jsonb_build_object('id', large, 'name', 'Large', 'price_cents', 60000), jsonb_build_object('name', 'Huge', 'price_cents', 90000)),
    null, null, '[{"from_quantity_milli": 3000, "percent_off_bp": 500, "variation": 2}]'::jsonb);
  assert (select count(*) from public.product_price_breaks where product_id = wedding) = 1, 'the new variation''s row was not saved alone';
  assert (select v.name from public.product_price_breaks b join public.product_variations v on v.id = b.variation_id where b.product_id = wedding) = 'Huge', 'the row went to the wrong variation';
  -- A variation that is removed takes its rows.
  perform public.save_product_layers(org_a, wedding, pg_temp.sized('Wedding cake'),
    jsonb_build_array(jsonb_build_object('id', small, 'name', 'Small', 'price_cents', 30000), jsonb_build_object('id', large, 'name', 'Large', 'price_cents', 60000)),
    null, null, null);
  assert (select count(*) from public.product_price_breaks where product_id = wedding) = 0, 'a removed variation left its rows behind';
  -- A row cannot point at another business's variation.
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  begin
    insert into public.product_price_breaks (organisation_id, product_id, variation_id, from_quantity_milli, percent_off_bp)
    values (org_b, other, small, 1000, 100);
    raise exception 'a row was pointed at another business''s variation';
  exception when foreign_key_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- A request with no active session reads and writes nothing
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.product_price_breaks;
  assert n = 0, 'quantity prices were readable without a session';
  reset role;
end
$$;

rollback;
