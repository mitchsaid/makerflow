-- Invoices, slice I1 (docs/plans/invoices-and-payments.md): an accepted quote becomes a numbered, immutable tax
-- invoice, drawn from a frozen snapshot, the maker's choice.
--
-- SECURITY-SENSITIVE: money, tax documents, immutability, gapless numbering. A new table pair with row-level security,
-- a service-role-only security-definer function that writes them, and a change to delete_account. Needs human review
-- before it is applied to any hosted project.
--
-- HOW IT WORKS
-- * An invoice is made from the LATEST sent version of an ACCEPTED quote, by issue_invoice, which only our server (the
--   service role) can call, after it has checked with the person's own session that the quote is theirs. The server
--   builds the invoice's document (a snapshot) from that version's frozen snapshot; the function checks the lines and
--   totals are exactly the version's (nothing is recomputed or made up), gives the invoice the next number from the
--   business's own sequence INSIDE THE SAME TRANSACTION (so a failed issue leaves no gap), writes the number into the
--   document (and into the payment reference line of the bank details, when the business asks for it), copies the
--   version's private costing, and logs the event.
-- * One invoice per quote in this slice (progress billing is a later layer): a unique key on the quote.
-- * An issued invoice NEVER changes and is NEVER deleted: no update or delete grant for anyone, a trigger that refuses
--   both for every path (the one allowed change is forgetting who issued it when that login is deleted, like a sent
--   quote version), and a business that has invoices cannot be deleted (RESTRICT, and delete_account refuses with a
--   clear reason). Corrections are credit notes (a later slice).
-- * The status (unpaid, part paid, paid, overdue) is NOT stored; it is worked out from payments (slice I2).

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete restrict,
  number text not null check (char_length(btrim(number)) between 1 and 40),
  quote_id uuid not null,
  -- The version of the quote the invoice was made from.
  quote_version integer not null check (quote_version >= 1),
  -- A live link, only to open the customer; the invoice's own copy is in the snapshot.
  customer_id uuid,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  issue_date date not null,
  due_date date not null,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  net_cents bigint not null check (net_cents >= 0),
  vat_cents bigint not null check (vat_cents >= 0),
  gross_cents bigint not null check (gross_cents >= 0),
  -- Everything the document shows. The PDF is drawn from this and nothing else.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  -- What the work cost, copied from the quote version. PRIVATE: members only, never in the snapshot.
  costing jsonb check (costing is null or jsonb_typeof(costing) = 'object'),
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  issued_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoices_org_id_unique unique (organisation_id, id),
  constraint invoices_number_unique unique (organisation_id, number),
  -- One invoice per quote in this slice.
  constraint invoices_one_per_quote unique (quote_id),
  constraint invoices_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id),
  constraint invoices_customer_same_org
    foreign key (organisation_id, customer_id) references public.customers (organisation_id, id),
  constraint invoices_due_not_before_issue check (due_date >= issue_date),
  constraint invoices_money_adds_up check (net_cents + vat_cents = gross_cents)
);

create index invoices_org_issue_idx on public.invoices (organisation_id, issue_date desc);

create table public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  invoice_id uuid not null,
  kind text not null check (kind in ('issued')),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoice_events_invoice_same_org
    foreign key (organisation_id, invoice_id) references public.invoices (organisation_id, id)
);

create index invoice_events_invoice_idx on public.invoice_events (invoice_id, created_at);

-- Issued means final. Updates are refused for every path, the service role and the definer functions included; the
-- one exception is forgetting a deleted login. Deletes are refused outright.
create function public.invoices_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.issued_by is null and old.issued_by is not null
     and (to_jsonb(new) - 'issued_by') = (to_jsonb(old) - 'issued_by') then
    return new;
  end if;
  raise exception 'an issued invoice cannot be changed or deleted' using errcode = '55000';
end;
$$;

create function public.invoice_events_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'an invoice''s history cannot be changed or deleted' using errcode = '55000';
end;
$$;

revoke execute on function public.invoices_immutable() from public, anon, authenticated;
revoke execute on function public.invoice_events_immutable() from public, anon, authenticated;

create trigger invoices_immutable
  before update or delete on public.invoices
  for each row execute function public.invoices_immutable();
create trigger invoice_events_immutable
  before update or delete on public.invoice_events
  for each row execute function public.invoice_events_immutable();

-- Members read. Nobody writes directly: no insert, update or delete grant.
revoke all on public.invoices, public.invoice_events from anon, authenticated;
grant select on public.invoices, public.invoice_events to authenticated;

alter table public.invoices enable row level security;
alter table public.invoice_events enable row level security;

create policy invoices_select_members on public.invoices for select to authenticated
  using (public.is_org_member(organisation_id));
create policy invoice_events_select_members on public.invoice_events for select to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.invoices
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));
create policy session_required on public.invoice_events
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- issue_invoice. SERVER ONLY (service role). The server has already checked, with the person's own session, that the
-- quote is theirs.
--
-- p_snapshot is the invoice's document with "number" still empty. p_reference_label, when given, is the label of the
-- payment reference line ("Payment reference"), added to the document's bank details with the new number as its value.
--
-- Errors: P0002 the quote is not found, is not accepted, has no sent version, or its latest version is not the one
-- the document was built from; 23505 it already has an invoice; 22023 it has no customer or the dates or document
-- do not fit; 23514 the money does not add up.
-- Returns the new invoice's id and number.
-- ---------------------------------------------------------------------------
create function public.issue_invoice(
  p_org uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_issue_date date,
  p_due_date date,
  p_note text,
  p_snapshot jsonb,
  p_reference_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
  v public.quote_versions%rowtype;
  snap jsonb;
  cust jsonb;
  num text;
  iid uuid;
begin
  if p_issue_date is null or p_due_date is null or p_due_date < p_issue_date then
    raise exception 'the due day cannot be before the invoice day' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'the invoice document is missing' using errcode = '22023';
  end if;

  select * into q from public.quotes where id = p_quote_id and organisation_id = p_org for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;
  if q.status <> 'accepted' then
    raise exception 'only an accepted quote can be invoiced' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.invoices where quote_id = q.id) then
    raise exception 'this quote already has an invoice' using errcode = '23505';
  end if;

  select * into v from public.quote_versions where quote_id = q.id order by version desc limit 1;
  if not found then
    raise exception 'the quote has no sent version' using errcode = 'P0002';
  end if;

  -- What the document says must be exactly what was agreed: the same lines and the same totals, to the cent.
  if (p_snapshot -> 'lines') is distinct from (v.snapshot -> 'lines')
     or (p_snapshot -> 'totals') is distinct from (v.snapshot -> 'totals')
     or (p_snapshot ->> 'version')::integer is distinct from v.version then
    raise exception 'the quote changed since this invoice was prepared' using errcode = 'P0002';
  end if;
  if (p_snapshot ->> 'issueDate')::date is distinct from p_issue_date
     or (p_snapshot #>> '{invoice,dueDate}')::date is distinct from p_due_date then
    raise exception 'the dates on the document are not the invoice dates' using errcode = '22023';
  end if;

  cust := p_snapshot -> 'customer';
  if cust is null or jsonb_typeof(cust) <> 'object' or nullif(btrim(cust ->> 'name'), '') is null then
    raise exception 'the invoice has no customer' using errcode = '22023';
  end if;
  if (p_snapshot -> 'totals' ->> 'netCents')::bigint + (p_snapshot -> 'totals' ->> 'vatCents')::bigint
     is distinct from (p_snapshot -> 'totals' ->> 'grossCents')::bigint then
    raise exception 'the invoice money does not add up' using errcode = '23514';
  end if;

  -- The number is taken here, inside this transaction, so a failure anywhere above or below gives none back.
  num := public.issue_document_number(p_org, 'invoice');

  snap := jsonb_set(p_snapshot, '{number}', to_jsonb(num));
  if p_reference_label is not null and jsonb_typeof(snap -> 'bankDetails') = 'array'
     and jsonb_array_length(snap -> 'bankDetails') > 0 then
    snap := jsonb_set(snap, '{bankDetails}',
      (snap -> 'bankDetails') || jsonb_build_array(jsonb_build_object('label', p_reference_label, 'value', num)));
  end if;

  insert into public.invoices (
    organisation_id, number, quote_id, quote_version, customer_id, customer_name, issue_date, due_date,
    currency_code, net_cents, vat_cents, gross_cents, snapshot, costing, note, issued_by
  ) values (
    p_org, num, q.id, v.version, q.customer_id, left(btrim(cust ->> 'name'), 200), p_issue_date, p_due_date,
    q.currency_code,
    (snap -> 'totals' ->> 'netCents')::bigint, (snap -> 'totals' ->> 'vatCents')::bigint,
    (snap -> 'totals' ->> 'grossCents')::bigint,
    snap, v.costing, nullif(btrim(p_note), ''), p_actor
  ) returning id into iid;

  insert into public.invoice_events (organisation_id, invoice_id, kind, actor_id)
  values (p_org, iid, 'issued', p_actor);

  return jsonb_build_object('id', iid, 'number', num);
end;
$$;

revoke execute on function public.issue_invoice(uuid, uuid, uuid, date, date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid, uuid, uuid, date, date, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- A quote that has been invoiced keeps its answer: the invoice was made from the accepted version. Same function as
-- before (20261028100000_jobs.sql) with this one rule added to "reopened" (error 55007).
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
    -- A quote that has an invoice keeps its answer for good (the invoice is corrected with a credit note).
    if exists (select 1 from public.invoices where quote_id = q.id) then
      raise exception 'this quote has an invoice' using errcode = '55007';
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

-- ---------------------------------------------------------------------------
-- delete_account keeps issued invoices: it refuses (55007, naming the business) to delete a business that has any.
-- Everything else is as before (20261101100000_delete_account.sql). A way to keep or hand over a business's
-- invoices comes before this can be relaxed.
-- ---------------------------------------------------------------------------
create or replace function public.delete_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  others integer;
  other_owners integer;
  deleted_orgs uuid[] := '{}';
  pictures jsonb := '[]'::jsonb;
begin
  if p_user is null then
    raise exception 'a person is needed' using errcode = '22023';
  end if;

  for m in
    select ms.organisation_id, ms.role, o.name
      from public.memberships ms
      join public.organisations o on o.id = ms.organisation_id
     where ms.user_id = p_user
     order by ms.organisation_id
       for update of o
  loop
    select count(*), count(*) filter (where role = 'owner')
      into others, other_owners
      from public.memberships
     where organisation_id = m.organisation_id and user_id <> p_user;
    if others > 0 and m.role = 'owner' and other_owners = 0 then
      raise exception 'the only owner of a business that has other people' using errcode = '55006', detail = m.name;
    end if;
    -- A business with issued invoices is not deleted (they must be kept); the person cannot leave it alone either.
    if others = 0 and exists (select 1 from public.invoices where organisation_id = m.organisation_id) then
      raise exception 'a business that has issued invoices' using errcode = '55007', detail = m.name;
    end if;
  end loop;

  for m in
    select ms.organisation_id
      from public.memberships ms
     where ms.user_id = p_user
     order by ms.organisation_id
  loop
    select count(*) into others from public.memberships where organisation_id = m.organisation_id and user_id <> p_user;
    delete from public.memberships where organisation_id = m.organisation_id and user_id = p_user;
    if others = 0 then
      pictures := pictures || coalesce(
        (select jsonb_agg(jsonb_build_object('organisationId', i.organisation_id, 'id', i.id))
           from public.images i
          where i.organisation_id = m.organisation_id),
        '[]'::jsonb);
      update public.business_profiles set logo_image_id = null where organisation_id = m.organisation_id;
      delete from public.jobs where organisation_id = m.organisation_id;
      delete from public.quote_versions where organisation_id = m.organisation_id;
      delete from public.quotes where organisation_id = m.organisation_id;
      delete from public.customers where organisation_id = m.organisation_id;
      delete from public.products where organisation_id = m.organisation_id;
      delete from public.organisations where id = m.organisation_id;
      deleted_orgs := deleted_orgs || m.organisation_id;
    end if;
  end loop;

  return jsonb_build_object('organisations', to_jsonb(deleted_orgs), 'pictures', pictures);
end;
$$;

revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
