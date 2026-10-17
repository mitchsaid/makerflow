-- Quantity prices live with the price, per variation, as a percent or an amount (docs/plans/quantity-prices-and-steps.md,
-- "Quantity prices, second design"; founder, 2026-10-17: "quantity prices should set where you manage prices ... there
-- should be percentage or amount deducted ... same pattern for variations").
--
-- SECURITY-SENSITIVE: changes a table that has row-level security (new columns, new grants), a SECURITY DEFINER
-- trigger function, and a replaced SECURITY INVOKER save_product_layers. Needs human review before it is applied to
-- any hosted project. Nothing is dropped except one uniqueness rule that is replaced by a wider one.
--
-- WHAT CHANGES
-- * product_price_breaks.variation_id: the variation whose price the row lowers; null for a product with one price.
--   A product with variations has its rows on its variations. The composite foreign key keeps it in the same business,
--   and a deleted variation takes its rows with it.
-- * product_price_breaks.amount_off_cents: an amount taken off, in the same price entry mode as the price. Each row
--   has exactly one of percent_off_bp and amount_off_cents.
-- * One row per quantity per (product, variation); at most 10 per (product, variation).
-- * Rows made before this on a product that has variations (which applied to whichever variation was chosen) are
--   copied onto every variation, so a quote prices exactly as it did.
-- * save_product_layers (replaced, same signature): a row is {from_quantity_milli, percent_off_bp | amount_off_cents,
--   variation: place among the saved variations | null}. An amount must be less than the price it comes off.
-- ---------------------------------------------------------------------------

alter table public.product_price_breaks add column variation_id uuid;
alter table public.product_price_breaks add column amount_off_cents bigint check (amount_off_cents between 1 and 99999999999);
alter table public.product_price_breaks alter column percent_off_bp drop not null;
alter table public.product_price_breaks
  add constraint product_price_breaks_one_kind check ((percent_off_bp is not null) <> (amount_off_cents is not null));
alter table public.product_price_breaks
  add constraint product_price_breaks_variation_same_org
  foreign key (organisation_id, variation_id) references public.product_variations (organisation_id, id)
  on delete cascade;

-- One row per quantity for each price it can lower.
alter table public.product_price_breaks drop constraint product_price_breaks_quantity_unique;
create unique index product_price_breaks_quantity_unique
  on public.product_price_breaks (product_id, coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid), from_quantity_milli);
create index product_price_breaks_variation_idx on public.product_price_breaks (variation_id) where variation_id is not null;

grant insert (variation_id, amount_off_cents) on public.product_price_breaks to authenticated;
-- (no update grant for the new columns: save_product_layers replaces rows, and moving a row to another price could skip the limit)

-- At most 10 for each price (the product's, or one variation's).
create or replace function public.product_price_breaks_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_price_breaks:' || new.product_id::text, 0));
  if (select count(*) from public.product_price_breaks
       where product_id = new.product_id and variation_id is not distinct from new.variation_id) >= 10 then
    raise exception 'a price can have at most 10 quantity prices' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- Earlier rows on a product with variations: one copy for each variation, then the originals go.
insert into public.product_price_breaks (organisation_id, product_id, variation_id, from_quantity_milli, percent_off_bp)
select b.organisation_id, b.product_id, v.id, b.from_quantity_milli, b.percent_off_bp
  from public.product_price_breaks b
  join public.product_variations v on v.product_id = b.product_id and v.organisation_id = b.organisation_id
 where b.variation_id is null and b.percent_off_bp is not null;
delete from public.product_price_breaks b
 where b.variation_id is null
   and exists (select 1 from public.product_variations v where v.product_id = b.product_id and v.organisation_id = b.organisation_id);

-- ---------------------------------------------------------------------------
-- save_product_layers (same signature, so its revokes and grants stay).
-- ---------------------------------------------------------------------------
create or replace function public.save_product_layers(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null,
  p_extras jsonb default null,
  p_price_breaks jsonb default null,
  p_steps jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid;
  b jsonb;
  cond jsonb;
  st record;
  cd record;
  sid uuid;
  rid uuid;
  ref jsonb;
  bad_step constant text := 'a step is not valid';
begin
  if p_price_breaks is not null then
    if jsonb_typeof(p_price_breaks) <> 'array' then
      raise exception 'quantity prices must be a list' using errcode = '22023';
    end if;
    -- (ten for each price, and up to 50 variations; the table's trigger counts them for each variation)
    if jsonb_array_length(p_price_breaks) > 500 then
      raise exception 'too many quantity prices' using errcode = '54000';
    end if;
    for b in select * from jsonb_array_elements(p_price_breaks) loop
      if jsonb_typeof(b) <> 'object'
         or (b ->> 'from_quantity_milli') is null or (b ->> 'from_quantity_milli') !~ '^[0-9]{1,10}$'
         -- exactly one of a percent and an amount
         or ((b ->> 'percent_off_bp') is null) = ((b ->> 'amount_off_cents') is null)
         or ((b ->> 'percent_off_bp') is not null and (b ->> 'percent_off_bp') !~ '^[0-9]{1,4}$')
         or ((b ->> 'amount_off_cents') is not null
             and (jsonb_typeof(b -> 'amount_off_cents') <> 'number' or (b ->> 'amount_off_cents') !~ '^[0-9]{1,11}$'))
         -- which variation's price it is taken from: its place among the variations saved with the product, or none
         or (b -> 'variation' is not null and jsonb_typeof(b -> 'variation') not in ('null', 'number'))
         or (jsonb_typeof(b -> 'variation') = 'number' and (b ->> 'variation') !~ '^[0-9]{1,4}$') then
        raise exception 'a quantity price is not valid' using errcode = '22023';
      end if;
    end loop;
  end if;

  if p_steps is not null then
    if jsonb_typeof(p_steps) <> 'array' then
      raise exception 'steps must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_steps) > 30 then
      raise exception 'a product can have at most 30 steps' using errcode = '54000';
    end if;
    for b in select * from jsonb_array_elements(p_steps) loop
      if jsonb_typeof(b) <> 'object'
         or jsonb_typeof(b -> 'name') is distinct from 'string'
         or char_length(btrim(b ->> 'name')) not between 1 and 120
         or (b -> 'logic' is not null and jsonb_typeof(b -> 'logic') not in ('string', 'null'))
         or coalesce(b ->> 'logic', 'all') not in ('all', 'any')
         or (b -> 'conditions' is not null and jsonb_typeof(b -> 'conditions') not in ('array', 'null')) then
        raise exception '%', bad_step using errcode = '22023';
      end if;
      if jsonb_typeof(b -> 'conditions') = 'array' then
        if jsonb_array_length(b -> 'conditions') > 10 then
          raise exception 'a step can have at most 10 conditions' using errcode = '54000';
        end if;
        for cond in select * from jsonb_array_elements(b -> 'conditions') loop
          if jsonb_typeof(cond) <> 'object'
             or jsonb_typeof(cond -> 'kind') is distinct from 'string'
             or (cond ->> 'kind') not in ('chosen', 'quantity')
             or (cond -> 'negate' is not null and jsonb_typeof(cond -> 'negate') not in ('boolean', 'null')) then
            raise exception '%', bad_step using errcode = '22023';
          end if;
          if cond ->> 'kind' = 'quantity' then
            if jsonb_typeof(cond -> 'quantityMilli') is distinct from 'number'
               or (cond ->> 'quantityMilli') !~ '^[0-9]{1,10}$'
               or (cond ->> 'quantityMilli')::bigint not between 1 and 9999999999 then
              raise exception '%', bad_step using errcode = '22023';
            end if;
          else
            ref := cond -> 'ref';
            if jsonb_typeof(ref) is distinct from 'object'
               or (ref ->> 'type') is null or (ref ->> 'type') not in ('variation', 'option_value', 'extra')
               or (ref ->> 'index') is null or (ref ->> 'index') !~ '^[0-9]{1,4}$'
               or ((ref ->> 'type') = 'option_value'
                   and ((ref ->> 'group') is null or (ref ->> 'group') !~ '^[0-9]{1,4}$')) then
              raise exception '%', bad_step using errcode = '22023';
            end if;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  pid := public.save_product(p_org, p_product_id, p_product, p_variations, p_options, p_extras);

  if p_price_breaks is not null then
    delete from public.product_price_breaks where product_id = pid and organisation_id = p_org;
    for st in
      select e.value as brk, e.ord from jsonb_array_elements(p_price_breaks) with ordinality as e(value, ord) order by e.ord
    loop
      rid := null;
      if jsonb_typeof(st.brk -> 'variation') = 'number' then
        select v.id into rid from public.product_variations v
         where v.organisation_id = p_org and v.product_id = pid and v.sort_order = (st.brk ->> 'variation')::integer;
        if rid is null then
          raise exception 'a quantity price is for a variation the product does not have' using errcode = '22023';
        end if;
      end if;
      insert into public.product_price_breaks (organisation_id, product_id, variation_id, from_quantity_milli, percent_off_bp, amount_off_cents)
      values (p_org, pid, rid, (st.brk ->> 'from_quantity_milli')::bigint,
              (st.brk ->> 'percent_off_bp')::integer, (st.brk ->> 'amount_off_cents')::bigint);
    end loop;
    -- With variations each has its own quantity prices; without, the product has them.
    if exists (select 1 from public.product_variations where product_id = pid and organisation_id = p_org)
       and exists (select 1 from public.product_price_breaks where product_id = pid and variation_id is null) then
      raise exception 'quantity prices belong to a variation when the product has variations' using errcode = '22023';
    end if;
  end if;

  -- An amount taken off is always less than the price it is taken from (also when only the prices were changed).
  if exists (
    select 1
      from public.product_price_breaks b
      join public.products p on p.id = b.product_id and p.organisation_id = b.organisation_id
      left join public.product_variations v on v.id = b.variation_id and v.organisation_id = b.organisation_id
     where b.product_id = pid and b.organisation_id = p_org
       and b.amount_off_cents is not null
       and b.amount_off_cents >= coalesce(v.price_cents, p.unit_price_cents)
  ) then
    raise exception 'a quantity price takes off the whole price or more' using errcode = '22023';
  end if;

  if p_steps is not null then
    -- (the conditions go with their steps)
    delete from public.product_steps where product_id = pid and organisation_id = p_org;
    for st in
      select e.value as step, e.ord from jsonb_array_elements(p_steps) with ordinality as e(value, ord) order by e.ord
    loop
      insert into public.product_steps (organisation_id, product_id, name, sort_order, condition_logic)
      values (p_org, pid, btrim(st.step ->> 'name'), (st.ord - 1)::integer, coalesce(st.step ->> 'logic', 'all'))
      returning id into sid;

      for cd in
        select c.value as cond, c.ord
          from jsonb_array_elements(case when jsonb_typeof(st.step -> 'conditions') = 'array' then st.step -> 'conditions' else '[]'::jsonb end)
               with ordinality as c(value, ord)
         order by c.ord
      loop
        if cd.cond ->> 'kind' = 'quantity' then
          insert into public.product_step_conditions (organisation_id, step_id, sort_order, kind, negate, quantity_milli)
          values (p_org, sid, (cd.ord - 1)::integer, 'quantity_at_least',
                  coalesce((cd.cond ->> 'negate')::boolean, false), (cd.cond ->> 'quantityMilli')::bigint);
        else
          ref := cd.cond -> 'ref';
          rid := null;
          -- The choice is found by its position among those saved with the product.
          if ref ->> 'type' = 'variation' then
            select v.id into rid from public.product_variations v
             where v.organisation_id = p_org and v.product_id = pid and v.sort_order = (ref ->> 'index')::integer;
          elsif ref ->> 'type' = 'option_value' then
            select ov.id into rid
              from public.product_option_values ov
              join public.product_option_groups g on g.id = ov.group_id and g.organisation_id = ov.organisation_id
             where g.organisation_id = p_org and g.product_id = pid
               and g.sort_order = (ref ->> 'group')::integer and ov.sort_order = (ref ->> 'index')::integer;
          else
            select pe.extra_id into rid from public.product_extras pe
             where pe.organisation_id = p_org and pe.product_id = pid and pe.sort_order = (ref ->> 'index')::integer;
          end if;
          if rid is null then
            raise exception 'a step depends on a choice the product does not have' using errcode = '22023';
          end if;
          insert into public.product_step_conditions (organisation_id, step_id, sort_order, kind, negate, variation_id, option_value_id, extra_id)
          values (p_org, sid, (cd.ord - 1)::integer, 'chosen', coalesce((cd.cond ->> 'negate')::boolean, false),
                  case when ref ->> 'type' = 'variation' then rid end,
                  case when ref ->> 'type' = 'option_value' then rid end,
                  case when ref ->> 'type' = 'extra' then rid end);
        end if;
      end loop;
    end loop;
  end if;

  return pid;
end;
$$;
