-- Costing, slice B2 (docs/plans/costing-and-margin.md): an extra can have its own cost lines (a gift box uses a box and
-- five minutes), counted by how many of it are on an item.
--
-- SECURITY-SENSITIVE: a new table with row-level security and column grants, a new function, and a replaced SECURITY
-- INVOKER save_product_costs (same signature). Money. Needs human review before it is applied to any hosted project.
-- Nothing is dropped.
--
-- * extra_cost_lines: what goes into ONE of the extra: a material of the same business, the maker's time, or another
--   cost (the same three kinds and shape as product_cost_lines, without conditions). At most 20 an extra. A material a
--   line uses cannot be deleted. A shared extra has them once, for every product that has it.
-- * cost_line_check: the one place that says whether a cost line in a payload is valid (raises 22023), used for extras.
-- * save_product_costs also takes "extras": [{"index": 0, "lines": [...]}], an extra named by its place among the
--   product's extras (the same way a condition names a choice). An extra not named is left as it is. Only the extras the
--   form changed are sent.
-- ---------------------------------------------------------------------------

create table public.extra_cost_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  extra_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  kind text not null check (kind in ('material', 'time', 'other')),
  material_id uuid,
  amount_milli bigint check (amount_milli between 1 and 9999999999),
  unit text check (unit in ('mg', 'g', 'kg', 'ml', 'l', 'mm', 'cm', 'm', 'each', 'dozen')),
  minutes integer check (minutes between 1 and 99999),
  name text check (name is null or char_length(btrim(name)) between 1 and 120),
  cents bigint check (cents between 0 and 99999999999),
  created_at timestamptz not null default now(),
  constraint extra_cost_lines_extra_same_org
    foreign key (organisation_id, extra_id) references public.extras (organisation_id, id)
    on delete cascade,
  -- No cascade: a material that a line uses is archived, never deleted.
  constraint extra_cost_lines_material_same_org
    foreign key (organisation_id, material_id) references public.materials (organisation_id, id),
  constraint extra_cost_lines_shape check (
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

create index extra_cost_lines_extra_idx on public.extra_cost_lines (organisation_id, extra_id, sort_order);
create index extra_cost_lines_material_idx on public.extra_cost_lines (material_id) where material_id is not null;

create function public.extra_cost_lines_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('extra_cost_lines:' || new.extra_id::text, 0));
  if (select count(*) from public.extra_cost_lines where extra_id = new.extra_id) >= 20 then
    raise exception 'an extra can have at most 20 cost lines' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.extra_cost_lines_limit() from public, anon, authenticated;

create trigger extra_cost_lines_limit
  before insert on public.extra_cost_lines
  for each row execute function public.extra_cost_lines_limit();

revoke all on public.extra_cost_lines from anon, authenticated;
grant select, delete on public.extra_cost_lines to authenticated;
grant insert (organisation_id, extra_id, sort_order, kind, material_id, amount_milli, unit, minutes, name, cents)
  on public.extra_cost_lines to authenticated;

alter table public.extra_cost_lines enable row level security;

create policy extra_cost_lines_select_members
  on public.extra_cost_lines for select to authenticated
  using (public.is_org_member(organisation_id));
create policy extra_cost_lines_insert_members
  on public.extra_cost_lines for insert to authenticated
  with check (public.is_org_member(organisation_id));
create policy extra_cost_lines_delete_members
  on public.extra_cost_lines for delete to authenticated
  using (public.is_org_member(organisation_id));

create policy session_required on public.extra_cost_lines
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- cost_line_check: raises 22023 unless a cost line in a payload is a valid material, time or other cost.
-- ---------------------------------------------------------------------------
create function public.cost_line_check(ln jsonb)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  bad constant text := 'a cost line is not valid';
begin
  if jsonb_typeof(ln) <> 'object' or jsonb_typeof(ln -> 'kind') is distinct from 'string'
     or (ln ->> 'kind') not in ('material', 'time', 'other') then
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
end;
$$;

revoke execute on function public.cost_line_check(jsonb) from public, anon;
grant execute on function public.cost_line_check(jsonb) to authenticated;

create or replace function public.save_product_costs(p_org uuid, p_product_id uuid, p_costs jsonb)
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
  ex jsonb;
  xid uuid;
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

  -- Extras' own costs: [{"index": 0, "lines": [...]}], an extra named by its place among the product's extras.
  if p_costs ? 'extras' then
    if jsonb_typeof(p_costs -> 'extras') <> 'array' then
      raise exception 'extra costs must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_costs -> 'extras') > 40 then
      raise exception 'a product can have at most 40 extras' using errcode = '54000';
    end if;
    for ex in select * from jsonb_array_elements(p_costs -> 'extras') loop
      if jsonb_typeof(ex) <> 'object'
         or (ex ->> 'index') is null or (ex ->> 'index') !~ '^[0-9]{1,4}$'
         or jsonb_typeof(ex -> 'lines') is distinct from 'array' then
        raise exception 'an extra''s costs are not valid' using errcode = '22023';
      end if;
      if jsonb_array_length(ex -> 'lines') > 20 then
        raise exception 'an extra can have at most 20 cost lines' using errcode = '54000';
      end if;
      for ln in select * from jsonb_array_elements(ex -> 'lines') loop
        perform public.cost_line_check(ln);
      end loop;
      if not exists (select 1 from public.product_extras pe
                      where pe.organisation_id = p_org and pe.product_id = p_product_id and pe.sort_order = (ex ->> 'index')::integer) then
        raise exception 'a cost is for an extra the product does not have' using errcode = '22023';
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
  if p_costs ? 'extras' then
    for ex in select * from jsonb_array_elements(p_costs -> 'extras') loop
      select pe.extra_id into xid from public.product_extras pe
       where pe.organisation_id = p_org and pe.product_id = p_product_id and pe.sort_order = (ex ->> 'index')::integer;
      delete from public.extra_cost_lines where extra_id = xid and organisation_id = p_org;
      for st in
        select e.value as line, e.ord from jsonb_array_elements(ex -> 'lines') with ordinality as e(value, ord) order by e.ord
      loop
        insert into public.extra_cost_lines (
          organisation_id, extra_id, sort_order, kind, material_id, amount_milli, unit, minutes, name, cents
        ) values (
          p_org, xid, (st.ord - 1)::integer, st.line ->> 'kind',
          case when st.line ->> 'kind' = 'material' then (st.line ->> 'material_id')::uuid end,
          case when st.line ->> 'kind' = 'material' then (st.line ->> 'amount_milli')::bigint end,
          case when st.line ->> 'kind' = 'material' then st.line ->> 'unit' end,
          case when st.line ->> 'kind' = 'time' then (st.line ->> 'minutes')::integer end,
          case when st.line ->> 'kind' = 'other' then btrim(st.line ->> 'name') end,
          case when st.line ->> 'kind' = 'other' then (st.line ->> 'cents')::bigint end
        );
      end loop;
    end loop;
  end if;
end;
$$;

revoke execute on function public.save_product_costs(uuid, uuid, jsonb) from public, anon;
grant execute on function public.save_product_costs(uuid, uuid, jsonb) to authenticated;
