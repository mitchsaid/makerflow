-- Jobs slice 2 (docs/plans/jobs-and-invoices.md, "Jobs slice 2"; founder, 2026-10-13): how much of each item is made,
-- and adding an item to a job that already exists.
--
-- SECURITY-SENSITIVE: new service-role-only security-definer functions, and a replaced create_job. Needs human review
-- before it is applied to any hosted project.
--
-- WHAT CHANGES
-- * job_items.made_milli: how much of the item is made, in the item's own units (thousandths, as quantity_milli), from
--   0 up to the quantity. job_items.added_later: the item was added after the job was made.
-- * job_events: a third kind, 'item_added', with the item's name in `detail`.
-- * set_job_item_made: records how much of an item is made. A Not started job whose first unit is made becomes Making
--   (logged). Only Not started and Making jobs take counts.
-- * add_job_item: adds one item to a Not started, Making or Ready job (at most 50 items). A Ready job goes back to
--   Making, because it now has something to make (logged).
-- * job_item_clean: the one copy of the rules for an item's shape. create_job (replaced, same signature and same
--   rules) and add_job_item both use it, so they cannot drift apart.
-- Members still cannot write items or events directly; they can only read them.

alter table public.job_items
  add column made_milli bigint not null default 0,
  add column added_later boolean not null default false,
  add constraint job_items_made_within_quantity check (made_milli between 0 and quantity_milli);

alter table public.job_events
  add column detail text check (detail is null or char_length(detail) between 1 and 300);
alter table public.job_events drop constraint job_events_kind_check;
alter table public.job_events add constraint job_events_kind_check check (kind in ('created', 'status', 'item_added'));
alter table public.job_events drop constraint job_events_shape;
alter table public.job_events
  add constraint job_events_shape check ((kind = 'status') = (from_status is not null) and (kind = 'item_added') = (detail is not null));

-- ---------------------------------------------------------------------------
-- job_item_clean: checks one item's shape and returns it rebuilt from the known fields only.
-- Errors: 22023 when something is not valid. Pure: reads nothing, writes nothing.
-- The shape is the one create_job has had since 20261030100000:
--   { kind: 'product' | 'service' | 'custom', name, description, quantityMilli, unit,
--     variationLabel, variationName   (both text, or both empty),
--     options: [ { group, kind: 'one' | 'any' | 'text', value, text, quantityMilli } ]   (up to 50),
--     photoImageId: an id, or empty (the composite foreign key refuses another business's picture on insert) }
-- ---------------------------------------------------------------------------
create function public.job_item_clean(item jsonb)
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
    'photoImageId', nullif(item ->> 'photoImageId', '')
  );
end;
$$;

revoke execute on function public.job_item_clean(jsonb) from public, anon, authenticated;
grant execute on function public.job_item_clean(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- create_job, as in 20261030100000, with the item rules moved into job_item_clean. Same signature, so the revoke and
-- grant from 20261029100000 stay as they are. Every item is checked before anything is written.
-- ---------------------------------------------------------------------------
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
      variation_label, variation_name, options, photo_image_id
    ) values (
      p_org, jid, i, item ->> 'kind', item ->> 'name', item ->> 'description',
      (item ->> 'quantityMilli')::bigint, item ->> 'unit',
      item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid
    );
    i := i + 1;
  end loop;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_job_item_made. SERVER ONLY (service role). The server has already checked, with the person's own session, that
-- the job is theirs.
--
-- Errors: P0002 the job or the item is not found; 55006 the job is not Not started or Making; 22023 the amount is
-- negative or more than the quantity. Returns the amount now recorded.
-- ---------------------------------------------------------------------------
create function public.set_job_item_made(p_org uuid, p_job_id uuid, p_item_id uuid, p_made_milli bigint, p_actor uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
  it public.job_items%rowtype;
begin
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  select * into it from public.job_items where id = p_item_id and job_id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'item not found' using errcode = 'P0002';
  end if;
  if j.status not in ('not_started', 'in_progress') then
    raise exception 'a job that is % takes no counts', j.status using errcode = '55006';
  end if;
  if p_made_milli is null or p_made_milli < 0 or p_made_milli > it.quantity_milli then
    raise exception 'that amount is not between none and all of the item' using errcode = '22023';
  end if;

  update public.job_items set made_milli = p_made_milli where id = it.id;

  -- Making the first unit of anything starts the job.
  if j.status = 'not_started' and p_made_milli > 0 then
    update public.jobs set status = 'in_progress' where id = j.id;
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
    values (p_org, j.id, 'status', 'not_started', 'in_progress', p_actor);
  end if;
  return p_made_milli;
end;
$$;

revoke execute on function public.set_job_item_made(uuid, uuid, uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.set_job_item_made(uuid, uuid, uuid, bigint, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- add_job_item. SERVER ONLY (service role). p_item has the shape job_item_clean describes.
--
-- Errors: P0002 the job is not found; 55006 the job is Out for delivery, Done or Cancelled; 54000 the job already has
-- 50 items; 22023 the item is not valid; 23503 the picture is not this business's. Returns the new item's id.
-- ---------------------------------------------------------------------------
create function public.add_job_item(p_org uuid, p_job_id uuid, p_actor uuid, p_item jsonb)
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
    variation_label, variation_name, options, photo_image_id, added_later
  ) values (
    p_org, j.id, least(next_order, 1000), item ->> 'kind', item ->> 'name', item ->> 'description',
    (item ->> 'quantityMilli')::bigint, item ->> 'unit',
    item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid, true
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

revoke execute on function public.add_job_item(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.add_job_item(uuid, uuid, uuid, jsonb) to service_role;
