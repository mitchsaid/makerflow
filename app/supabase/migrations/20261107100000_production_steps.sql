-- Production steps (docs/plans/quantity-prices-and-steps.md, slices 2 and 3; founder, 2026-10-16): a product lists the
-- steps it is made in, and a job made from it shows those steps for each item, each with how many have been through it.
--
-- SECURITY-SENSITIVE: two new tables with row-level security and column grants, a trigger that copies a product's steps
-- onto a job item, a new service-role-only function, a replaced SECURITY INVOKER save_product_layers, and replaced
-- service-role-only job functions. Needs human review before it is applied to any hosted project.
--
-- WHAT CHANGES
-- * product_steps: a product's steps in order (name only). At most 30 per product. Members manage them, like products.
--   Saved with the product: save_product_layers (replaced; it gains p_steps) takes null to leave them, a list to
--   replace them.
-- * job_items.product_id: where the item came from (a live link, empty for a one-off item or an item made before this).
--   The composite foreign key keeps it in the same business.
-- * job_item_steps: a job item's own copy of the product's steps AT THE TIME THE ITEM WAS MADE, with how many have been
--   through each (done_milli, in the item's units). Members read; only the server writes. Editing the product later
--   never changes a job.
-- * An AFTER INSERT trigger on job_items copies the product's steps, so every way an item is made (from a quote, by
--   hand, added later) does it the same way and none can forget.
-- * set_job_step_done: records how many have been through one step, sets the item's made count to the fewest any step
--   has reached, and starts a job that had not started. An item with steps takes no whole-item count
--   (set_job_item_made refuses it).
-- * job_item_clean, create_job, add_job_item and create_job_from_quote are replaced to carry product_id (the quote's
--   sent snapshot lines gain an optional productId from now on; older sent versions make jobs without steps).
--   Signatures are unchanged, so their revokes and grants stay as they are.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- product_steps
-- ---------------------------------------------------------------------------
create table public.product_steps (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  constraint product_steps_org_id_unique unique (organisation_id, id),
  constraint product_steps_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade
);

create index product_steps_product_idx on public.product_steps (organisation_id, product_id, sort_order);

-- A product has at most 30 steps.
create function public.product_steps_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_steps:' || new.product_id::text, 0));
  if (select count(*) from public.product_steps where product_id = new.product_id) >= 30 then
    raise exception 'a product can have at most 30 steps' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_steps_limit() from public, anon, authenticated;

create trigger product_steps_limit
  before insert on public.product_steps
  for each row execute function public.product_steps_limit();

revoke all on public.product_steps from anon, authenticated;
grant select, delete on public.product_steps to authenticated;
grant insert (organisation_id, product_id, name, sort_order) on public.product_steps to authenticated;
grant update (name, sort_order) on public.product_steps to authenticated;

alter table public.product_steps enable row level security;

create policy product_steps_select_members
  on public.product_steps for select to authenticated
  using (public.is_org_member(organisation_id));

create policy product_steps_insert_members
  on public.product_steps for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy product_steps_update_members
  on public.product_steps for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy product_steps_delete_members
  on public.product_steps for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.product_steps
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- job_items.product_id and job_item_steps
-- ---------------------------------------------------------------------------
alter table public.job_items add column product_id uuid;
alter table public.job_items
  add constraint job_items_product_same_org
  foreign key (organisation_id, product_id) references public.products (organisation_id, id);
alter table public.job_items add constraint job_items_org_id_unique unique (organisation_id, id);

create table public.job_item_steps (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  job_item_id uuid not null,
  sort_order integer not null check (sort_order between 0 and 1000),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- How many (in the item's units, thousandths) have been through this step. Never more than the item's quantity:
  -- set_job_step_done checks it (the quantity lives on the item).
  done_milli bigint not null default 0 check (done_milli >= 0),
  constraint job_item_steps_item_same_org
    foreign key (organisation_id, job_item_id) references public.job_items (organisation_id, id) on delete cascade
);

create index job_item_steps_item_idx on public.job_item_steps (job_item_id, sort_order);

-- Members read. Only the server writes.
revoke all on public.job_item_steps from anon, authenticated;
grant select on public.job_item_steps to authenticated;

alter table public.job_item_steps enable row level security;

create policy job_item_steps_select_members
  on public.job_item_steps for select to authenticated
  using (public.is_org_member(organisation_id));

create policy session_required on public.job_item_steps
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- A new job item takes a copy of its product's steps, in order. (A one-off item, or one made before this, has none.)
create function public.job_items_copy_steps()
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
     order by s.sort_order, s.created_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.job_items_copy_steps() from public, anon, authenticated;

create trigger job_items_copy_steps
  after insert on public.job_items
  for each row execute function public.job_items_copy_steps();

-- ---------------------------------------------------------------------------
-- save_product_layers, with the steps. p_steps: null leaves the product's steps as they are; a list ([{name}, ...])
-- replaces them, in that order. Errors: 22023 when the list is not valid; 54000 when it has more than 30 rows; and
-- everything the earlier layers raise.
-- ---------------------------------------------------------------------------
drop function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb);

create function public.save_product_layers(
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
         or char_length(btrim(b ->> 'name')) not between 1 and 120 then
        raise exception 'a step is not valid' using errcode = '22023';
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
    delete from public.product_steps where product_id = pid and organisation_id = p_org;
    insert into public.product_steps (organisation_id, product_id, name, sort_order)
    select p_org, pid, btrim(e.value ->> 'name'), (e.ord - 1)::integer
      from jsonb_array_elements(p_steps) with ordinality as e(value, ord)
     order by e.ord;
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- The job functions, replaced to carry product_id (see the notes at the top).
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
    'productId', nullif(item ->> 'productId', '')
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
    variation_label, variation_name, options, photo_image_id, product_id
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
      where p.organisation_id = p_org and p.id::text = lower(nullif(e.value ->> 'productId', '')))
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
      variation_label, variation_name, options, photo_image_id, product_id
    ) values (
      p_org, jid, i, item ->> 'kind', item ->> 'name', item ->> 'description',
      (item ->> 'quantityMilli')::bigint, item ->> 'unit',
      item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid,
      (item ->> 'productId')::uuid
    );
    i := i + 1;
  end loop;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

create or replace function public.set_job_item_made(p_org uuid, p_job_id uuid, p_item_id uuid, p_made_milli bigint, p_actor uuid)
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
  -- An item with steps is counted step by step: its count is the fewest any step has reached.
  if exists (select 1 from public.job_item_steps where job_item_id = it.id) then
    raise exception 'this item is counted step by step' using errcode = '55000';
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
    variation_label, variation_name, options, photo_image_id, added_later, product_id
  ) values (
    p_org, j.id, least(next_order, 1000), item ->> 'kind', item ->> 'name', item ->> 'description',
    (item ->> 'quantityMilli')::bigint, item ->> 'unit',
    item ->> 'variationLabel', item ->> 'variationName', item -> 'options', (item ->> 'photoImageId')::uuid, true,
    (item ->> 'productId')::uuid
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

-- ---------------------------------------------------------------------------
-- set_job_step_done. SERVER ONLY (service role). The server has already checked, with the person's own session, that
-- the step is theirs.
--
-- Records how many have been through one step (from none up to the item's quantity). The item's made count becomes
-- the fewest any of its steps has reached. The first progress on anything starts a job that had not started.
--
-- Errors: P0002 the step, its item or its job is not found; 55006 the job is not Not started or Making; 22023 the
-- amount is negative or more than the quantity. Returns the amount now recorded.
-- ---------------------------------------------------------------------------
create function public.set_job_step_done(p_org uuid, p_step_id uuid, p_done_milli bigint, p_actor uuid)
returns bigint
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
  -- Lock in the same order as set_job_item_made: the job, then the item.
  select * into it from public.job_items where id = st.job_item_id and organisation_id = p_org;
  select * into j from public.jobs where id = it.job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  select * into it from public.job_items where id = it.id for update;
  if j.status not in ('not_started', 'in_progress') then
    raise exception 'a job that is % takes no counts', j.status using errcode = '55006';
  end if;
  if p_done_milli is null or p_done_milli < 0 or p_done_milli > it.quantity_milli then
    raise exception 'that amount is not between none and all of the item' using errcode = '22023';
  end if;

  update public.job_item_steps set done_milli = p_done_milli where id = st.id;
  select min(done_milli) into fewest from public.job_item_steps where job_item_id = it.id;
  update public.job_items set made_milli = least(coalesce(fewest, 0), quantity_milli) where id = it.id;

  -- Any progress starts the job.
  if j.status = 'not_started' and p_done_milli > 0 then
    update public.jobs set status = 'in_progress' where id = j.id;
    insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
    values (p_org, j.id, 'status', 'not_started', 'in_progress', p_actor);
  end if;
  return p_done_milli;
end;
$$;

revoke execute on function public.set_job_step_done(uuid, uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.set_job_step_done(uuid, uuid, bigint, uuid) to service_role;
