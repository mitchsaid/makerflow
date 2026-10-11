-- Materials (docs/plans/costs-and-recipes.md, slice 1): a business's own list of what it buys, with a unit, a
-- quantity bought, a price paid and what the price includes for VAT. Isolation, session required, limits,
-- unique names, archive without delete. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000027a1';
  b uuid := '00000000-0000-4000-8000-0000000027b1';
  c uuid := '00000000-0000-4000-8000-0000000027c1';
  org_a uuid;
  org_b uuid;
  flour uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ma27@example.test'), (b, 'mb27@example.test'), (c, 'mc27@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  -- C is staff in A's business.
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- A member adds materials: the price is for the quantity bought; VAT treatment defaults to none
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents, vat_treatment, supplier)
    values (org_a, 'Cake flour', 'kg', 12500, 18750, 'included', 'Makro') returning id into flour;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents)
    values (org_a, 'Silver wire', 'm', 5000, 25000);
  assert (select vat_treatment from public.materials where name = 'Silver wire') = 'none', 'a new material should have no VAT treatment unless said';
  assert (select supplier is null from public.materials where name = 'Silver wire'), 'no supplier should be NULL';
  assert (select count(*) from public.materials) = 2, 'could not read the materials back';

  ----------------------------------------------------------------------
  -- Checks: unit from the list, quantity above zero, price not negative, names and supplier lengths, VAT values
  ----------------------------------------------------------------------
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'X', 'bucket', 1000, 100);
    raise exception 'an unknown unit was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'X', 'kg', 0, 100);
    raise exception 'a quantity of zero was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'X', 'kg', 1000, -1);
    raise exception 'a negative price was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, '   ', 'kg', 1000, 100);
    raise exception 'a blank name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents, vat_treatment) values (org_a, 'X', 'kg', 1000, 100, 'maybe');
    raise exception 'an unknown VAT treatment was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents, supplier) values (org_a, 'X', 'kg', 1000, 100, '');
    raise exception 'an empty supplier was accepted (it should be NULL)';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Names: unique per business (ignoring case and spaces) while not archived; free again once archived
  ----------------------------------------------------------------------
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, '  cake FLOUR ', 'kg', 1000, 100);
    raise exception 'a duplicate name was accepted';
  exception when unique_violation then null;
  end;
  update public.materials set archived_at = now() where id = flour;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Cake flour', 'kg', 2000, 300);
  -- A restore into a name taken by an active one is refused too.
  begin
    update public.materials set archived_at = null where id = flour;
    raise exception 'restoring into a taken name was accepted';
  exception when unique_violation then null;
  end;
  -- The same name in another business is fine.
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_b, 'Cake flour', 'kg', 1000, 100);

  ----------------------------------------------------------------------
  -- Isolation: B sees only B's, cannot write into A, cannot move a row to A, cannot delete
  ----------------------------------------------------------------------
  assert (select count(*) from public.materials) = 1, 'B can see another business''s materials';
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Planted', 'kg', 1000, 100);
    raise exception 'B added a material to A';
  exception when insufficient_privilege or check_violation then null;
  end;
  update public.materials set name = 'Hijacked' where id = flour;
  get diagnostics n = row_count;
  assert n = 0, 'B changed A''s material';
  begin
    update public.materials set organisation_id = org_a where organisation_id = org_b;
    raise exception 'a material was moved to another business';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.materials where organisation_id = org_b;
    raise exception 'a material was deleted';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Staff in A can add, edit and archive (like products)
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Beeswax', 'g', 500000, 45000);
  update public.materials set price_cents = 46000 where name = 'Beeswax';
  get diagnostics n = row_count;
  assert n = 1, 'staff could not edit a material';
  update public.materials set archived_at = now() where name = 'Beeswax';
  get diagnostics n = row_count;
  assert n = 1, 'staff could not archive a material';
  reset role;

  ----------------------------------------------------------------------
  -- Session required: a signed-in user with no active session sees and writes nothing
  ----------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'session_id', gen_random_uuid())::text, true);
  set local role authenticated;
  assert (select count(*) from public.materials) = 0, 'materials are visible without an active session';
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Ghost', 'kg', 1000, 100);
    raise exception 'a material was added without a session';
  exception when insufficient_privilege or check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- The limit: 2000 that are not archived; archiving frees a slot; restoring into a full business is refused
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.materials where organisation_id = org_a and archived_at is null;
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents)
    select org_a, 'Bulk ' || i, 'each', 1000, 100 from generate_series(1, 2000 - n) as i;
  assert (select count(*) from public.materials where organisation_id = org_a and archived_at is null) = 2000, 'could not fill the business';
  begin
    insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'One too many', 'each', 1000, 100);
    raise exception 'a 2001st material was accepted';
  exception when sqlstate '54000' then null;
  end;
  -- Archiving one frees a slot (archived ones are not counted), and the slot can be used.
  update public.materials set archived_at = now() where name = 'Bulk 1';
  insert into public.materials (organisation_id, name, unit, bought_quantity_milli, price_cents) values (org_a, 'Fits now', 'each', 1000, 100);
  -- Restoring into a full business is refused too; the archived one stays archived.
  begin
    update public.materials set archived_at = null where name = 'Bulk 1';
    raise exception 'a material was restored into a full business';
  exception when sqlstate '54000' then null;
  end;
  assert (select archived_at is not null from public.materials where name = 'Bulk 1'), 'the refused restore changed the row';
  reset role;

  raise notice 'materials tests passed';
end
$$;

rollback;
