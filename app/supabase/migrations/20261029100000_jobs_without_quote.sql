-- Jobs without a quote (founder, 2026-10-11): a walk-in order, a repeat, or work agreed over WhatsApp can be a job
-- straight away. A job no longer has to come from a quote.
--
-- SECURITY-SENSITIVE: relaxes two columns of `jobs` and adds a security-definer function that only our server (the
-- service role) can call, like create_job_from_quote. Needs human review before it is applied to a hosted project.
--
-- * jobs.quote_id and jobs.quote_version may be empty, but only together (a quote always comes with its version).
--   The composite same-business foreign key to quotes still holds for a job that has a quote (an empty column skips
--   it), and the "one active job per quote" index only ever looked at jobs with a quote.
-- * create_job: makes a job for one of the business's customers from what the maker typed (what to make, the day
--   it is needed, collection or delivery with an address, a note). It copies the customer's name and contact
--   details, as the quote path does, so the job never changes when the customer is edited.

alter table public.jobs alter column quote_id drop not null;
alter table public.jobs alter column quote_version drop not null;
alter table public.jobs
  add constraint jobs_quote_and_version_together check ((quote_id is null) = (quote_version is null));

-- ---------------------------------------------------------------------------
-- create_job. SERVER ONLY (service role). The server has already checked the input and, with the person's own
-- session, that the customer is theirs.
--
-- p_items: a JSON array of 1 to 50 items: { name, description, quantityMilli, unit }.
-- Errors: 22023 the customer is not found in this business, or something is not valid. Returns the new job's id.
-- ---------------------------------------------------------------------------
create function public.create_job(
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
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'name') is distinct from 'string'
       or char_length(btrim(item ->> 'name')) not between 1 and 300
       or jsonb_typeof(item -> 'quantityMilli') is distinct from 'number'
       or (item ->> 'quantityMilli') !~ '^[0-9]{1,10}$'
       -- (the cast only runs once the text is known to be digits)
       or (case when (item ->> 'quantityMilli') ~ '^[0-9]{1,10}$' then (item ->> 'quantityMilli')::bigint not between 1 and 9999999999 else true end)
       or (item -> 'description' is not null and jsonb_typeof(item -> 'description') not in ('string', 'null'))
       or char_length(coalesce(item ->> 'description', '')) > 4000
       or (item -> 'unit' is not null and jsonb_typeof(item -> 'unit') not in ('string', 'null'))
       or char_length(coalesce(item ->> 'unit', '')) > 20 then
      raise exception 'an item is not valid' using errcode = '22023';
    end if;
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

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.job_items (organisation_id, job_id, sort_order, kind, name, description, quantity_milli, unit)
    values (
      p_org, jid, i, 'custom', btrim(item ->> 'name'), nullif(btrim(item ->> 'description'), ''),
      (item ->> 'quantityMilli')::bigint, nullif(btrim(item ->> 'unit'), '')
    );
    i := i + 1;
  end loop;

  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, jid, 'created', null, 'not_started', p_actor);

  return jid;
end;
$$;

revoke execute on function public.create_job(uuid, uuid, uuid, text, text, date, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_job(uuid, uuid, uuid, text, text, date, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- move_job_status, as before, except that a job without a quote has no quote to lock or check on restore.
-- ---------------------------------------------------------------------------
create or replace function public.move_job_status(p_org uuid, p_job_id uuid, p_actor uuid, p_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
  q public.quotes%rowtype;
  qid uuid;
  allowed boolean;
begin
  if p_to not in ('not_started', 'in_progress', 'ready', 'out_for_delivery', 'done', 'cancelled') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  -- The quote is locked first (as creating a job does), so a restore and a reopen of the quote cannot cross.
  select quote_id into qid from public.jobs where id = p_job_id and organisation_id = p_org;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if qid is not null then
    select * into q from public.quotes where id = qid and organisation_id = p_org for update;
  end if;
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  -- A cancelled job comes back only while its quote is still the accepted version it was made from.
  -- (A job made without a quote has nothing to check.)
  if j.status = 'cancelled' and p_to = 'not_started' and j.quote_id is not null
     and (q.status <> 'accepted' or q.version <> j.quote_version) then
    raise exception 'the quote has changed since this job was made' using errcode = 'P0002';
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
