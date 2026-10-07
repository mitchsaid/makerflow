-- Pictures: members of a business add and read its images, nobody changes or deletes one, a product
-- or the business can only point at its own business's image, and the quote's photos switch is saved
-- with the draft. Plain SQL, one transaction, rolled back.

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
    'customer_id', null, 'issue_date', '2026-10-13', 'valid_until', '2026-10-27',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000016a1';  -- owner of org A
  s uuid := '00000000-0000-4000-8000-0000000016a2';  -- staff in A
  b uuid := '00000000-0000-4000-8000-0000000016b1';  -- owner of org B
  org_a uuid;
  org_b uuid;
  img_a uuid;
  img_b uuid;
  prod_a uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ia@example.test'), (s, 'is@example.test'), (b, 'ib@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, s, 'staff');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
    values (org_b, 'product', 'image/jpeg', 10, 10, '\xffd8ff01', '\xffd8ff02') returning id into img_b;
  reset role;

  ----------------------------------------------------------------------
  -- Members add and read images; the uploader is recorded
  ----------------------------------------------------------------------
  perform pg_temp.as_user(s);
  set local role authenticated;
  insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
    values (org_a, 'product', 'image/jpeg', 800, 600, '\xffd8ff', '\xffd8ff') returning id into img_a;
  assert (select created_by = s from public.images where id = img_a), 'the uploader was not recorded';
  assert (select octet_length(thumb) = 3 from public.images where id = img_a), 'a member cannot read their business''s image';
  reset role;

  -- Other businesses cannot see it, and cannot add to this business.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.images where id = img_a) = 0, 'another business can read an image';
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'logo', 'image/png', 10, 10, '\x89504e470d0a1a0a01', '\x89504e470d0a1a0a02');
    raise exception 'FAIL: a non-member added an image';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Nobody changes or deletes an image
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    update public.images set display = '\x02' where id = img_a;
    raise exception 'FAIL: an image was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.images where id = img_a;
    raise exception 'FAIL: an image was deleted';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Limits and shape
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/gif', 10, 10, '\xffd8ff01', '\xffd8ff02');
    raise exception 'FAIL: a gif was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'banner', 'image/png', 10, 10, '\xffd8ff01', '\xffd8ff02');
    raise exception 'FAIL: an unknown kind was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/jpeg', 10, 10, '\xffd8ff'::bytea || decode(repeat('00', 700001), 'hex'), '\xffd8ff');
    raise exception 'FAIL: an oversized display copy was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/jpeg', 10, 10, '\xffd8ff', '\xffd8ff'::bytea || decode(repeat('00', 150001), 'hex'));
    raise exception 'FAIL: an oversized thumbnail was accepted';
  exception when check_violation then null;
  end;

  -- The bytes must really be the type claimed.
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/jpeg', 10, 10, '\x68656c6c6f', '\x68656c6c6f');
    raise exception 'FAIL: text stored as a jpeg';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'logo', 'image/png', 10, 10, '\xffd8ff01', '\xffd8ff02');
    raise exception 'FAIL: jpeg bytes stored as a png';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/jpeg', 10, 10, '\xffd8ff01', '\x68656c6c6f');
    raise exception 'FAIL: a thumbnail that is not a jpeg was stored';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- A product and the business point at their own business's image only
  ----------------------------------------------------------------------
  insert into public.products (organisation_id, kind, name, unit_price_cents)
    values (org_a, 'product', 'Cake', 10000) returning id into prod_a;
  update public.products set photo_image_id = img_a where id = prod_a;
  assert (select photo_image_id = img_a from public.products where id = prod_a), 'the photo was not attached';
  begin
    update public.products set photo_image_id = img_b where id = prod_a;
    raise exception 'FAIL: a product pointed at another business''s image';
  exception when foreign_key_violation then null;
  end;
  update public.products set photo_image_id = null where id = prod_a;
  assert (select photo_image_id is null from public.products where id = prod_a), 'the photo was not removed';
  assert (select count(*) from public.images where id = img_a) = 1, 'removing a photo deleted the image';

  update public.business_profiles set logo_image_id = img_a where organisation_id = org_a;
  assert (select logo_image_id = img_a from public.business_profiles where organisation_id = org_a), 'the logo was not attached';
  begin
    update public.business_profiles set logo_image_id = img_b where organisation_id = org_a;
    raise exception 'FAIL: the logo pointed at another business''s image';
  exception when foreign_key_violation then null;
  end;
  reset role;

  -- Any member (staff too) can attach a photo to a product.
  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.products set photo_image_id = img_a where id = prod_a;
  assert (select photo_image_id = img_a from public.products where id = prod_a), 'staff could not attach a photo';
  reset role;

  -- Staff cannot change the business's logo (the profile is for owners and admins).
  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.business_profiles set logo_image_id = null where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the logo';
  reset role;

  ----------------------------------------------------------------------
  -- A business can only keep so many pictures (nothing is ever deleted)
  ----------------------------------------------------------------------
  reset role;
  insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
    select org_a, 'product', 'image/jpeg', 10, 10, '\xffd8ff', '\xffd8ff' from generate_series(1, 600 - (select count(*)::int from public.images where organisation_id = org_a));
  assert (select count(*) from public.images where organisation_id = org_a) = 600, 'setup: not at the limit';
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
      values (org_a, 'product', 'image/jpeg', 10, 10, '\xffd8ff', '\xffd8ff');
    raise exception 'FAIL: a business went over its limit of pictures';
  exception when program_limit_exceeded then null;
  end;
  reset role;
  -- Another business is not affected.
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.images (organisation_id, kind, content_type, width, height, display, thumb)
    values (org_b, 'product', 'image/jpeg', 10, 10, '\xffd8ff', '\xffd8ff');
  reset role;

  ----------------------------------------------------------------------
  -- The photos switch is saved with the draft; an older payload keeps it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select show_photos from public.quotes where id = q), 'photos should be on by default';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"show_photos":false}'), '[]'::jsonb);
  assert (select not show_photos from public.quotes where id = q), 'the switch was not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select not show_photos from public.quotes where id = q), 'a payload without the switch changed it';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"show_photos":true}'), '[]'::jsonb);
  assert (select show_photos from public.quotes where id = q), 'the switch was not turned back on';
  reset role;

  raise notice 'image tests passed';
end
$$;

rollback;
