-- A step can be added to, or taken off, one job item, and an item can be put back to its product's steps
-- (docs/plans/quantity-prices-and-steps.md; founder, 2026-10-17: "allowing adding (and removing) of steps for a single
-- item, with option to reset to default steps").
--
-- SECURITY-SENSITIVE: three new service-role-only SECURITY DEFINER functions that write job data, a replaced
-- SECURITY DEFINER trigger function, and a new column on job_items. Needs human review before it is applied to any
-- hosted project. Nothing is dropped.
--
-- * job_items.steps_edited: true once a step was added to or removed from this item by hand. Offered as "Reset to the
--   product's steps" on the job page; reset puts it back to false.
-- * copy_product_steps_to_item: the copy the trigger always made (the product's steps that apply to the item, in
--   order), now a function of its own so a reset does exactly what making the item did. job_items_copy_steps calls it.
-- * add_job_item_step / remove_job_item_step / reset_job_item_steps: SERVER ONLY (service role). The server has already
--   checked, with the person's own session, that the step or item is theirs. Only for an item that came from a product
--   (a one-off item has no steps), only while the job is Not started or Making, at most 30 steps on an item.
--   * add: the new step goes last. The first step of an item that was counted as a whole starts at what was made, so
--     the count is not lost; any other new step starts at none, so the item's count (the fewest step) follows it.
--   * remove: the item's count becomes the fewest of the steps left (unchanged when none are left).
--   * reset: the item's own steps are replaced by the product's as they are now, each at none.
-- ---------------------------------------------------------------------------

alter table public.job_items add column steps_edited boolean not null default false;

create function public.copy_product_steps_to_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.job_items%rowtype;
begin
  select * into it from public.job_items where id = p_item_id;
  if not found or it.product_id is null then
    return;
  end if;
  insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name)
  select it.organisation_id, it.id, s.sort_order, btrim(s.name)
    from public.product_steps s
   where s.product_id = it.product_id and s.organisation_id = it.organisation_id
     and public.product_step_applies(s.id, it.chosen_ids, it.quantity_milli)
   order by s.sort_order, s.created_at;
end;
$$;

revoke execute on function public.copy_product_steps_to_item(uuid) from public, anon, authenticated;

create or replace function public.job_items_copy_steps()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.copy_product_steps_to_item(new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- add_job_item_step. Errors: P0002 the item or its job is not found; 55006 the job is not Not started or Making; 22023
-- the item is not from a product, or the name is empty or over 120 characters; 54000 the item has 30 steps already.
-- Returns the new step's id.
-- ---------------------------------------------------------------------------
create function public.add_job_item_step(p_org uuid, p_item_id uuid, p_name text, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.job_items%rowtype;
  j public.jobs%rowtype;
  nm text := btrim(p_name);
  n integer;
  next_order integer;
  sid uuid;
begin
  select * into it from public.job_items where id = p_item_id and organisation_id = p_org;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  -- Lock in the same order as the counting functions: the job, then the item.
  select * into j from public.jobs where id = it.job_id and organisation_id = p_org for update;
  select * into it from public.job_items where id = it.id for update;
  if j.status not in ('not_started', 'in_progress') then
    raise exception 'a job that is % takes no changes to its steps', j.status using errcode = '55006';
  end if;
  if it.product_id is null then
    raise exception 'only an item made from a product has steps' using errcode = '22023';
  end if;
  if nm is null or char_length(nm) not between 1 and 120 then
    raise exception 'a step needs a name of up to 120 characters' using errcode = '22023';
  end if;
  select count(*), coalesce(max(sort_order), -1) + 1 into n, next_order from public.job_item_steps where job_item_id = it.id;
  if n >= 30 then
    raise exception 'an item can have at most 30 steps' using errcode = '54000';
  end if;

  insert into public.job_item_steps (organisation_id, job_item_id, sort_order, name, done_milli)
  values (p_org, it.id, least(next_order, 1000), nm, case when n = 0 then it.made_milli else 0 end)
  returning id into sid;
  update public.job_items
     set steps_edited = true,
         made_milli = least((select min(done_milli) from public.job_item_steps where job_item_id = it.id), quantity_milli)
   where id = it.id;
  return sid;
end;
$$;

revoke execute on function public.add_job_item_step(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.add_job_item_step(uuid, uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- remove_job_item_step. Errors: P0002 the step, its item or its job is not found; 55006 the job is not Not started or
-- Making.
-- ---------------------------------------------------------------------------
create function public.remove_job_item_step(p_org uuid, p_step_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  st public.job_item_steps%rowtype;
  it public.job_items%rowtype;
  j public.jobs%rowtype;
  fewest bigint;
begin
  select * into st from public.job_item_steps where id = p_step_id and organisation_id = p_org;
  if not found then
    raise exception 'step not found' using errcode = 'P0002';
  end if;
  select * into it from public.job_items where id = st.job_item_id and organisation_id = p_org;
  select * into j from public.jobs where id = it.job_id and organisation_id = p_org for update;
  select * into it from public.job_items where id = it.id for update;
  if j.status not in ('not_started', 'in_progress') then
    raise exception 'a job that is % takes no changes to its steps', j.status using errcode = '55006';
  end if;

  delete from public.job_item_steps where id = st.id;
  select min(done_milli) into fewest from public.job_item_steps where job_item_id = it.id;
  update public.job_items
     set steps_edited = true,
         made_milli = case when fewest is null then made_milli else least(fewest, quantity_milli) end
   where id = it.id;
end;
$$;

revoke execute on function public.remove_job_item_step(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_job_item_step(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- reset_job_item_steps. Errors: P0002 the item or its job is not found; 55006 the job is not Not started or Making;
-- 22023 the item is not from a product.
-- ---------------------------------------------------------------------------
create function public.reset_job_item_steps(p_org uuid, p_item_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.job_items%rowtype;
  j public.jobs%rowtype;
  fewest bigint;
begin
  select * into it from public.job_items where id = p_item_id and organisation_id = p_org;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  select * into j from public.jobs where id = it.job_id and organisation_id = p_org for update;
  select * into it from public.job_items where id = it.id for update;
  if j.status not in ('not_started', 'in_progress') then
    raise exception 'a job that is % takes no changes to its steps', j.status using errcode = '55006';
  end if;
  if it.product_id is null then
    raise exception 'only an item made from a product has steps' using errcode = '22023';
  end if;

  delete from public.job_item_steps where job_item_id = it.id;
  perform public.copy_product_steps_to_item(it.id);
  select min(done_milli) into fewest from public.job_item_steps where job_item_id = it.id;
  update public.job_items
     set steps_edited = false,
         made_milli = case when fewest is null then made_milli else least(fewest, quantity_milli) end
   where id = it.id;
end;
$$;

revoke execute on function public.reset_job_item_steps(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.reset_job_item_steps(uuid, uuid, uuid) to service_role;
