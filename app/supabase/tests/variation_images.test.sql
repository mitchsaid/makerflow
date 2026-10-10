-- Pictures for variation choices (docs/plans/variation-images.md): save_product keeps a picture on each
-- variation and each choice of the other variations, by their place in the list; a payload without the key
-- leaves them as they are; null or "" removes the picture; a business can never point at another's picture.
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
  a uuid := '00000000-0000-4000-8000-0000000026a1';
  b uuid := '00000000-0000-4000-8000-0000000026b1';
  org_a uuid;
  org_b uuid;
  img1 uuid := '00000000-0000-4000-8000-0000000026c1';
  img2 uuid := '00000000-0000-4000-8000-0000000026c2';
  img_b uuid := '00000000-0000-4000-8000-0000000026d1';
  cake uuid;
  big_id uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'va26@example.test'), (b, 'vb26@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img_b, org_b, 'product', 'image/jpeg', 10, 10, 100, 50);
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img1, org_a, 'product', 'image/jpeg', 800, 600, 150000, 25000),
           (img2, org_a, 'product', 'image/jpeg', 800, 600, 150000, 25000);

  ----------------------------------------------------------------------
  -- A picture on a variation and on a choice, new rows included
  ----------------------------------------------------------------------
  cake := public.save_product(
    org_a, null, pg_temp.product('Cake', 'Size'),
    jsonb_build_array(
      jsonb_build_object('name', 'Small', 'price_cents', 30000, 'image_id', img1::text),
      jsonb_build_object('name', 'Big', 'price_cents', 60000)),
    jsonb_build_array(jsonb_build_object('name', 'Flavour', 'kind', 'one', 'required', true, 'values', jsonb_build_array(
      jsonb_build_object('name', 'Vanilla', 'price_cents', 0, 'image_id', img2::text),
      jsonb_build_object('name', 'Red velvet', 'price_cents', 500)))));
  assert (select image_id = img1 from public.product_variations where product_id = cake and name = 'Small'), 'the variation has no picture';
  assert (select image_id is null from public.product_variations where product_id = cake and name = 'Big'), 'a variation without one got one';
  assert (select image_id = img2 from public.product_option_values where name = 'Vanilla' and organisation_id = org_a), 'the choice has no picture';
  assert (select image_id is null from public.product_option_values where name = 'Red velvet' and organisation_id = org_a), 'a choice without one got one';
  select id into big_id from public.product_variations where product_id = cake and name = 'Big';

  ----------------------------------------------------------------------
  -- Saving again: without the key the pictures stay; the picture follows its place; null removes it
  ----------------------------------------------------------------------
  perform public.save_product(
    org_a, cake, pg_temp.product('Cake', 'Size'),
    jsonb_build_array(
      jsonb_build_object('name', 'Small', 'price_cents', 30000, 'id', (select id from public.product_variations where product_id = cake and name = 'Small')),
      jsonb_build_object('name', 'Big', 'price_cents', 60000, 'id', big_id)),
    null);
  assert (select image_id = img1 from public.product_variations where product_id = cake and name = 'Small'), 'a payload without image_id removed the picture';

  perform public.save_product(
    org_a, cake, pg_temp.product('Cake', 'Size'),
    jsonb_build_array(
      jsonb_build_object('name', 'Small', 'price_cents', 30000, 'id', (select id from public.product_variations where product_id = cake and name = 'Small'), 'image_id', null),
      jsonb_build_object('name', 'Big', 'price_cents', 60000, 'id', big_id, 'image_id', img2::text)),
    null);
  assert (select image_id is null from public.product_variations where product_id = cake and name = 'Small'), 'null did not remove the picture';
  assert (select image_id = img2 from public.product_variations where id = big_id), 'the picture did not follow its variation';

  perform public.save_product(
    org_a, cake, pg_temp.product('Cake', 'Size'),
    jsonb_build_array(
      jsonb_build_object('name', 'Small', 'price_cents', 30000, 'id', (select id from public.product_variations where product_id = cake and name = 'Small'), 'image_id', ''),
      jsonb_build_object('name', 'Big', 'price_cents', 60000, 'id', big_id, 'image_id', '')),
    null);
  assert (select count(*) from public.product_variations where product_id = cake and image_id is not null) = 0, 'an empty image_id did not remove the picture';

  ----------------------------------------------------------------------
  -- Another business's picture cannot be pointed at (variation or choice)
  ----------------------------------------------------------------------
  begin
    perform public.save_product(
      org_a, cake, pg_temp.product('Cake', 'Size'),
      jsonb_build_array(
        jsonb_build_object('name', 'Small', 'price_cents', 30000, 'image_id', img_b::text),
        jsonb_build_object('name', 'Big', 'price_cents', 60000)),
      null);
    raise exception 'a variation pointed at another business''s picture';
  exception when foreign_key_violation then null;
  end;
  begin
    perform public.save_product(
      org_a, cake, pg_temp.product('Cake', 'Size'),
      jsonb_build_array(jsonb_build_object('name', 'Small', 'price_cents', 30000), jsonb_build_object('name', 'Big', 'price_cents', 60000)),
      jsonb_build_array(jsonb_build_object('name', 'Flavour', 'kind', 'one', 'required', true, 'values', jsonb_build_array(
        jsonb_build_object('name', 'Vanilla', 'price_cents', 0, 'image_id', img_b::text)))));
    raise exception 'a choice pointed at another business''s picture';
  exception when foreign_key_violation then null;
  end;

  raise notice 'variation images tests passed';
end
$$;

rollback;
