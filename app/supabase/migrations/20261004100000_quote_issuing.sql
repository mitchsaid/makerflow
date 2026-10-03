-- Issuing quotes: numbers, versions, sending, revising, the activity log, and numbering settings.
--
-- SECURITY-SENSITIVE: new tables, new columns, security-definer functions and triggers.
-- Needs human review before this is applied to any hosted project.
--
-- HOW IT WORKS (decisions in docs/plans/quote-issuing.md)
--
-- * A quote gets its NUMBER when the draft is first saved (a trigger takes it from the
--   business's quote sequence in the same transaction, so a failed save leaves no gap). The
--   number is never editable and a revision keeps it. Deleting a draft that was never sent leaves
--   a gap, which is allowed for quotes (they are not tax documents); invoices stay gapless.
-- * SENDING and REVISING can only be done by our server (the service role). The server works
--   the totals out with the money code, builds the document snapshot, and calls send_quote().
--   Signed-in users cannot call these functions, so nobody can freeze a quote with made-up
--   totals by talking to the database directly.
-- * A quote is ONE row. Each time it is sent, the frozen document (quote_versions.snapshot) is
--   stored as a numbered version and never changes. Revising moves a sent quote back to draft
--   with version + 1; the lines are the editable copy, the snapshots are the record.
-- * quote_events is the activity log.

-- ---------------------------------------------------------------------------
-- quotes: number, version, last sent
-- ---------------------------------------------------------------------------

alter table public.quotes
  add column number text,
  add column version integer not null default 1 check (version >= 1),
  add column last_sent_at timestamptz;

-- Drafts that exist already get numbers, oldest first.
do $$
declare
  q record;
begin
  for q in select id, organisation_id from public.quotes where number is null order by created_at, id loop
    update public.quotes set number = public.issue_document_number(q.organisation_id, 'quote') where id = q.id;
  end loop;
end
$$;

alter table public.quotes alter column number set not null;
alter table public.quotes add constraint quotes_number_unique unique (organisation_id, number);

-- A quote that has been sent can never be deleted, and neither can a revision of one (deleting
-- it would take the sent versions with it). The old rule only looked at the status.
drop policy quotes_delete_draft_members on public.quotes;
create policy quotes_delete_draft_members
  on public.quotes for delete to authenticated
  using (public.is_org_member(organisation_id) and status = 'draft' and last_sent_at is null);

-- Number and version are set by the database only: neither is in the insert or update grants.

create function public.quotes_assign_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- This runs before row-level security is checked, so check membership first: somebody who is
  -- not a member must not be able to spend (or even lock) another business's numbers.
  if (select auth.uid()) is not null and not public.is_org_member(new.organisation_id) then
    raise exception 'not a member of this business' using errcode = '42501';
  end if;
  new.number := public.issue_document_number(new.organisation_id, 'quote');
  new.version := 1;
  new.last_sent_at := null;
  return new;
end;
$$;

revoke execute on function public.quotes_assign_number() from public, anon, authenticated;

create trigger quotes_assign_number
  before insert on public.quotes
  for each row execute function public.quotes_assign_number();

-- ---------------------------------------------------------------------------
-- quote_versions: the frozen document, one row per time the quote was sent
-- ---------------------------------------------------------------------------

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  quote_id uuid not null,
  version integer not null check (version >= 1),
  sent_at timestamptz not null default now(),
  -- 'shared': shared or downloaded from the app. 'marked': the maker sent it some other way.
  sent_via text not null check (sent_via in ('shared', 'marked')),
  sent_by uuid references auth.users (id) on delete set null,
  -- Everything the document shows (business and customer details, lines with their amounts,
  -- totals, VAT mode and rate, the wording used, country and currency). The PDF is drawn from
  -- this and nothing else.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  constraint quote_versions_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id),
  constraint quote_versions_unique unique (quote_id, version)
);

create index quote_versions_org_quote_idx on public.quote_versions (organisation_id, quote_id);

-- A frozen version never changes, whoever asks.
create function public.quote_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'a sent quote version cannot be changed' using errcode = '55000';
end;
$$;

revoke execute on function public.quote_versions_immutable() from public, anon, authenticated;

create trigger quote_versions_immutable
  before update on public.quote_versions
  for each row execute function public.quote_versions_immutable();

-- ---------------------------------------------------------------------------
-- quote_events: the activity log
-- ---------------------------------------------------------------------------

create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  quote_id uuid not null,
  version integer not null check (version >= 1),
  kind text not null check (kind in ('created', 'sent', 'revised')),
  -- For 'sent' only: 'shared' or 'marked'.
  via text check (via is null or via in ('shared', 'marked')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quote_events_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id)
    on delete cascade,
  constraint quote_events_via_only_when_sent check ((kind = 'sent') = (via is not null))
);

create index quote_events_quote_idx on public.quote_events (quote_id, created_at);

-- Creating a draft is the first event.
create function public.quotes_log_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id)
  values (new.organisation_id, new.id, 1, 'created', (select auth.uid()));
  return new;
end;
$$;

revoke execute on function public.quotes_log_created() from public, anon, authenticated;

create trigger quotes_log_created
  after insert on public.quotes
  for each row execute function public.quotes_log_created();

-- ---------------------------------------------------------------------------
-- Grants and row-level security: members read, nobody writes through the API.
-- ---------------------------------------------------------------------------

revoke all on public.quote_versions, public.quote_events from anon, authenticated;
grant select on public.quote_versions, public.quote_events to authenticated;

alter table public.quote_versions enable row level security;
alter table public.quote_events enable row level security;

create policy quote_versions_select_members
  on public.quote_versions for select to authenticated
  using (public.is_org_member(organisation_id));

create policy quote_events_select_members
  on public.quote_events for select to authenticated
  using (public.is_org_member(organisation_id));

create policy session_required on public.quote_versions
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.quote_events
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- send_quote: draft -> sent, in one transaction. SERVER ONLY (service role).
--
-- The caller (our server) has already checked that the person may do this, worked out the
-- totals from the stored lines, and built the snapshot. p_expected_updated_at is the
-- updated_at the server read the draft at: if the draft was saved since, nothing is sent (the
-- snapshot would not match what is stored). Returns {number, version}.
-- Errors: P0002 not a draft of this business; 40001 the draft changed meanwhile; 23514 the
-- quote is not complete (no customer, no lines, bad snapshot).
-- ---------------------------------------------------------------------------

create function public.send_quote(
  p_org uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_via text,
  p_expected_updated_at timestamptz,
  p_snapshot jsonb,
  p_net_cents bigint,
  p_vat_cents bigint,
  p_gross_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
begin
  if p_via not in ('shared', 'marked') then
    raise exception 'unknown way of sending' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'the snapshot must be an object' using errcode = '23514';
  end if;

  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org and status = 'draft'
     for update;
  if not found then
    raise exception 'draft quote not found' using errcode = 'P0002';
  end if;
  if q.updated_at <> p_expected_updated_at then
    raise exception 'the draft changed while it was being sent' using errcode = '40001';
  end if;
  if q.customer_id is null then
    raise exception 'a quote needs a customer before it is sent' using errcode = '23514';
  end if;
  if not exists (select 1 from public.quote_lines where quote_id = q.id and organisation_id = p_org) then
    raise exception 'a quote needs at least one line before it is sent' using errcode = '23514';
  end if;
  if (p_snapshot ->> 'number') is distinct from q.number
     or (p_snapshot ->> 'version')::integer is distinct from q.version then
    raise exception 'the snapshot is not for this quote' using errcode = '23514';
  end if;

  update public.quotes
     set status = 'sent', last_sent_at = now(),
         net_cents = p_net_cents, vat_cents = p_vat_cents, gross_cents = p_gross_cents
   where id = q.id;

  insert into public.quote_versions (organisation_id, quote_id, version, sent_via, sent_by, snapshot)
  values (p_org, q.id, q.version, p_via, p_actor, p_snapshot);

  insert into public.quote_events (organisation_id, quote_id, version, kind, via, actor_id)
  values (p_org, q.id, q.version, 'sent', p_via, p_actor);

  return jsonb_build_object('number', q.number, 'version', q.version);
end;
$$;

-- ---------------------------------------------------------------------------
-- revise_quote: sent -> a new draft version with the same number. SERVER ONLY.
-- The lines are already there (they are what was sent); the earlier version stays frozen in
-- quote_versions. Returns the new version number.
-- ---------------------------------------------------------------------------

create function public.revise_quote(p_org uuid, p_quote_id uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
begin
  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org and status = 'sent'
     for update;
  if not found then
    raise exception 'sent quote not found' using errcode = 'P0002';
  end if;

  update public.quotes set status = 'draft', version = q.version + 1 where id = q.id;

  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id)
  values (p_org, q.id, q.version + 1, 'revised', p_actor);

  return q.version + 1;
end;
$$;

revoke execute on function
  public.send_quote(uuid, uuid, uuid, text, timestamptz, jsonb, bigint, bigint, bigint),
  public.revise_quote(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.send_quote(uuid, uuid, uuid, text, timestamptz, jsonb, bigint, bigint, bigint),
  public.revise_quote(uuid, uuid, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- set_document_numbering: the prefix and next number, from the Business profile.
-- Signed-in OWNERS and ADMINS only. The next number can never go back to one already used.
-- ---------------------------------------------------------------------------

create function public.set_document_numbering(
  p_org uuid,
  p_doc_type text,
  p_prefix text,
  p_next_number integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq public.document_sequences%rowtype;
begin
  -- A definer function skips row-level security, so the session and role are checked here.
  if not (select public.session_is_active()) then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not public.has_org_role(p_org, array['owner', 'admin']) then
    raise exception 'only owners and admins can change numbering' using errcode = '42501';
  end if;
  -- Quotes only for now; invoices get their own rules (gapless, legal) when they are built.
  if p_doc_type <> 'quote' then
    raise exception 'only quote numbering can be changed' using errcode = '22023';
  end if;

  insert into public.document_sequences (organisation_id, doc_type, prefix)
  values (p_org, p_doc_type, 'QT-')
  on conflict (organisation_id, doc_type) do nothing;

  select * into seq from public.document_sequences
   where organisation_id = p_org and doc_type = p_doc_type
     for update;

  if p_next_number is null or p_next_number < 1 then
    raise exception 'the next number must be at least 1' using errcode = '22023';
  end if;
  if seq.last_issued_number is not null and p_next_number <= seq.last_issued_number then
    raise exception 'the next number must be higher than the last one used (%)', seq.last_issued_number
      using errcode = '22023';
  end if;

  -- The prefix is checked by the table's own constraint.
  update public.document_sequences
     set prefix = p_prefix, next_number = p_next_number
   where organisation_id = p_org and doc_type = p_doc_type;
end;
$$;

revoke execute on function public.set_document_numbering(uuid, text, text, integer) from public, anon;
grant execute on function public.set_document_numbering(uuid, text, text, integer) to authenticated;
