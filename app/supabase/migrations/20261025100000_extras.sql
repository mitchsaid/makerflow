-- Extras (slice 2 of docs/plans/product-extras.md): what people can add to a product.
--
-- An extra is one thing: a name, a price and an optional "ask for wording". It is either SHARED (one
-- price everywhere; any product can have it) or for ONE product only (its own price, which can differ by
-- the product's variations). A product's extras are listed in product_extras, in the maker's order.
-- This replaces the "choose any" and "type something" options; "choose one" options stay (they are the
-- extra lists in the Variations section).
--
-- SECURITY-SENSITIVE: three new tables with row-level security, replaced save_product (SECURITY INVOKER,
-- callable by signed-in people), and a conversion of stored options and quote item copies. Needs human
-- review before this is applied to any hosted project.

-- ---------------------------------------------------------------------------
-- extras
-- ---------------------------------------------------------------------------

create table public.extras (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  -- Set: this extra is for that product only. Null: shared, any product can have it.
  product_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  -- Added to the price (in the business's VAT entry mode). Zero is fine ("Message on the cake").
  price_cents bigint not null default 0 check (price_cents between 0 and 99999999999),
  -- The person quoting types what it should say ("Happy 40th").
  asks_for_wording boolean not null default false,
  text_max integer not null default 100 check (text_max between 1 and 500),
  -- Its price depends on the product's variations (product-only extras: a shared one has no variations to ask).
  price_by_variation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extras_org_id_unique unique (organisation_id, id),
  constraint extras_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade,
  constraint extras_price_by_variation_product_only check (not price_by_variation or product_id is not null)
);

-- A business has each shared extra once, by name.
create unique index extras_shared_name_unique on public.extras (organisation_id, lower(name)) where product_id is null;
create index extras_product_idx on public.extras (organisation_id, product_id) where product_id is not null;

create trigger extras_set_updated_at
  before update on public.extras
  for each row execute function public.set_updated_at();

-- No change of business, ever. The product may change (a shared extra can become "this product only", and back).
revoke all on public.extras from anon, authenticated;
grant select, delete on public.extras to authenticated;
grant insert (organisation_id, product_id, name, price_cents, asks_for_wording, text_max, price_by_variation)
  on public.extras to authenticated;
grant update (product_id, name, price_cents, asks_for_wording, text_max, price_by_variation)
  on public.extras to authenticated;

alter table public.extras enable row level security;

create policy extras_select_members on public.extras
  for select to authenticated using (public.is_org_member(organisation_id));
create policy extras_insert_members on public.extras
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy extras_update_members on public.extras
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy extras_delete_members on public.extras
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.extras
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- product_extras: which extras a product has, in the maker's order
-- ---------------------------------------------------------------------------

create table public.product_extras (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  extra_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (product_id, extra_id),
  constraint product_extras_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade,
  constraint product_extras_extra_same_org
    foreign key (organisation_id, extra_id) references public.extras (organisation_id, id)
    on delete cascade
);

create index product_extras_extra_idx on public.product_extras (organisation_id, extra_id);

-- An extra for one product is only ever on that product.
create function public.product_extras_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.extras e
     where e.id = new.extra_id and e.product_id is not null and e.product_id <> new.product_id
  ) then
    raise exception 'an extra for one product cannot be on another' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_extras_scope() from public, anon, authenticated;

create trigger product_extras_scope
  before insert or update on public.product_extras
  for each row execute function public.product_extras_scope();

create function public.product_extras_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_extras:' || new.product_id::text, 0));
  if (select count(*) from public.product_extras where product_id = new.product_id) >= 40 then
    raise exception 'a product can have at most 40 extras' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_extras_limit() from public, anon, authenticated;

create trigger product_extras_limit
  before insert on public.product_extras
  for each row execute function public.product_extras_limit();

revoke all on public.product_extras from anon, authenticated;
grant select, delete on public.product_extras to authenticated;
grant insert (organisation_id, product_id, extra_id, sort_order) on public.product_extras to authenticated;
grant update (sort_order) on public.product_extras to authenticated;

alter table public.product_extras enable row level security;

create policy product_extras_select_members on public.product_extras
  for select to authenticated using (public.is_org_member(organisation_id));
create policy product_extras_insert_members on public.product_extras
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy product_extras_update_members on public.product_extras
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy product_extras_delete_members on public.product_extras
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.product_extras
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- extra_variation_prices: a product-only extra's price for each of its product's variations
-- ---------------------------------------------------------------------------

create table public.extra_variation_prices (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  extra_id uuid not null,
  variation_id uuid not null,
  price_cents bigint not null check (price_cents between 0 and 99999999999),
  primary key (extra_id, variation_id),
  constraint extra_variation_prices_extra_same_org
    foreign key (organisation_id, extra_id) references public.extras (organisation_id, id)
    on delete cascade,
  constraint extra_variation_prices_variation_same_org
    foreign key (organisation_id, variation_id) references public.product_variations (organisation_id, id)
    on delete cascade
);

create index extra_variation_prices_variation_idx on public.extra_variation_prices (organisation_id, variation_id);

-- The variation must be one of the extra's own product (the keys only say same business).
create function public.extra_variation_prices_same_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.extras e
      join public.product_variations v on v.product_id = e.product_id
     where e.id = new.extra_id and v.id = new.variation_id
  ) then
    raise exception 'a price must be for a variation of the extra''s own product' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.extra_variation_prices_same_product() from public, anon, authenticated;

create trigger extra_variation_prices_same_product
  before insert or update on public.extra_variation_prices
  for each row execute function public.extra_variation_prices_same_product();

revoke all on public.extra_variation_prices from anon, authenticated;
grant select, delete on public.extra_variation_prices to authenticated;
grant insert (organisation_id, extra_id, variation_id, price_cents) on public.extra_variation_prices to authenticated;
grant update (price_cents) on public.extra_variation_prices to authenticated;

alter table public.extra_variation_prices enable row level security;

create policy extra_variation_prices_select_members on public.extra_variation_prices
  for select to authenticated using (public.is_org_member(organisation_id));
create policy extra_variation_prices_insert_members on public.extra_variation_prices
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy extra_variation_prices_update_members on public.extra_variation_prices
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy extra_variation_prices_delete_members on public.extra_variation_prices
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.extra_variation_prices
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- Conversion: "choose any" values and "type something" options become extras for their product only.
-- The new extra keeps the id of the value (or option) it comes from, so quote items that chose it still match.
-- ---------------------------------------------------------------------------

insert into public.extras (id, organisation_id, product_id, name, price_cents, asks_for_wording, text_max, price_by_variation)
select v.id, g.organisation_id, g.product_id, v.name, v.price_cents, false, 100, g.price_by_variation
  from public.product_option_values v
  join public.product_option_groups g on g.id = v.group_id
 where g.kind = 'any';

insert into public.extras (id, organisation_id, product_id, name, price_cents, asks_for_wording, text_max, price_by_variation)
select g.id, g.organisation_id, g.product_id, g.name, g.text_price_cents, true, g.text_max, false
  from public.product_option_groups g
 where g.kind = 'text';

-- In the maker's old order: by option, then by value.
insert into public.product_extras (organisation_id, product_id, extra_id, sort_order)
select organisation_id, product_id, extra_id, least(1000, (row_number() over (partition by product_id order by gsort, vsort))::integer - 1)
  from (
    select g.organisation_id, g.product_id, v.id as extra_id, g.sort_order as gsort, v.sort_order as vsort
      from public.product_option_values v join public.product_option_groups g on g.id = v.group_id
     where g.kind = 'any'
    union all
    select g.organisation_id, g.product_id, g.id, g.sort_order, 0
      from public.product_option_groups g where g.kind = 'text'
  ) x;

insert into public.extra_variation_prices (organisation_id, extra_id, variation_id, price_cents)
select p.organisation_id, p.value_id, p.variation_id, p.price_cents
  from public.product_option_value_prices p
  join public.product_option_values v on v.id = p.value_id
  join public.product_option_groups g on g.id = v.group_id
 where g.kind = 'any';

-- Quote items keep their own copy of what was chosen; a "type something" copy now points at its extra by
-- value_id (an extra is always found by that id), and what the copy says does not change.
update public.quote_lines l
   set options = (
     select jsonb_agg(
              case when e ->> 'kind' = 'text' and e ->> 'group_id' is not null
                   then jsonb_set(e, '{value_id}', to_jsonb(e ->> 'group_id'))
                   else e end
              order by n)
       from jsonb_array_elements(l.options) with ordinality as x(e, n)
   )
 where l.options @> '[{"kind": "text"}]';

delete from public.product_option_groups where kind in ('any', 'text');
alter table public.product_option_groups
  add constraint product_option_groups_kind_one check (kind = 'one');

-- ---------------------------------------------------------------------------
-- save_product: as before, also saving the extras (p_extras; null leaves them as they are).
-- Each element: { id?, name, price_cents, asks_for_wording, text_max, shared, price_by_variation,
--   prices: [{ variation_index, price_cents }] }. The list replaces the product's extras, keeping ids:
--   * a shared extra is updated in place (that is the "changes everywhere" the form announces);
--   * a shared extra turned into "this product only" while other products have it is copied for this one;
--   * a product-only extra turned shared becomes shared;
--   * an extra no longer listed is taken off the product (a product-only one is deleted, and a shared one
--     that no product has any more is deleted).
-- ---------------------------------------------------------------------------

drop function public.save_product(uuid, uuid, jsonb, jsonb, jsonb);

create function public.save_product(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null,
  p_extras jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid;
  n integer;
  g record;
  gid uuid;
  x record;
  xid uuid;
  found_product uuid;
  found boolean;
  want_shared boolean;
  detached uuid[];
  label text := nullif(btrim(p_product ->> 'variation_label'), '');
begin
  -- No list at all (a form that does not know about variations): they are left as they are.
  if p_variations is not null and jsonb_typeof(p_variations) <> 'array' then
    raise exception 'variations must be a list' using errcode = '22023';
  end if;
  n := coalesce(jsonb_array_length(p_variations), 0);
  if n > 50 then
    raise exception 'a product can have at most 50 variations' using errcode = '54000';
  end if;
  if n > 0 and label is null then
    raise exception 'a list of variations needs a name' using errcode = '22023';
  end if;
  if n = 0 and p_variations is not null then
    label := null;
  end if;

  if p_product_id is null then
    insert into public.products (organisation_id, kind, name, description, unit_price_cents, unit, variation_label)
    values (
      p_org,
      coalesce(p_product ->> 'kind', 'product'),
      p_product ->> 'name',
      nullif(p_product ->> 'description', ''),
      (p_product ->> 'unit_price_cents')::bigint,
      nullif(p_product ->> 'unit', ''),
      label
    )
    returning id into pid;
  else
    update public.products set
      kind = coalesce(p_product ->> 'kind', kind),
      name = p_product ->> 'name',
      description = nullif(p_product ->> 'description', ''),
      unit_price_cents = (p_product ->> 'unit_price_cents')::bigint,
      unit = nullif(p_product ->> 'unit', ''),
      variation_label = case when p_variations is null then variation_label else label end
     where id = p_product_id and organisation_id = p_org
    returning id into pid;
    if pid is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  -- Optional keys: only when the form carried them.
  if p_product ? 'photo_image_id' then
    update public.products set photo_image_id = nullif(p_product ->> 'photo_image_id', '')::uuid where id = pid;
  end if;
  if p_product ? 'vat_status' then
    update public.products set vat_status = p_product ->> 'vat_status' where id = pid;
  end if;

  if p_variations is null then
    -- Still a product with variations: its price stays their lowest.
    update public.products
       set unit_price_cents = (select min(price_cents) from public.product_variations where product_id = pid)
     where id = pid and exists (select 1 from public.product_variations where product_id = pid);
  else

  -- Variations: keep the ones still listed (by id), add new ones, remove the rest.
  update public.product_variations set usual = false where product_id = pid and organisation_id = p_org and usual;

  delete from public.product_variations v
   where v.product_id = pid and v.organisation_id = p_org
     and not exists (
       select 1 from jsonb_array_elements(p_variations) e where e ->> 'id' = v.id::text
     );

  update public.product_variations v set
    name = e.name, price_cents = e.price_cents, usual = coalesce(e.usual, false), sort_order = e.ord - 1
  from rows from (jsonb_to_recordset(p_variations) as (id uuid, name text, price_cents bigint, usual boolean)) with ordinality as e(id, name, price_cents, usual, ord)
   where v.id = e.id and v.product_id = pid and v.organisation_id = p_org;

  insert into public.product_variations (organisation_id, product_id, name, price_cents, usual, sort_order)
  select p_org, pid, e.name, e.price_cents, coalesce(e.usual, false), e.ord - 1
    from rows from (jsonb_to_recordset(p_variations) as (id uuid, name text, price_cents bigint, usual boolean)) with ordinality as e(id, name, price_cents, usual, ord)
   where e.id is null
      or not exists (select 1 from public.product_variations v where v.id = e.id and v.product_id = pid);

  -- The "from" price.
  if n > 0 then
    update public.products
       set unit_price_cents = (select min(price_cents) from public.product_variations where product_id = pid)
     where id = pid;
  end if;
  end if;

  -- Lists you pick one from ("choose one" options): null leaves them as they are; otherwise the list
  -- replaces them (keeping ids).
  if p_options is not null then
    if jsonb_typeof(p_options) <> 'array' then
      raise exception 'options must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_options) > 20 then
      raise exception 'a product can have at most 20 options' using errcode = '54000';
    end if;

    delete from public.product_option_groups og
     where og.product_id = pid and og.organisation_id = p_org
       and not exists (select 1 from jsonb_array_elements(p_options) e where e ->> 'id' = og.id::text);

    for g in
      select e.value as body, e.ordinality as ord from jsonb_array_elements(p_options) with ordinality as e
    loop
      if jsonb_typeof(g.body -> 'values') is distinct from 'array' then
        raise exception 'an option needs a list of values' using errcode = '22023';
      end if;
      if (g.body ->> 'kind') = 'text' and jsonb_array_length(g.body -> 'values') > 0 then
        raise exception 'a text option has no values' using errcode = '22023';
      end if;
      if (g.body ->> 'kind') in ('one', 'any') and jsonb_array_length(g.body -> 'values') = 0 then
        raise exception 'a choice needs at least one value' using errcode = '22023';
      end if;
      if jsonb_array_length(g.body -> 'values') > 50 then
        raise exception 'an option can have at most 50 values' using errcode = '54000';
      end if;

      gid := null;
      update public.product_option_groups set
        name = g.body ->> 'name',
        kind = g.body ->> 'kind',
        required = coalesce((g.body ->> 'required')::boolean, false),
        charge = coalesce(g.body ->> 'charge', 'item'),
        text_price_cents = coalesce((g.body ->> 'text_price_cents')::bigint, 0),
        text_max = coalesce((g.body ->> 'text_max')::integer, 100),
        price_by_variation = coalesce((g.body ->> 'price_by_variation')::boolean, false),
        sort_order = g.ord - 1
       where id::text = g.body ->> 'id' and product_id = pid and organisation_id = p_org
      returning id into gid;
      if gid is null then
        insert into public.product_option_groups (
          organisation_id, product_id, name, kind, required, charge, text_price_cents, text_max, price_by_variation, sort_order
        ) values (
          p_org, pid, g.body ->> 'name', g.body ->> 'kind',
          coalesce((g.body ->> 'required')::boolean, false), coalesce(g.body ->> 'charge', 'item'),
          coalesce((g.body ->> 'text_price_cents')::bigint, 0), coalesce((g.body ->> 'text_max')::integer, 100),
          coalesce((g.body ->> 'price_by_variation')::boolean, false),
          g.ord - 1
        )
        returning id into gid;
      end if;

      -- Its values, the same way.
      update public.product_option_values set usual = false where group_id = gid and organisation_id = p_org and usual;
      delete from public.product_option_values ov
       where ov.group_id = gid and ov.organisation_id = p_org
         and not exists (select 1 from jsonb_array_elements(g.body -> 'values') e where e ->> 'id' = ov.id::text);
      update public.product_option_values ov set
        name = e.name, price_cents = e.price_cents, usual = coalesce(e.usual, false), sort_order = e.ord - 1
      from rows from (jsonb_to_recordset(g.body -> 'values') as (id uuid, name text, price_cents bigint, usual boolean))
           with ordinality as e(id, name, price_cents, usual, ord)
       where ov.id = e.id and ov.group_id = gid and ov.organisation_id = p_org;
      insert into public.product_option_values (organisation_id, group_id, name, price_cents, usual, sort_order)
      select p_org, gid, e.name, e.price_cents, coalesce(e.usual, false), e.ord - 1
        from rows from (jsonb_to_recordset(g.body -> 'values') as (id uuid, name text, price_cents bigint, usual boolean))
             with ordinality as e(id, name, price_cents, usual, ord)
       where e.id is null
          or not exists (select 1 from public.product_option_values ov where ov.id = e.id and ov.group_id = gid);

      -- Prices by variation: each value's price for each variation, by the variation's place in the
      -- product's list (new variations have no id yet when the form is sent). Replaced every time.
      delete from public.product_option_value_prices vp
       using public.product_option_values ov
       where vp.value_id = ov.id and ov.group_id = gid and vp.organisation_id = p_org;
      if coalesce((g.body ->> 'price_by_variation')::boolean, false) then
        insert into public.product_option_value_prices (organisation_id, value_id, variation_id, price_cents)
        select p_org, ov.id, pv.id, (pr.value ->> 'price_cents')::bigint
          from jsonb_array_elements(g.body -> 'values') with ordinality as e(value, ord)
          join public.product_option_values ov on ov.group_id = gid and ov.sort_order = e.ord - 1
          cross join lateral jsonb_array_elements(coalesce(e.value -> 'prices', '[]'::jsonb)) as pr(value)
          join (
            select v.id, row_number() over (order by v.sort_order, v.created_at) - 1 as idx
              from public.product_variations v where v.product_id = pid
          ) pv on pv.idx = (pr.value ->> 'variation_index')::bigint;
      end if;
    end loop;
  end if;

  -- Extras: null leaves them as they are; otherwise the list replaces them (see the notes above).
  if p_extras is not null then
    if jsonb_typeof(p_extras) <> 'array' then
      raise exception 'extras must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_extras) > 40 then
      raise exception 'a product can have at most 40 extras' using errcode = '54000';
    end if;

    -- Not listed any more: a product-only extra goes; a shared one comes off this product.
    delete from public.extras e
     where e.organisation_id = p_org and e.product_id = pid
       and not exists (select 1 from jsonb_array_elements(p_extras) l where l ->> 'id' = e.id::text);
    with gone as (
      delete from public.product_extras pe
       where pe.organisation_id = p_org and pe.product_id = pid
         and not exists (select 1 from jsonb_array_elements(p_extras) l where l ->> 'id' = pe.extra_id::text)
      returning pe.extra_id
    )
    select array_agg(extra_id) into detached from gone;
    -- A shared extra that no product has any more is gone with its last product.
    delete from public.extras e
     where e.organisation_id = p_org and e.product_id is null and e.id = any (coalesce(detached, '{}'::uuid[]))
       and not exists (select 1 from public.product_extras pe where pe.extra_id = e.id);

    for x in
      select e.value as body, e.ordinality as ord from jsonb_array_elements(p_extras) with ordinality as e
    loop
      want_shared := coalesce((x.body ->> 'shared')::boolean, true);
      xid := null;
      found := false;
      found_product := null;
      -- An extra this business has, shared or for this product.
      select e.id, e.product_id into xid, found_product
        from public.extras e
       where e.id::text = x.body ->> 'id' and e.organisation_id = p_org and (e.product_id is null or e.product_id = pid);
      found := xid is not null;

      if found and found_product is null and not want_shared
         and exists (select 1 from public.product_extras pe where pe.extra_id = xid and pe.product_id <> pid) then
        -- Shared, used on other products, and now "this product only": this product gets its own copy.
        delete from public.product_extras where product_id = pid and extra_id = xid;
        xid := null;
        found := false;
      end if;

      if found then
        update public.extras set
          name = x.body ->> 'name',
          price_cents = coalesce((x.body ->> 'price_cents')::bigint, 0),
          asks_for_wording = coalesce((x.body ->> 'asks_for_wording')::boolean, false),
          text_max = coalesce((x.body ->> 'text_max')::integer, 100),
          product_id = case when want_shared then null else pid end,
          price_by_variation = (not want_shared) and coalesce((x.body ->> 'price_by_variation')::boolean, false)
         where id = xid and organisation_id = p_org;
      else
        insert into public.extras (organisation_id, product_id, name, price_cents, asks_for_wording, text_max, price_by_variation)
        values (
          p_org, case when want_shared then null else pid end, x.body ->> 'name',
          coalesce((x.body ->> 'price_cents')::bigint, 0),
          coalesce((x.body ->> 'asks_for_wording')::boolean, false),
          coalesce((x.body ->> 'text_max')::integer, 100),
          (not want_shared) and coalesce((x.body ->> 'price_by_variation')::boolean, false)
        )
        returning id into xid;
      end if;

      insert into public.product_extras (organisation_id, product_id, extra_id, sort_order)
      values (p_org, pid, xid, x.ord - 1)
      on conflict (product_id, extra_id) do update set sort_order = excluded.sort_order;

      -- Prices by variation (product-only extras), by the variation's place in the product's list.
      delete from public.extra_variation_prices where extra_id = xid and organisation_id = p_org;
      if (not want_shared) and coalesce((x.body ->> 'price_by_variation')::boolean, false) then
        insert into public.extra_variation_prices (organisation_id, extra_id, variation_id, price_cents)
        select p_org, xid, pv.id, (pr.value ->> 'price_cents')::bigint
          from jsonb_array_elements(coalesce(x.body -> 'prices', '[]'::jsonb)) as pr(value)
          join (
            select v.id, row_number() over (order by v.sort_order, v.created_at) - 1 as idx
              from public.product_variations v where v.product_id = pid
          ) pv on pv.idx = (pr.value ->> 'variation_index')::bigint;
      end if;
    end loop;
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
