-- What it costs to make a product (docs/plans/costing-and-margin.md, slice A; founder, 2026-10-17: costing and margin
-- first, to demo on a quote).
--
-- SECURITY-SENSITIVE: two new tables with row-level security and column grants, new columns with column grants on two
-- more, a new SECURITY INVOKER function, and a replaced SECURITY INVOKER save_product_layers (it gains one parameter).
-- Money. Needs human review before it is applied to any hosted project. Nothing is dropped except the old signature of
-- save_product_layers, replaced by one with the extra parameter.
--
-- * business_profiles.labour_rate_cents: what an hour of the maker's time is worth (null: not set). Owners and admins
--   change it through the existing profile policy and a new column grant.
-- * products.makes_milli: how many one batch makes (thousandths; 1000 is one). The cost lines are for a batch.
-- * product_cost_lines: what goes into a batch. kind 'material' (a material of the same business, an amount and a unit),
--   'time' (whole minutes of the maker's time at the business's hourly rate) or 'other' (a name and an amount). Each
--   line applies always or only for some items. At most 40 a product. A material that a line uses cannot be deleted
--   (materials are archived, never deleted).
-- * product_cost_line_conditions: the same shape and rules as product_step_conditions (a variation, a list choice, an
--   extra or a quantity; chosen or not; all or any), so steps and costs depend on choices the same way. At most 10 a
--   line.
-- * save_product_costs: saves a product's batch size and cost lines in one go; null leaves them, a list replaces them.
--   A condition refers to a choice by its position among the variations, lists and extras saved in the same call.
--   save_product_layers calls it (new parameter p_costs), so everything is one transaction under the person's own access.
-- Nothing here works out a cost: that is done in the app (lib/costing), in whole numbers.
-- ---------------------------------------------------------------------------

alter table public.business_profiles
  add column labour_rate_cents bigint check (labour_rate_cents is null or labour_rate_cents between 0 and 99999999999);
grant update (labour_rate_cents) on public.business_profiles to authenticated;

alter table public.products
  add column makes_milli bigint not null default 1000 check (makes_milli between 1 and 9999999999);
grant insert (makes_milli), update (makes_milli) on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- product_cost_lines
-- ---------------------------------------------------------------------------
create table public.product_cost_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  kind text not null check (kind in ('material', 'time', 'other')),
  condition_logic text not null default 'all' check (condition_logic in ('all', 'any')),
  material_id uuid,
  amount_milli bigint check (amount_milli between 1 and 9999999999),
  unit text check (unit in ('mg', 'g', 'kg', 'ml', 'l', 'mm', 'cm', 'm', 'each', 'dozen')),
  minutes integer check (minutes between 1 and 99999),
  name text check (name is null or char_length(btrim(name)) between 1 and 120),
  cents bigint check (cents between 0 and 99999999999),
  created_at timestamptz not null default now(),
  constraint product_cost_lines_org_id_unique unique (organisation_id, id),
  constraint product_cost_lines_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade,
  -- No cascade: a material that a line uses is archived, never deleted.
  constraint product_cost_lines_material_same_org
    foreign key (organisation_id, material_id) references public.materials (organisation_id, id),
  constraint product_cost_lines_shape check (
    (kind = 'material' and material_id is not null and amount_milli is not null and unit is not null
      and minutes is null and name is null and cents is null)
    or
    (kind = 'time' and minutes is not null
      and material_id is null and amount_milli is null and unit is null and name is null and cents is null)
    or
    (kind = 'other' and name is not null and cents is not null
      and material_id is null and amount_milli is null and unit is null and minutes is null)
  )
);

create index product_cost_lines_product_idx on public.product_cost_lines (organisation_id, product_id, sort_order);
create index product_cost_lines_material_idx on public.product_cost_lines (material_id) where material_id is not null;

-- A product has at most 40 cost lines.
create function public.product_cost_lines_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_cost_lines:' || new.product_id::text, 0));
  if (select count(*) from public.product_cost_lines where product_id = new.product_id) >= 40 then
    raise exception 'a product can have at most 40 cost lines' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_cost_lines_limit() from public, anon, authenticated;

create trigger product_cost_lines_limit
  before insert on public.product_cost_lines
  for each row execute function public.product_cost_lines_limit();

revoke all on public.product_cost_lines from anon, authenticated;
grant select, delete on public.product_cost_lines to authenticated;
grant insert (organisation_id, product_id, sort_order, kind, condition_logic, material_id, amount_milli, unit, minutes, name, cents)
  on public.product_cost_lines to authenticated;
grant update (sort_order, kind, condition_logic, material_id, amount_milli, unit, minutes, name, cents)
  on public.product_cost_lines to authenticated;

alter table public.product_cost_lines enable row level security;

create policy product_cost_lines_select_members
  on public.product_cost_lines for select to authenticated
  using (public.is_org_member(organisation_id));
create policy product_cost_lines_insert_members
  on public.product_cost_lines for insert to authenticated
  with check (public.is_org_member(organisation_id));
create policy product_cost_lines_update_members
  on public.product_cost_lines for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));
create policy product_cost_lines_delete_members
  on public.product_cost_lines for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.product_cost_lines
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- product_cost_line_conditions (the same rules as product_step_conditions)
-- ---------------------------------------------------------------------------
create table public.product_cost_line_conditions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  line_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  kind text not null check (kind in ('chosen', 'quantity_at_least')),
  negate boolean not null default false,
  variation_id uuid,
  option_value_id uuid,
  extra_id uuid,
  quantity_milli bigint check (quantity_milli between 1 and 9999999999),
  created_at timestamptz not null default now(),
  constraint product_cost_line_conditions_line_same_org
    foreign key (organisation_id, line_id) references public.product_cost_lines (organisation_id, id)
    on delete cascade,
  constraint product_cost_line_conditions_variation_same_org
    foreign key (organisation_id, variation_id) references public.product_variations (organisation_id, id)
    on delete cascade,
  constraint product_cost_line_conditions_value_same_org
    foreign key (organisation_id, option_value_id) references public.product_option_values (organisation_id, id)
    on delete cascade,
  constraint product_cost_line_conditions_extra_same_org
    foreign key (organisation_id, extra_id) references public.extras (organisation_id, id)
    on delete cascade,
  constraint product_cost_line_conditions_shape check (
    (kind = 'chosen'
      and quantity_milli is null
      and num_nonnulls(variation_id, option_value_id, extra_id) = 1)
    or
    (kind = 'quantity_at_least'
      and quantity_milli is not null
      and num_nonnulls(variation_id, option_value_id, extra_id) = 0)
  )
);

create index product_cost_line_conditions_line_idx on public.product_cost_line_conditions (line_id, sort_order);
create index product_cost_line_conditions_variation_idx on public.product_cost_line_conditions (variation_id) where variation_id is not null;
create index product_cost_line_conditions_value_idx on public.product_cost_line_conditions (option_value_id) where option_value_id is not null;
create index product_cost_line_conditions_extra_idx on public.product_cost_line_conditions (extra_id) where extra_id is not null;

-- A line has at most 10 conditions.
create function public.product_cost_line_conditions_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_cost_line_conditions:' || new.line_id::text, 0));
  if (select count(*) from public.product_cost_line_conditions where line_id = new.line_id) >= 10 then
    raise exception 'a cost line can have at most 10 conditions' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_cost_line_conditions_limit() from public, anon, authenticated;

create trigger product_cost_line_conditions_limit
  before insert on public.product_cost_line_conditions
  for each row execute function public.product_cost_line_conditions_limit();

revoke all on public.product_cost_line_conditions from anon, authenticated;
grant select, delete on public.product_cost_line_conditions to authenticated;
grant insert (organisation_id, line_id, sort_order, kind, negate, variation_id, option_value_id, extra_id, quantity_milli)
  on public.product_cost_line_conditions to authenticated;

alter table public.product_cost_line_conditions enable row level security;

create policy product_cost_line_conditions_select_members
  on public.product_cost_line_conditions for select to authenticated
  using (public.is_org_member(organisation_id));
create policy product_cost_line_conditions_insert_members
  on public.product_cost_line_conditions for insert to authenticated
  with check (public.is_org_member(organisation_id));
create policy product_cost_line_conditions_delete_members
  on public.product_cost_line_conditions for delete to authenticated
  using (public.is_org_member(organisation_id));

create policy session_required on public.product_cost_line_conditions
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- save_product_costs
--
-- p_costs: {"makes_milli": 12000, "lines": [ ... ]}. Either key may be left out to leave that part as it is; "lines"
-- replaces all the product's lines. A line is
--   {"kind": "material", "material_id": "...", "amount_milli": 500, "unit": "kg", "logic": "all"|"any", "conditions": [...]}
--   {"kind": "time", "minutes": 30, ...}   {"kind": "other", "name": "Box", "cents": 1250, ...}
-- and a condition is as for steps: {"kind": "chosen", "negate": false, "ref": {"type": "variation"|"option_value"|"extra",
-- "group": 0, "index": 1}} or {"kind": "quantity", "negate": false, "quantityMilli": 12000}, where the indexes are
-- positions among the variations, lists and extras saved with the product.
-- Errors: P0002 the product is not found; 22023 something is not valid or points at a choice or material that is not
-- there; 54000 more than 40 lines or 10 conditions; everything the tables raise.
-- ---------------------------------------------------------------------------
create function public.save_product_costs(p_org uuid, p_product_id uuid, p_costs jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ln jsonb;
  cond jsonb;
  ref jsonb;
  st record;
  cd record;
  lid uuid;
  rid uuid;
  bad constant text := 'a cost line is not valid';
begin
  if not exists (select 1 from public.products where id = p_product_id and organisation_id = p_org) then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if p_costs is null or jsonb_typeof(p_costs) <> 'object' then
    raise exception 'costs must be an object' using errcode = '22023';
  end if;
  if p_costs ? 'makes_milli' and (jsonb_typeof(p_costs -> 'makes_milli') <> 'number'
      or (p_costs ->> 'makes_milli') !~ '^[0-9]{1,10}$' or (p_costs ->> 'makes_milli')::bigint not between 1 and 9999999999) then
    raise exception 'how many it makes is not valid' using errcode = '22023';
  end if;
  if p_costs ? 'lines' then
    if jsonb_typeof(p_costs -> 'lines') <> 'array' then
      raise exception 'cost lines must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_costs -> 'lines') > 40 then
      raise exception 'a product can have at most 40 cost lines' using errcode = '54000';
    end if;
    for ln in select * from jsonb_array_elements(p_costs -> 'lines') loop
      if jsonb_typeof(ln) <> 'object'
         or jsonb_typeof(ln -> 'kind') is distinct from 'string'
         or (ln ->> 'kind') not in ('material', 'time', 'other')
         or (ln -> 'logic' is not null and jsonb_typeof(ln -> 'logic') not in ('string', 'null'))
         or coalesce(ln ->> 'logic', 'all') not in ('all', 'any')
         or (ln -> 'conditions' is not null and jsonb_typeof(ln -> 'conditions') not in ('array', 'null')) then
        raise exception '%', bad using errcode = '22023';
      end if;
      if ln ->> 'kind' = 'material' then
        if jsonb_typeof(ln -> 'material_id') is distinct from 'string'
           or (ln ->> 'material_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or jsonb_typeof(ln -> 'amount_milli') is distinct from 'number'
           or (ln ->> 'amount_milli') !~ '^[0-9]{1,10}$' or (ln ->> 'amount_milli')::bigint not between 1 and 9999999999
           or jsonb_typeof(ln -> 'unit') is distinct from 'string'
           or (ln ->> 'unit') not in ('mg', 'g', 'kg', 'ml', 'l', 'mm', 'cm', 'm', 'each', 'dozen') then
          raise exception '%', bad using errcode = '22023';
        end if;
      elsif ln ->> 'kind' = 'time' then
        if jsonb_typeof(ln -> 'minutes') is distinct from 'number'
           or (ln ->> 'minutes') !~ '^[0-9]{1,5}$' or (ln ->> 'minutes')::integer not between 1 and 99999 then
          raise exception '%', bad using errcode = '22023';
        end if;
      else
        if jsonb_typeof(ln -> 'name') is distinct from 'string'
           or char_length(btrim(ln ->> 'name')) not between 1 and 120
           or jsonb_typeof(ln -> 'cents') is distinct from 'number'
           or (ln ->> 'cents') !~ '^[0-9]{1,11}$' then
          raise exception '%', bad using errcode = '22023';
        end if;
      end if;
      if jsonb_typeof(ln -> 'conditions') = 'array' then
        if jsonb_array_length(ln -> 'conditions') > 10 then
          raise exception 'a cost line can have at most 10 conditions' using errcode = '54000';
        end if;
        for cond in select * from jsonb_array_elements(ln -> 'conditions') loop
          if jsonb_typeof(cond) <> 'object'
             or jsonb_typeof(cond -> 'kind') is distinct from 'string'
             or (cond ->> 'kind') not in ('chosen', 'quantity')
             or (cond -> 'negate' is not null and jsonb_typeof(cond -> 'negate') not in ('boolean', 'null')) then
            raise exception '%', bad using errcode = '22023';
          end if;
          if cond ->> 'kind' = 'quantity' then
            if jsonb_typeof(cond -> 'quantityMilli') is distinct from 'number'
               or (cond ->> 'quantityMilli') !~ '^[0-9]{1,10}$'
               or (cond ->> 'quantityMilli')::bigint not between 1 and 9999999999 then
              raise exception '%', bad using errcode = '22023';
            end if;
          else
            ref := cond -> 'ref';
            if jsonb_typeof(ref) is distinct from 'object'
               or (ref ->> 'type') is null or (ref ->> 'type') not in ('variation', 'option_value', 'extra')
               or (ref ->> 'index') is null or (ref ->> 'index') !~ '^[0-9]{1,4}$'
               or ((ref ->> 'type') = 'option_value'
                   and ((ref ->> 'group') is null or (ref ->> 'group') !~ '^[0-9]{1,4}$')) then
              raise exception '%', bad using errcode = '22023';
            end if;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  if p_costs ? 'makes_milli' then
    update public.products set makes_milli = (p_costs ->> 'makes_milli')::bigint
     where id = p_product_id and organisation_id = p_org;
  end if;

  if p_costs ? 'lines' then
    -- (the conditions go with their lines)
    delete from public.product_cost_lines where product_id = p_product_id and organisation_id = p_org;
    for st in
      select e.value as line, e.ord from jsonb_array_elements(p_costs -> 'lines') with ordinality as e(value, ord) order by e.ord
    loop
      insert into public.product_cost_lines (
        organisation_id, product_id, sort_order, kind, condition_logic, material_id, amount_milli, unit, minutes, name, cents
      ) values (
        p_org, p_product_id, (st.ord - 1)::integer, st.line ->> 'kind', coalesce(st.line ->> 'logic', 'all'),
        case when st.line ->> 'kind' = 'material' then (st.line ->> 'material_id')::uuid end,
        case when st.line ->> 'kind' = 'material' then (st.line ->> 'amount_milli')::bigint end,
        case when st.line ->> 'kind' = 'material' then st.line ->> 'unit' end,
        case when st.line ->> 'kind' = 'time' then (st.line ->> 'minutes')::integer end,
        case when st.line ->> 'kind' = 'other' then btrim(st.line ->> 'name') end,
        case when st.line ->> 'kind' = 'other' then (st.line ->> 'cents')::bigint end
      ) returning id into lid;

      for cd in
        select c.value as cond, c.ord
          from jsonb_array_elements(case when jsonb_typeof(st.line -> 'conditions') = 'array' then st.line -> 'conditions' else '[]'::jsonb end)
               with ordinality as c(value, ord)
         order by c.ord
      loop
        if cd.cond ->> 'kind' = 'quantity' then
          insert into public.product_cost_line_conditions (organisation_id, line_id, sort_order, kind, negate, quantity_milli)
          values (p_org, lid, (cd.ord - 1)::integer, 'quantity_at_least',
                  coalesce((cd.cond ->> 'negate')::boolean, false), (cd.cond ->> 'quantityMilli')::bigint);
        else
          ref := cd.cond -> 'ref';
          rid := null;
          -- The choice is found by its position among those saved with the product.
          if ref ->> 'type' = 'variation' then
            select v.id into rid from public.product_variations v
             where v.organisation_id = p_org and v.product_id = p_product_id and v.sort_order = (ref ->> 'index')::integer;
          elsif ref ->> 'type' = 'option_value' then
            select ov.id into rid
              from public.product_option_values ov
              join public.product_option_groups g on g.id = ov.group_id and g.organisation_id = ov.organisation_id
             where g.organisation_id = p_org and g.product_id = p_product_id
               and g.sort_order = (ref ->> 'group')::integer and ov.sort_order = (ref ->> 'index')::integer;
          else
            select pe.extra_id into rid from public.product_extras pe
             where pe.organisation_id = p_org and pe.product_id = p_product_id and pe.sort_order = (ref ->> 'index')::integer;
          end if;
          if rid is null then
            raise exception 'a cost depends on a choice the product does not have' using errcode = '22023';
          end if;
          insert into public.product_cost_line_conditions (organisation_id, line_id, sort_order, kind, negate, variation_id, option_value_id, extra_id)
          values (p_org, lid, (cd.ord - 1)::integer, 'chosen', coalesce((cd.cond ->> 'negate')::boolean, false),
                  case when ref ->> 'type' = 'variation' then rid end,
                  case when ref ->> 'type' = 'option_value' then rid end,
                  case when ref ->> 'type' = 'extra' then rid end);
        end if;
      end loop;
    end loop;
  end if;
end;
$$;

revoke execute on function public.save_product_costs(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_product_costs(uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_product_layers, with p_costs (the old signature is replaced).
-- ---------------------------------------------------------------------------
drop function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);

create function public.save_product_layers(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null,
  p_extras jsonb default null,
  p_price_breaks jsonb default null,
  p_steps jsonb default null,
  p_costs jsonb default null
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

  -- What it costs to make (docs/plans/costing-and-margin.md): its own function, in the same transaction.
  if p_costs is not null then
    perform public.save_product_costs(p_org, pid, p_costs);
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
