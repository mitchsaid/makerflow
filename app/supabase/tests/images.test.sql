-- Pictures: members of a business add and read its picture records and files, nobody changes or
-- deletes one, a product or the business can only point at its own business's picture, a business
-- can only keep so many, the "pictures" bucket's rules, and the quote's photos switch.
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
  img_b := gen_random_uuid();
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img_b, org_b, 'product', 'image/jpeg', 10, 10, 100, 50);
  reset role;

  ----------------------------------------------------------------------
  -- Members add and read picture records; the uploader is recorded
  ----------------------------------------------------------------------
  perform pg_temp.as_user(s);
  set local role authenticated;
  img_a := gen_random_uuid();
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (img_a, org_a, 'product', 'image/jpeg', 800, 600, 150000, 25000);
  assert (select created_by = s from public.images where id = img_a), 'the uploader was not recorded';
  assert (select thumb_bytes = 25000 from public.images where id = img_a), 'a member cannot read their business''s picture';
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.images where id = img_a) = 0, 'another business can read a picture record';
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'logo', 'image/png', 10, 10, 100, 50);
    raise exception 'FAIL: a non-member added a picture record';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Nobody changes or deletes a picture record
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    update public.images set thumb_bytes = 1 where id = img_a;
    raise exception 'FAIL: a picture record was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.images where id = img_a;
    raise exception 'FAIL: a picture record was deleted';
  exception when insufficient_privilege then null;
  end;

  ----------------------------------------------------------------------
  -- Limits and shape
  ----------------------------------------------------------------------
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'product', 'image/gif', 10, 10, 100, 50);
    raise exception 'FAIL: a gif was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'banner', 'image/png', 10, 10, 100, 50);
    raise exception 'FAIL: an unknown kind was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'product', 'image/jpeg', 10, 10, 700001, 50);
    raise exception 'FAIL: an oversized display copy was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'product', 'image/jpeg', 10, 10, 100, 150001);
    raise exception 'FAIL: an oversized thumbnail was accepted';
  exception when check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- The "pictures" bucket: its settings and its rules
  ----------------------------------------------------------------------
  assert (select not public and file_size_limit = 700000 and allowed_mime_types = array['image/jpeg', 'image/png']
            from storage.buckets where id = 'pictures'), 'the pictures bucket is missing or not private and limited';

  -- A member adds the two files for a picture record of their business, and can read them.
  perform pg_temp.as_user(s);
  set local role authenticated;
  insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || img_a || '/thumb');
  insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || img_a || '/display');
  assert (select count(*) from storage.objects where bucket_id = 'pictures' and name like org_a || '/' || img_a || '/%') = 2,
    'a member cannot read their business''s files';
  -- Not for a picture record that does not exist, nor with a name that is not exactly the shape.
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || gen_random_uuid() || '/thumb');
    raise exception 'FAIL: a file was added for a picture record that does not exist';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || img_a || '/original');
    raise exception 'FAIL: an extra kind of file was added';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || img_a || '/thumb/extra');
    raise exception 'FAIL: a deeper path was added';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', 'evil.png');
    raise exception 'FAIL: a file with a free name was added';
  exception when insufficient_privilege then null;
  end;
  -- Nothing can be changed or removed.
  update storage.objects set name = name || 'x' where bucket_id = 'pictures' and name = org_a || '/' || img_a || '/thumb';
  get diagnostics n = row_count;
  assert n = 0, 'a file was renamed';
  -- (Storage refuses a direct delete outright, which is stricter than having no policy.)
  begin
    delete from storage.objects where bucket_id = 'pictures' and name = org_a || '/' || img_a || '/thumb';
    get diagnostics n = row_count;
    assert n = 0, 'a file was deleted';
  exception when others then
    if sqlerrm like 'a file was deleted' then raise; end if;
  end;
  reset role;
  assert (select count(*) from storage.objects where bucket_id = 'pictures' and name like org_a || '/' || img_a || '/%') = 2,
    'files went missing';

  -- Another business cannot read them, add to this picture, or add with this business's path.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from storage.objects where bucket_id = 'pictures' and name like org_a || '/%') = 0,
    'another business can read the files';
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', org_a || '/' || img_a || '/extra'::text);
    raise exception 'FAIL: a non-member added a file';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('pictures', org_b || '/' || img_a || '/thumb');
    raise exception 'FAIL: a file was added for another business''s picture';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- A revoked session does nothing in the bucket (the same rule as every table).
  delete from auth.sessions where user_id = s;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', s, 'role', 'authenticated', 'session_id', md5('session-' || s::text)::uuid)::text, true);
  assert (select count(*) from storage.objects where bucket_id = 'pictures') = 0, 'a signed-out session can read files';
  reset role;

  ----------------------------------------------------------------------
  -- A product and the business point at their own business's picture only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.products (organisation_id, kind, name, unit_price_cents)
    values (org_a, 'product', 'Cake', 10000) returning id into prod_a;
  update public.products set photo_image_id = img_a where id = prod_a;
  assert (select photo_image_id = img_a from public.products where id = prod_a), 'the photo was not attached';
  begin
    update public.products set photo_image_id = img_b where id = prod_a;
    raise exception 'FAIL: a product pointed at another business''s picture';
  exception when foreign_key_violation then null;
  end;
  update public.products set photo_image_id = null where id = prod_a;
  assert (select photo_image_id is null from public.products where id = prod_a), 'the photo was not removed';
  assert (select count(*) from public.images where id = img_a) = 1, 'removing a photo deleted the picture record';

  update public.business_profiles set logo_image_id = img_a where organisation_id = org_a;
  assert (select logo_image_id = img_a from public.business_profiles where organisation_id = org_a), 'the logo was not attached';
  begin
    update public.business_profiles set logo_image_id = img_b where organisation_id = org_a;
    raise exception 'FAIL: the logo pointed at another business''s picture';
  exception when foreign_key_violation then null;
  end;
  reset role;

  -- Any member (staff too) can attach a photo to a product; staff cannot change the logo.
  perform pg_temp.as_user(s);
  insert into auth.sessions (id, user_id) values (md5('session-' || s::text)::uuid, s) on conflict do nothing;
  set local role authenticated;
  update public.products set photo_image_id = img_a where id = prod_a;
  assert (select photo_image_id = img_a from public.products where id = prod_a), 'staff could not attach a photo';
  update public.business_profiles set logo_image_id = null where organisation_id = org_a;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed the logo';
  reset role;

  ----------------------------------------------------------------------
  -- A business can only keep so many pictures (nothing is ever deleted)
  ----------------------------------------------------------------------
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    select gen_random_uuid(), org_a, 'product', 'image/jpeg', 10, 10, 100, 50
      from generate_series(1, 600 - (select count(*)::int from public.images where organisation_id = org_a));
  assert (select count(*) from public.images where organisation_id = org_a) = 600, 'setup: not at the limit';
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
      values (gen_random_uuid(), org_a, 'product', 'image/jpeg', 10, 10, 100, 50);
    raise exception 'FAIL: a business went over its limit of pictures';
  exception when program_limit_exceeded then null;
  end;
  reset role;
  -- Another business is not affected.
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.images (id, organisation_id, kind, content_type, width, height, display_bytes, thumb_bytes)
    values (gen_random_uuid(), org_b, 'product', 'image/jpeg', 10, 10, 100, 50);
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
