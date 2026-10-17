-- Steps that depend on a choice (docs/plans/quantity-prices-and-steps.md, slice 4; founder, 2026-10-17): a product's
-- step can be made only for some items, by what was chosen on them: "Large" size, "Red velvet" flavour, the gift-wrap
-- extra, or a quantity of 12 or more. A step with several conditions takes ALL of them or ANY of them, and each can be
-- turned round ("is not"). A job item copies only the steps whose conditions hold for it.
--
-- SECURITY-SENSITIVE: a new table with row-level security and column grants, a new column on job_items, a replaced
-- SECURITY DEFINER trigger function, a replaced SECURITY INVOKER save_product_layers, and replaced service-role-only
-- job functions. Needs human review before it is applied to any hosted project. Nothing is dropped.
--
-- WHAT CHANGES
-- * product_steps.condition_logic: 'all' (the default) or 'any'. A step with no conditions is always made.
-- * product_step_conditions: one row per condition on a step. kind 'chosen' points at exactly one of a variation, an
--   option value or an extra of the same business (and says "is" or, with negate, "is not" chosen); kind
--   'quantity_at_least' holds a quantity (thousandths) and says "at least" (with negate: "less than"). At most 10 per
--   step. If a variation, value or extra is deleted its conditions go with it (the product form refuses to save a
--   step that depends on a choice it no longer has, so this only matters for edits made some other way).
-- * job_items.chosen_ids: the ids of the variation, option values and extras chosen on the item, copied from the
--   quote's sent version (versions sent before this carry none, and so match no "is chosen" condition).
-- * product_step_applies: whether one step's conditions hold for an item's choices and quantity. Internal.
-- * job_items_copy_steps (replaced): copies only the product's steps that apply to the new item.
-- * save_product_layers (replaced, same signature): a step is {name, logic, conditions}, a condition refers to a choice
--   by its position in the payload sent with it (variation index; option group and value index; extra index), because a
--   new choice has no id yet. A step can use up to 10 conditions.
-- * job_item_clean, create_job, add_job_item and create_job_from_quote (replaced, same signatures) carry chosen_ids.
-- ---------------------------------------------------------------------------

alter table public.product_steps
  add column condition_logic text not null default 'all' check (condition_logic in ('all', 'any'));

grant insert (condition_logic) on public.product_steps to authenticated;
grant update (condition_logic) on public.product_steps to authenticated;

alter table public.job_items
  add column chosen_ids uuid[] not null default '{}' check (cardinality(chosen_ids) <= 100);

-- ---------------------------------------------------------------------------
-- product_step_conditions
-- ---------------------------------------------------------------------------
create table public.product_step_conditions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  step_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  kind text not null check (kind in ('chosen', 'quantity_at_least')),
  -- Turns the condition round: "is not chosen", "is less than".
  negate boolean not null default false,
  variation_id uuid,
  option_value_id uuid,
  extra_id uuid,
  quantity_milli bigint check (quantity_milli between 1 and 9999999999),
  created_at timestamptz not null default now(),
  constraint product_step_conditions_step_same_org
    foreign key (organisation_id, step_id) references public.product_steps (organisation_id, id)
    on delete cascade,
  constraint product_step_conditions_variation_same_org
    foreign key (organisation_id, variation_id) references public.product_variations (organisation_id, id)
    on delete cascade,
  constraint product_step_conditions_value_same_org
    foreign key (organisation_id, option_value_id) references public.product_option_values (organisation_id, id)
    on delete cascade,
  constraint product_step_conditions_extra_same_org
    foreign key (organisation_id, extra_id) references public.extras (organisation_id, id)
    on delete cascade,
  -- A choice names exactly one thing and no quantity; a quantity names no thing.
  constraint product_step_conditions_shape check (
    (kind = 'chosen'
      and quantity_milli is null
      and num_nonnulls(variation_id, option_value_id, extra_id) = 1)
    or
    (kind = 'quantity_at_least'
      and quantity_milli is not null
      and num_nonnulls(variation_id, option_value_id, extra_id) = 0)
  )
);

create index product_step_conditions_step_idx on public.product_step_conditions (step_id, sort_order);
-- (deleting a choice finds the conditions that name it)
create index product_step_conditions_variation_idx on public.product_step_conditions (variation_id) where variation_id is not null;
create index product_step_conditions_value_idx on public.product_step_conditions (option_value_id) where option_value_id is not null;
create index product_step_conditions_extra_idx on public.product_step_conditions (extra_id) where extra_id is not null;

-- A step has at most 10 conditions.
create function public.product_step_conditions_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_step_conditions:' || new.step_id::text, 0));
  if (select count(*) from public.product_step_conditions where step_id = new.step_id) >= 10 then
    raise exception 'a step can have at most 10 conditions' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_step_conditions_limit() from public, anon, authenticated;

create trigger product_step_conditions_limit
  before insert on public.product_step_conditions
  for each row execute function public.product_step_conditions_limit();

revoke all on public.product_step_conditions from anon, authenticated;
grant select, delete on public.product_step_conditions to authenticated;
grant insert (organisation_id, step_id, sort_order, kind, negate, variation_id, option_value_id, extra_id, quantity_milli)
  on public.product_step_conditions to authenticated;
grant update (sort_order, kind, negate, variation_id, option_value_id, extra_id, quantity_milli)
  on public.product_step_conditions to authenticated;

alter table public.product_step_conditions enable row level security;

create policy product_step_conditions_select_members
  on public.product_step_conditions for select to authenticated
  using (public.is_org_member(organisation_id));

create policy product_step_conditions_insert_members
  on public.product_step_conditions for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy product_step_conditions_update_members
  on public.product_step_conditions for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy product_step_conditions_delete_members
  on public.product_step_conditions for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.product_step_conditions
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- product_step_applies: do this step's conditions hold for an item that has these choices and this quantity?
-- No conditions: yes. 'all': every condition holds. 'any': at least one holds. A condition that "is not" holds when its
-- choice was not made (or, for a quantity, when it is below the number). Internal: only the trigger below calls it.
-- ---------------------------------------------------------------------------
create function public.product_step_applies(p_step_id uuid, p_chosen_ids uuid[], p_quantity_milli bigint)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  logic text;
  c record;
  holds boolean;
  total integer := 0;
  all_hold boolean := true;
  any_holds boolean := false;
begin
  select s.condition_logic into logic from public.product_steps s where s.id = p_step_id;
  if not found then
    return false;
  end if;
  for c in select * from public.product_step_conditions where step_id = p_step_id loop
    total := total + 1;
    if c.kind = 'chosen' then
      holds := coalesce(c.variation_id, c.option_value_id, c.extra_id) = any (p_chosen_ids);
    else
      holds := p_quantity_milli >= c.quantity_milli;
    end if;
    if c.negate then
      holds := not holds;
    end if;
    all_hold := all_hold and holds;
    any_holds := any_holds or holds;
  end loop;
  if total = 0 then
    return true;
  end if;
  return case when logic = 'any' then any_holds else all_hold end;
end;
$$;

revoke execute on function public.product_step_applies(uuid, uuid[], bigint) from public, anon, authenticated;

-- A new job item takes a copy of those of its product's steps that apply to it, in order.
create or replace function public.job_items_copy_steps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.product_id is not null then
    insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name)
    select new.organisation_id, new.id, s.sort_order, btrim(s.name)
      from public.product_steps s
     where s.product_id = new.product_id and s.organisation_id = new.organisation_id
       and public.product_step_applies(s.id, new.chosen_ids, new.quantity_milli)
     order by s.sort_order, s.created_at;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_product_layers (same signature). p_steps: null leaves the product's steps as they are; a list replaces them, in
-- that order. A step is
--   {"name": "...", "logic": "all" | "any", "conditions": [ ... ]}
-- and a condition is either
--   {"kind": "chosen", "negate": false, "ref": {"type": "variation", "index": 0}}
--   {"kind": "chosen", "negate": true,  "ref": {"type": "option_value", "group": 1, "index": 2}}
--   {"kind": "chosen", "negate": false, "ref": {"type": "extra", "index": 0}}
--   {"kind": "quantity", "negate": false, "quantityMilli": 12000}
-- where the indexes are positions in the variations, options and extras saved in the same call.
-- Errors: 22023 when a step or condition is not valid or points at a choice the product does not have; 54000 for more
-- than 30 steps or 10 conditions in a step; and everything the earlier layers raise.
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
    if jsonb_array_length(p_price_breaks) > 10 then
      raise exception 'a product can have at most 10 quantity prices' using errcode = '54000';
    end if;
    for b in select * from jsonb_array_elements(p_price_breaks) loop
      if jsonb_typeof(b) <> 'object'
         or (b ->> 'from_quantity_milli') is null or (b ->> 'from_quantity_milli') !~ '^[0-9]{1,10}$'
         or (b ->> 'percent_off_bp') is null or (b ->> 'percent_off_bp') !~ '^[0-9]{1,4}$' then
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
    insert into public.product_price_breaks (organisation_id, product_id, from_quantity_milli, percent_off_bp)
    select p_org, pid, (e.value ->> 'from_quantity_milli')::bigint, (e.value ->> 'percent_off_bp')::integer
      from jsonb_array_elements(p_price_breaks) with ordinality as e(value, ord)
     order by e.ord;
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

-- ---------------------------------------------------------------------------
-- The job functions, replaced to carry chosen_ids (see the notes at the top). Signatures are unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.job_item_clean(item jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  opt jsonb;
  opts jsonb;
  clean jsonb;
  vlabel text;
  vname text;
  bad constant text := 'an item is not valid';
begin
  if jsonb_typeof(item) <> 'object'
     or jsonb_typeof(item -> 'name') is distinct from 'string'
     or char_length(btrim(item ->> 'name')) not between 1 and 300
     or jsonb_typeof(item -> 'quantityMilli') is distinct from 'number'
     or (item ->> 'quantityMilli') !~ '^[0-9]{1,10}$'
     or jsonb_typeof(item -> 'kind') is distinct from 'string'
     or (item ->> 'kind') not in ('product', 'service', 'custom') then
    raise exception '%', bad using errcode = '22023';
  end if;
  -- (the cast only runs once the text is known to be digits)
  if (item ->> 'quantityMilli')::bigint not between 1 and 9999999999 then
    raise exception '%', bad using errcode = '22023';
  end if;
  if (item -> 'description' is not null and jsonb_typeof(item -> 'description') not in ('string', 'null'))
     or char_length(coalesce(item ->> 'description', '')) > 4000
     or (item -> 'unit' is not null and jsonb_typeof(item -> 'unit') not in ('string', 'null'))
     or char_length(coalesce(item ->> 'unit', '')) > 20 then
    raise exception '%', bad using errcode = '22023';
  end if;

  -- The variation: both words or neither.
  vlabel := nullif(btrim(item ->> 'variationLabel'), '');
  vname := nullif(btrim(item ->> 'variationName'), '');
  if (item -> 'variationLabel' is not null and jsonb_typeof(item -> 'variationLabel') not in ('string', 'null'))
     or (item -> 'variationName' is not null and jsonb_typeof(item -> 'variationName') not in ('string', 'null'))
     or (vlabel is null) <> (vname is null)
     or char_length(coalesce(vlabel, '')) > 200
     or char_length(coalesce(vname, '')) > 200 then
    raise exception '%', bad using errcode = '22023';
  end if;

  -- The product the item comes from: empty, or an id (the composite foreign key refuses another business's on insert).
  if item -> 'productId' is not null and jsonb_typeof(item -> 'productId') not in ('string', 'null') then
    raise exception '%', bad using errcode = '22023';
  end if;
  if nullif(item ->> 'productId', '') is not null
     and (item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '%', bad using errcode = '22023';
  end if;

  -- The choices made (ids of the variation, option values and extras): empty, or a short list of ids.
  if item -> 'chosenIds' is not null and jsonb_typeof(item -> 'chosenIds') not in ('array', 'null') then
    raise exception '%', bad using errcode = '22023';
  end if;
  if jsonb_typeof(item -> 'chosenIds') = 'array' then
    if jsonb_array_length(item -> 'chosenIds') > 100
       or exists (
         select 1 from jsonb_array_elements(item -> 'chosenIds') cv
          where jsonb_typeof(cv) <> 'string' or (cv #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) then
      raise exception '%', bad using errcode = '22023';
    end if;
  end if;

  -- The picture: empty, or an id.
  if item -> 'photoImageId' is not null and jsonb_typeof(item -> 'photoImageId') not in ('string', 'null') then
    raise exception '%', bad using errcode = '22023';
  end if;
  if nullif(item ->> 'photoImageId', '') is not null
     and (item ->> 'photoImageId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception '%', bad using errcode = '22023';
  end if;

  -- The choices.
  opts := coalesce(item -> 'options', '[]'::jsonb);
  if jsonb_typeof(opts) = 'null' then
    opts := '[]'::jsonb;
  end if;
  if jsonb_typeof(opts) <> 'array' or jsonb_array_length(opts) > 50 then
    raise exception '%', bad using errcode = '22023';
  end if;
  for opt in select * from jsonb_array_elements(opts) loop
    if jsonb_typeof(opt) <> 'object'
       or jsonb_typeof(opt -> 'group') is distinct from 'string'
       or char_length(btrim(opt ->> 'group')) not between 1 and 200
       or jsonb_typeof(opt -> 'kind') is distinct from 'string'
       or (opt ->> 'kind') not in ('one', 'any', 'text')
       or (opt -> 'value' is not null and jsonb_typeof(opt -> 'value') not in ('string', 'null'))
       or char_length(coalesce(opt ->> 'value', '')) > 200
       or (opt -> 'text' is not null and jsonb_typeof(opt -> 'text') not in ('string', 'null'))
       or char_length(coalesce(opt ->> 'text', '')) > 4000
       or (opt -> 'quantityMilli' is not null and jsonb_typeof(opt -> 'quantityMilli') not in ('number', 'null')) then
      raise exception '%', bad using errcode = '22023';
    end if;
    if jsonb_typeof(opt -> 'quantityMilli') = 'number'
       and ((opt ->> 'quantityMilli') !~ '^[0-9]{1,10}$' or (opt ->> 'quantityMilli')::bigint not between 1 and 9999999999) then
      raise exception '%', bad using errcode = '22023';
    end if;
  end loop;

  -- Only the known fields are kept, rebuilt rather than copied.
  clean := coalesce((
    select jsonb_agg(jsonb_build_object(
      'group', btrim(o ->> 'group'),
      'kind', o ->> 'kind',
      'value', nullif(btrim(o ->> 'value'), ''),
      'text', nullif(btrim(o ->> 'text'), ''),
      'quantityMilli', case when jsonb_typeof(o -> 'quantityMilli') = 'number' then (o ->> 'quantityMilli')::bigint end
    ) order by ord)
    from jsonb_array_elements(opts) with ordinality as t(o, ord)
  ), '[]'::jsonb);

  return jsonb_build_object(
    'kind', item ->> 'kind',
    'name', btrim(item ->> 'name'),
    'description', nullif(btrim(item ->> 'description'), ''),
    'quantityMilli', (item ->> 'quantityMilli')::bigint,
    'unit', nullif(btrim(item ->> 'unit'), ''),
    'variationLabel', vlabel,
    'variationName', vname,
    'options', clean,
    'photoImageId', nullif(item ->> 'photoImageId', ''),
    'productId', nullif(item ->> 'productId', ''),
    'chosenIds', coalesce((
      select jsonb_agg(lower(cv #>> '{}'))
        from jsonb_array_elements(case when jsonb_typeof(item -> 'chosenIds') = 'array' then item -> 'chosenIds' else '[]'::jsonb end) cv
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.create_job_from_quote(p_org uuid, p_quote_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
  v public.quote_versions%rowtype;
  snap jsonb;
  cust jsonb;
  ful text := 'none';
  n integer;
  jid uuid;
begin
  select * into q from public.quotes where id = p_quote_id and organisation_id = p_org for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'accepted' then
    raise exception 'only an accepted quote can become a job' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.jobs where quote_id = q.id and status <> 'cancelled') then
    raise exception 'this quote already has a job' using errcode = '23505';
  end if;

  -- What was accepted: the latest sent version.
  select * into v from public.quote_versions where quote_id = q.id order by version desc limit 1;
  if not found then
    raise exception 'the quote has no sent version' using errcode = 'P0002';
  end if;
  snap := v.snapshot;
  cust := snap -> 'customer';
  if cust is null or jsonb_typeof(cust) <> 'object' or nullif(btrim(cust ->> 'name'), '') is null then
    raise exception 'the quote has no customer' using errcode = '22023';
  end if;

  if exists (select 1 from jsonb_array_elements(snap -> 'lines') l where l ->> 'kind' = 'delivery') then
    ful := 'delivery';
  elsif exists (select 1 from jsonb_array_elements(snap -> 'lines') l where l ->> 'kind' = 'collection') then
    ful := 'collection';
  end if;

  -- Numbers count up per business; the lock keeps two jobs made at once from taking the same one.
  perform pg_advisory_xact_lock(hashtextextended('jobs:' || p_org::text, 0));
  select coalesce(max(number), 0) + 1 into n from public.jobs where organisation_id = p_org;

  insert into public.jobs (
    organisation_id, number, quote_id, quote_version, status, fulfilment, delivery_address, needed_by,
    customer_name, customer_contact_person, customer_phone, customer_email, customer_id, created_by
  ) values (
    p_org, n, q.id, v.version, 'not_started', ful,
    case when ful = 'delivery' then nullif(btrim(snap ->> 'deliveryAddress'), '') end,
    nullif(snap ->> 'neededBy', '')::date,
    left(btrim(cust ->> 'name'), 200),
    nullif(left(btrim(cust ->> 'contactPerson'), 200), ''),
    nullif(left(btrim(cust ->> 'phone'), 100), ''),
    nullif(left(btrim(cust ->> 'email'), 320), ''),
    q.customer_id, p_actor
  ) returning id into jid;

  insert into public.job_items (
    organisation_id, job_id, sort_order, kind, name, description, quantity_milli, unit,
    variation_label, variation_name, options, photo_image_id, product_id, chosen_ids
  )
  select
    p_org, jid, e.ord - 1, e.value ->> 'kind', left(btrim(e.value ->> 'name'), 300),
    nullif(left(e.value ->> 'description', 4000), ''),
    greatest((e.value ->> 'quantityMilli')::bigint, 1),
    nullif(left(e.value ->> 'unit', 40), ''),
    nullif(left(e.value -> 'variation' ->> 'label', 200), ''),
    nullif(left(e.value -> 'variation' ->> 'name', 200), ''),
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'group', o ->> 'group', 'kind', o ->> 'kind', 'value', o ->> 'value', 'text', o ->> 'text',
          'quantityMilli', o -> 'quantityMilli'))
         from jsonb_array_elements(coalesce(e.value -> 'options', '[]'::jsonb)) o),
      '[]'::jsonb),
    nullif(e.value ->> 'photoImageId', '')::uuid,
    -- The product the line came from (versions sent before this carry none), only if it is this business's.
    (select p.id from public.products p
      where p.organisation_id = p_org and p.id::text = lower(nullif(e.value ->> 'productId', ''))),
    -- What was chosen on the line (versions sent before this carry none): ids only, at most 100.
    coalesce(array(
      select lower(t.c)::uuid
        from (
          select jsonb_array_elements_text(
            case when jsonb_typeof(e.value -> 'chosenIds') = 'array' then e.value -> 'chosenIds' else '[]'::jsonb end
          ) as c
        ) t
       where t.c ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       limit 100
    ), '{}'::uuid[])
  from jsonb_array_elements(snap -> 'lines') with ordinality as e(value, ord)
  where e.value ->> 'kind' in ('product', 'service', 'custom');

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

create or replace function public.create_job(
  p_org uuid,
  p_actor uuid,
  p_customer_id uuid,
  p_fulfilment text,
  p_delivery_address text,
  p_needed_by date,
  p_note text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.customers%rowtype;
  item jsonb;
  cleaned jsonb[] := '{}';
  i integer := 0;
  n integer;
  jid uuid;
  addr text := nullif(btrim(p_delivery_address), '');
  note_text text := nullif(btrim(p_note), '');
begin
  if p_fulfilment not in ('none', 'collection', 'delivery') then
    raise exception 'unknown fulfilment' using errcode = '22023';
  end if;
  if addr is not null and (p_fulfilment <> 'delivery' or char_length(addr) > 1000) then
    raise exception 'an address belongs to a delivery, up to 1000 characters' using errcode = '22023';
  end if;
  if note_text is not null and char_length(note_text) > 2000 then
    raise exception 'the note is too long' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'a job needs 1 to 50 items' using errcode = '22023';
  end if;

  select * into c from public.customers where id = p_customer_id and organisation_id = p_org and archived_at is null;
  if not found then
    raise exception 'customer not found' using errcode = '22023';
  end if;

  -- Check every item before anything is written.
  for item in select * from jsonb_array_elements(p_items) loop
    cleaned := cleaned || public.job_item_clean(item);
  end loop;

  -- Numbers count up per business, in the same sequence as jobs made from quotes.
  perform pg_advisory_xact_lock(hashtextextended('jobs:' || p_org::text, 0));
  select coalesce(max(number), 0) + 1 into n from public.jobs where organisation_id = p_org;

  insert into public.jobs (
    organisation_id, number, quote_id, quote_version, status, fulfilment, delivery_address, needed_by,
    customer_name, customer_contact_person, customer_phone, customer_email, customer_id, note, created_by
  ) values (
    p_org, n, null, null, 'not_started', p_fulfilment, addr, p_needed_by,
    left(btrim(c.name), 200), nullif(left(btrim(c.contact_person), 200), ''), nullif(left(btrim(c.phone), 100), ''),
    nullif(left(btrim(c.email), 320), ''), c.id, note_text, p_actor
  ) returning id into jid;

  foreach item in array cleaned loop
    insert into public.job_items (
      organisation_id, job_id, sort_order, kind, name, description, quantity_milli, unit,
      variation_label, variation_name, options, photo_image_id, product_id, chosen_ids
    ) values (
      p_org, jid, i, item ->> 'kind', item ->> 'name', item ->> 'description',
      (item ->> 'quantityMilli')::bigint, item ->> 'unit',
      item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid,
      (item ->> 'productId')::uuid,
      coalesce(array(select jsonb_array_elements_text(item -> 'chosenIds'))::uuid[], '{}'::uuid[])
    );
    i := i + 1;
  end loop;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

create or replace function public.add_job_item(p_org uuid, p_job_id uuid, p_actor uuid, p_item jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
  item jsonb := public.job_item_clean(p_item);
  next_order integer;
  item_count integer;
  iid uuid;
begin
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if j.status not in ('not_started', 'in_progress', 'ready') then
    raise exception 'a job that is % takes no new items', j.status using errcode = '55006';
  end if;
  select count(*), coalesce(max(sort_order), -1) + 1 into item_count, next_order
    from public.job_items where job_id = j.id and organisation_id = p_org;
  if item_count >= 50 then
    raise exception 'a job has at most 50 items' using errcode = '54000';
  end if;

  insert into public.job_items (
    organisation_id, job_id, sort_order, kind, name, description, quantity_milli, unit,
    variation_label, variation_name, options, photo_image_id, added_later, product_id, chosen_ids
  ) values (
    p_org, j.id, least(next_order, 1000), item ->> 'kind', item ->> 'name', item ->> 'description',
    (item ->> 'quantityMilli')::bigint, item ->> 'unit',
    item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid, true,
    (item ->> 'productId')::uuid,
    coalesce(array(select jsonb_array_elements_text(item -> 'chosenIds'))::uuid[], '{}'::uuid[])
  ) returning id into iid;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, detail, actor_id)
  values (p_org, j.id, 'item_added', null, j.status, left(item ->> 'name', 300), p_actor);

  -- A job that was ready has something new to make, so it goes back to making.
  if j.status = 'ready' then
    update public.jobs set status = 'in_progress' where id = j.id;
    -- (clock_timestamp, not the transaction's time, so this line sorts after "item added" above it)
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id, created_at)
    values (p_org, j.id, 'status', 'ready', 'in_progress', p_actor, clock_timestamp());
  end if;
  return iid;
end;
$$;
