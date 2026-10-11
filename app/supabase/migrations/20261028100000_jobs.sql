-- Jobs (docs/plans/jobs-and-invoices.md, part 1, slice 1): an accepted quote becomes a job to make, then collect or
-- deliver. The maker moves it through a few plain steps; each move is logged.
--
-- SECURITY-SENSITIVE: three new tables with row-level security, and two new security-definer functions that only
-- our server (the service role) can call, like send_quote and record_quote_outcome. Needs human review before it is
-- applied to any hosted project.
--
-- HOW IT WORKS
-- * A job is made from the LATEST sent version of an accepted quote, and copies what is to be made out of that
--   frozen snapshot: the customer's name and contact details, the items (with their chosen variation and options),
--   collection or delivery with the address, and the needed-by day. The copy never changes when the quote is
--   revised or its customer is edited. One job per quote at a time (a cancelled job does not count).
-- * Statuses: not_started, in_progress, ready, out_for_delivery (delivery jobs only), done, cancelled. They change
--   only through move_job_status, along the moves it allows, and each change is an event.
-- * Job numbers are their own simple count per business (1, 2, 3 ...), shown as J-0001 in the app. A job is not a
--   legal document, so unlike an invoice number this does not need to be gapless; jobs are never deleted anyway.
-- * What a member can change directly: the maker's own note on a job. Nothing else, and no job, item or event can
--   be deleted.

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  number integer not null check (number >= 1),
  quote_id uuid not null,
  -- The version of the quote the job was made from.
  quote_version integer not null check (quote_version >= 1),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'ready', 'out_for_delivery', 'done', 'cancelled')),
  fulfilment text not null default 'none' check (fulfilment in ('none', 'collection', 'delivery')),
  delivery_address text check (delivery_address is null or char_length(btrim(delivery_address)) between 1 and 1000),
  needed_by date,
  -- Frozen from the quote's customer when the job was made, so the job never changes under the maker.
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  customer_contact_person text check (customer_contact_person is null or char_length(customer_contact_person) <= 200),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 100),
  customer_email text check (customer_email is null or char_length(customer_email) <= 320),
  -- A live link, only to open the customer; it can be empty.
  customer_id uuid,
  -- The maker's own note about the job.
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_org_id_unique unique (organisation_id, id),
  constraint jobs_number_unique unique (organisation_id, number),
  constraint jobs_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id),
  constraint jobs_customer_same_org
    foreign key (organisation_id, customer_id) references public.customers (organisation_id, id),
  -- Out for delivery only makes sense for a delivery.
  constraint jobs_out_for_delivery_only_for_delivery check (status <> 'out_for_delivery' or fulfilment = 'delivery')
);

create index jobs_org_status_idx on public.jobs (organisation_id, status, needed_by);
create index jobs_quote_idx on public.jobs (quote_id);
-- One job per quote at a time: a cancelled one does not count, so the quote can get a new job.
create unique index jobs_one_active_per_quote on public.jobs (quote_id) where status <> 'cancelled';

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.job_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  job_id uuid not null,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  kind text not null check (kind in ('product', 'service', 'custom')),
  name text not null check (char_length(btrim(name)) between 1 and 300),
  description text check (description is null or char_length(description) <= 4000),
  quantity_milli bigint not null check (quantity_milli >= 1),
  unit text check (unit is null or char_length(unit) <= 40),
  -- The variation chosen ("Size": "Large"), and the options and extras, as the quote item had them.
  variation_label text check (variation_label is null or char_length(variation_label) <= 200),
  variation_name text check (variation_name is null or char_length(variation_name) <= 200),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  -- The product's photo, to show at the bench.
  photo_image_id uuid,
  constraint job_items_job_same_org
    foreign key (organisation_id, job_id) references public.jobs (organisation_id, id) on delete cascade,
  constraint job_items_photo_same_org
    foreign key (organisation_id, photo_image_id) references public.images (organisation_id, id)
);

create index job_items_job_idx on public.job_items (job_id, sort_order);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  job_id uuid not null,
  kind text not null check (kind in ('created', 'status')),
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint job_events_job_same_org
    foreign key (organisation_id, job_id) references public.jobs (organisation_id, id) on delete cascade,
  constraint job_events_shape check ((kind = 'created') = (from_status is null))
);

create index job_events_job_idx on public.job_events (job_id, created_at);

-- Members read. They can change only the note of a job; everything else goes through the functions below.
revoke all on public.jobs, public.job_items, public.job_events from anon, authenticated;
grant select on public.jobs, public.job_items, public.job_events to authenticated;
grant update (note) on public.jobs to authenticated;

alter table public.jobs enable row level security;
alter table public.job_items enable row level security;
alter table public.job_events enable row level security;

create policy jobs_select_members on public.jobs for select to authenticated using (public.is_org_member(organisation_id));
create policy jobs_update_members on public.jobs for update to authenticated
  using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy job_items_select_members on public.job_items for select to authenticated using (public.is_org_member(organisation_id));
create policy job_events_select_members on public.job_events for select to authenticated using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.jobs
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));
create policy session_required on public.job_items
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));
create policy session_required on public.job_events
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- create_job_from_quote. SERVER ONLY (service role). The server has already checked, with the person's own
-- session, that the quote is theirs.
--
-- Errors: P0002 the quote is not found or is not accepted; 23505 it already has a job; 22023 it has no customer.
-- Returns the new job's id.
-- ---------------------------------------------------------------------------
create function public.create_job_from_quote(p_org uuid, p_quote_id uuid, p_actor uuid)
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
    variation_label, variation_name, options, photo_image_id
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
    nullif(e.value ->> 'photoImageId', '')::uuid
  from jsonb_array_elements(snap -> 'lines') with ordinality as e(value, ord)
  where e.value ->> 'kind' in ('product', 'service', 'custom');

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

revoke execute on function public.create_job_from_quote(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_job_from_quote(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- move_job_status. SERVER ONLY (service role). Moves allowed:
--   not_started -> in_progress | cancelled
--   in_progress -> ready | not_started | cancelled
--   ready -> out_for_delivery (delivery jobs) | done | in_progress | cancelled
--   out_for_delivery -> done | ready
--   done -> ready (undo)
--   cancelled -> not_started (restore; refused if the quote has another job by now)
-- Errors: P0002 the job is not found or the move is not allowed; 22023 unknown status; 23505 restoring when the quote
-- has another job. Returns the new status.
-- ---------------------------------------------------------------------------
create function public.move_job_status(p_org uuid, p_job_id uuid, p_actor uuid, p_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
  allowed boolean;
begin
  if p_to not in ('not_started', 'in_progress', 'ready', 'out_for_delivery', 'done', 'cancelled') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;

  allowed := case j.status
    when 'not_started' then p_to in ('in_progress', 'cancelled')
    when 'in_progress' then p_to in ('ready', 'not_started', 'cancelled')
    when 'ready' then p_to in ('done', 'in_progress', 'cancelled') or (p_to = 'out_for_delivery' and j.fulfilment = 'delivery')
    when 'out_for_delivery' then p_to in ('done', 'ready')
    when 'done' then p_to = 'ready'
    when 'cancelled' then p_to = 'not_started'
    else false
  end;
  if not allowed then
    raise exception 'that move is not allowed from %', j.status using errcode = 'P0002';
  end if;

  update public.jobs set status = p_to where id = j.id;
  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, j.id, 'status', j.status, p_to, p_actor);
  return p_to;
end;
$$;

revoke execute on function public.move_job_status(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.move_job_status(uuid, uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- A quote with a job in progress can't be taken back to "sent": the job was made from the accepted answer.
-- Cancel the job first (that frees the quote). Same function as before, with this one rule added (error 55006).
-- ---------------------------------------------------------------------------

create or replace function public.record_quote_outcome(
  p_org uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_outcome text,
  p_on date,
  p_how text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
  new_status text;
  note text := nullif(btrim(p_note), '');
begin
  if p_outcome not in ('accepted', 'declined', 'withdrawn', 'reopened') then
    raise exception 'unknown outcome' using errcode = '22023';
  end if;
  if (p_outcome in ('accepted', 'declined')) <> (p_on is not null and p_how is not null) then
    raise exception 'an answer needs a day and a way, and nothing else does' using errcode = '22023';
  end if;
  if p_outcome not in ('accepted', 'declined') and (p_on is not null or p_how is not null) then
    raise exception 'only an answer has a day and a way' using errcode = '22023';
  end if;
  if p_how is not null and p_how not in ('whatsapp', 'email', 'in_person', 'phone', 'other') then
    raise exception 'unknown way' using errcode = '22023';
  end if;
  if p_outcome = 'reopened' and note is not null then
    raise exception 'changing an answer takes no note' using errcode = '22023';
  end if;
  if note is not null and char_length(note) > 500 then
    raise exception 'the note is too long' using errcode = '22023';
  end if;

  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org
     for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  if p_outcome = 'reopened' then
    if q.status not in ('accepted', 'declined') then
      raise exception 'only an accepted or declined quote can be reopened' using errcode = 'P0002';
    end if;
    -- A quote that is being made as a job keeps its answer until the job is cancelled.
    if exists (select 1 from public.jobs where quote_id = q.id and status <> 'cancelled') then
      raise exception 'this quote has a job' using errcode = '55006';
    end if;
    new_status := 'sent';
  else
    if q.status <> 'sent' then
      raise exception 'only a sent quote can be answered or withdrawn' using errcode = 'P0002';
    end if;
    new_status := p_outcome;
  end if;

  update public.quotes set status = new_status where id = q.id;

  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id, on_date, how, note)
  values (p_org, q.id, q.version, p_outcome, p_actor, p_on, p_how, note);

  return new_status;
end;
$$;
