-- Extras priced by variation (slice 3 of docs/plans/product-choices.md): gold leaf +R50 on a Small
-- cake, +R120 on a Large. A "choose one" or "choose any" option can say its price depends on the
-- variation; each of its values then has a price for each of the product's variations.
--
-- SECURITY-SENSITIVE: a new table with row-level security, a new column, a replaced save_product
-- (SECURITY INVOKER). Prices: human review.

alter table public.product_option_groups
  add column price_by_variation boolean not null default false;
alter table public.product_option_groups
  add constraint product_option_groups_price_by_variation_kind check (kind <> 'text' or not price_by_variation);
grant insert (price_by_variation), update (price_by_variation) on public.product_option_groups to authenticated;

create table public.product_option_value_prices (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  value_id uuid not null,
  variation_id uuid not null,
  -- Added to the price for that variation (in the business's VAT entry mode).
  price_cents bigint not null check (price_cents between 0 and 99999999999),
  primary key (value_id, variation_id),
  constraint product_option_value_prices_value_same_org
    foreign key (organisation_id, value_id) references public.product_option_values (organisation_id, id) on delete cascade,
  constraint product_option_value_prices_variation_same_org
    foreign key (organisation_id, variation_id) references public.product_variations (organisation_id, id) on delete cascade
);

create index product_option_value_prices_org_idx on public.product_option_value_prices (organisation_id, value_id);
create index product_option_value_prices_variation_idx on public.product_option_value_prices (organisation_id, variation_id);

-- The variation must be one of the SAME product as the value's option (the keys only say same business).
create function public.product_option_value_prices_same_product()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.product_option_values ov
      join public.product_option_groups g on g.id = ov.group_id
      join public.product_variations v on v.product_id = g.product_id
     where ov.id = new.value_id and v.id = new.variation_id
  ) then
    raise exception 'a price must be for a variation of the same product' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_option_value_prices_same_product() from public, anon, authenticated;

create trigger product_option_value_prices_same_product
  before insert or update on public.product_option_value_prices
  for each row execute function public.product_option_value_prices_same_product();

revoke all on public.product_option_value_prices from anon, authenticated;
grant select, delete on public.product_option_value_prices to authenticated;
grant insert (organisation_id, value_id, variation_id, price_cents) on public.product_option_value_prices to authenticated;
grant update (price_cents) on public.product_option_value_prices to authenticated;

alter table public.product_option_value_prices enable row level security;

create policy product_option_value_prices_select_members on public.product_option_value_prices
  for select to authenticated using (public.is_org_member(organisation_id));
create policy product_option_value_prices_insert_members on public.product_option_value_prices
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy product_option_value_prices_update_members on public.product_option_value_prices
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy product_option_value_prices_delete_members on public.product_option_value_prices
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.product_option_value_prices
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- save_product: as before; an option may carry price_by_variation, and each of its values
-- prices: [{ variation_index, price_cents }] (the variation's place in the product's list, from 0).
-- ---------------------------------------------------------------------------

create or replace function public.save_product(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null
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

  -- Options and extras: null leaves them as they are; otherwise the list replaces them (keeping ids).
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

  return pid;
end;
$$;

