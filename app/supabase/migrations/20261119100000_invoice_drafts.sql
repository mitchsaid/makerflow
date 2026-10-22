-- Invoice drafts, and invoices with no quote (docs/plans/invoice-i3.md, I3b and I3c; founder, 2026-10-22: "an invoice
-- with no quote, and an editable draft").
--
-- SECURITY-SENSITIVE: money, tax documents, gapless numbering, a new table with row-level security, a new
-- service-role-only security-definer function that writes invoices, and two columns of invoices made optional. Needs
-- human review before it is applied to any hosted project. The immutability of issued invoices is NOT changed: the
-- triggers, the missing grants and the refusal to delete are as they were.
--
-- HOW IT WORKS
-- * An invoice DRAFT is private working state, not a tax document: the invoice form's values (one JSON object), kept
--   until it is issued or discarded. Members of the business create, change and discard drafts under their own session
--   (row-level security); a draft can be linked to an ACCEPTED quote of the same business (one draft per quote), which
--   is "adjust before issuing". At most 100 drafts a business. Nothing a draft holds is money that was worked out: the
--   server works every total out again from the saved values when the draft is issued.
-- * issue_invoice_from_draft (SERVER ONLY, the service role) issues a draft: it locks the draft, checks it has not
--   changed since the server read it, checks the linked quote (when there is one) is accepted and has no invoice, takes
--   the next invoice number INSIDE THE SAME TRANSACTION (a failed issue leaves no gap), writes the invoice and its
--   "issued" event, and deletes the draft. The server builds the document from the saved values and checks, with the
--   person's own session, that the draft is theirs first, exactly as for issue_invoice.
-- * A draft linked to a quote remembers WHICH VERSION of the quote it started from; issuing refuses it if the quote has
--   since been reopened and re-sent (the draft would carry old prices as if they were agreed ones).
-- * The invoice's live link to its customer is the one the server used to build the document: the server passes it and
--   the function refuses a draft whose customer column disagrees (the column and the form's own customer are written
--   together by the app, but a member could change the column alone).
-- * Deleting a customer or an organisation deletes its drafts (private working state): the customer link cascades on
--   purpose, because delete_account removes customers explicitly. A future "delete a customer" feature must say so.
-- * invoices.quote_id and quote_version become optional TOGETHER (an invoice with no quote has neither); the unique key
--   on quote_id stays (one invoice per quote); invoices.adjusted says an invoice was made from a quote's draft rather
--   than as agreed. An invoice with no quote has no private costing (nothing was costed).

alter table public.invoices
  alter column quote_id drop not null,
  alter column quote_version drop not null,
  add column adjusted boolean not null default false,
  add constraint invoices_quote_and_version_together check ((quote_id is null) = (quote_version is null)),
  add constraint invoices_adjusted_needs_quote check (not adjusted or quote_id is not null);

create table public.invoice_drafts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  -- The accepted quote it adjusts, or null for an invoice with no quote.
  quote_id uuid,
  -- The version of that quote the draft started from (set with the quote, null without one).
  quote_version integer check (quote_version is null or quote_version >= 1),
  customer_id uuid,
  -- The invoice form as the maker left it. The server checks and works it out when the draft is issued.
  form jsonb not null check (jsonb_typeof(form) = 'object' and pg_column_size(form) <= 200000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_drafts_org_id_unique unique (organisation_id, id),
  constraint invoice_drafts_one_per_quote unique (quote_id),
  constraint invoice_drafts_quote_and_version_together check ((quote_id is null) = (quote_version is null)),
  constraint invoice_drafts_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id) on delete cascade,
  constraint invoice_drafts_customer_same_org
    foreign key (organisation_id, customer_id) references public.customers (organisation_id, id) on delete cascade
);

create index invoice_drafts_org_updated_idx on public.invoice_drafts (organisation_id, updated_at desc);

create trigger invoice_drafts_set_updated_at
  before update on public.invoice_drafts
  for each row execute function public.set_updated_at();

-- At most 100 drafts a business, so the list cannot grow without end.
create function public.invoice_drafts_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.invoice_drafts where organisation_id = new.organisation_id) >= 100 then
    raise exception 'a business can keep at most 100 invoice drafts' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.invoice_drafts_limit() from public, anon, authenticated;

create trigger invoice_drafts_limit
  before insert on public.invoice_drafts
  for each row execute function public.invoice_drafts_limit();

-- Members read, create, change and discard drafts. What a draft is LINKED to never changes after it is made.
revoke all on public.invoice_drafts from anon, authenticated;
grant select, delete on public.invoice_drafts to authenticated;
grant insert (organisation_id, quote_id, quote_version, customer_id, form, created_by) on public.invoice_drafts to authenticated;
grant update (customer_id, form) on public.invoice_drafts to authenticated;

alter table public.invoice_drafts enable row level security;

create policy invoice_drafts_select_members on public.invoice_drafts for select to authenticated
  using (public.is_org_member(organisation_id));

-- A draft linked to a quote needs an ACCEPTED quote of the same business.
create policy invoice_drafts_insert_members on public.invoice_drafts for insert to authenticated
  with check (
    public.is_org_member(organisation_id)
    and (created_by is null or created_by = (select auth.uid()))
    and (
      quote_id is null
      or exists (
        select 1 from public.quotes q
         where q.id = quote_id and q.organisation_id = invoice_drafts.organisation_id and q.status = 'accepted'
      )
    )
  );

create policy invoice_drafts_update_members on public.invoice_drafts for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy invoice_drafts_delete_members on public.invoice_drafts for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.invoice_drafts
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- issue_invoice_from_draft. SERVER ONLY (service role). The server has already read the draft under the person's own
-- session, checked it is theirs, worked the document out from its saved values, and noted the draft's updated_at.
--
-- p_snapshot is the invoice's document with "number" still empty. p_reference_label, when given, is the label of the
-- payment reference line, added to the document's bank details with the new number as its value.
--
-- p_customer_id is the customer the server built the document for; p_adjusted says the document differs from the
-- quote as agreed (the server compares them; it only counts for a draft linked to a quote).
--
-- Errors: P0002 the draft is not found, or its quote is not accepted, has no sent version, or is no longer the version
-- the draft started from; 40001 the draft changed since the server read it; 23505 the quote already has an invoice; 22023 the dates, the document, the customer, the
-- currency or the items do not fit; 23514 the money does not add up.
-- Returns the new invoice's id and number.
-- ---------------------------------------------------------------------------
create function public.issue_invoice_from_draft(
  p_org uuid,
  p_draft_id uuid,
  p_actor uuid,
  p_customer_id uuid,
  p_adjusted boolean,
  p_expected_updated_at timestamptz,
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
  d public.invoice_drafts%rowtype;
  q public.quotes%rowtype;
  v public.quote_versions%rowtype;
  snap jsonb;
  cust jsonb;
  currency text;
  num text;
  iid uuid;
begin
  if p_issue_date is null or p_due_date is null or p_due_date < p_issue_date then
    raise exception 'the due day cannot be before the invoice day' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'the invoice document is missing' using errcode = '22023';
  end if;

  select * into d from public.invoice_drafts where id = p_draft_id and organisation_id = p_org for update;
  if not found then
    raise exception 'draft not found' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is distinct from d.updated_at then
    raise exception 'the draft changed while it was being issued' using errcode = '40001';
  end if;
  if d.customer_id is distinct from p_customer_id then
    raise exception 'the draft''s customer is not the customer the document was made for' using errcode = '22023';
  end if;

  if d.quote_id is not null then
    select * into q from public.quotes where id = d.quote_id and organisation_id = p_org for update;
    if not found or q.status <> 'accepted' then
      raise exception 'only an accepted quote can be invoiced' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.invoices where quote_id = q.id) then
      raise exception 'this quote already has an invoice' using errcode = '23505';
    end if;
    select * into v from public.quote_versions where quote_id = q.id order by version desc limit 1;
    if not found then
      raise exception 'the quote has no sent version' using errcode = 'P0002';
    end if;
    if v.version is distinct from d.quote_version then
      raise exception 'the quote changed since this draft was started' using errcode = 'P0002';
    end if;
  end if;

  if (p_snapshot ->> 'issueDate')::date is distinct from p_issue_date
     or (p_snapshot #>> '{invoice,dueDate}')::date is distinct from p_due_date then
    raise exception 'the dates on the document are not the invoice dates' using errcode = '22023';
  end if;

  cust := p_snapshot -> 'customer';
  if cust is null or jsonb_typeof(cust) <> 'object' or nullif(btrim(cust ->> 'name'), '') is null then
    raise exception 'the invoice has no customer' using errcode = '22023';
  end if;
  if jsonb_typeof(p_snapshot -> 'lines') <> 'array' or jsonb_array_length(p_snapshot -> 'lines') = 0 then
    raise exception 'the invoice has no items' using errcode = '22023';
  end if;

  select bp.currency_code into currency from public.business_profiles bp where bp.organisation_id = p_org;
  if currency is null or p_snapshot ->> 'currencyCode' is distinct from currency then
    raise exception 'the invoice is not in the business''s currency' using errcode = '22023';
  end if;

  if (p_snapshot -> 'totals' ->> 'netCents')::bigint + (p_snapshot -> 'totals' ->> 'vatCents')::bigint
     is distinct from (p_snapshot -> 'totals' ->> 'grossCents')::bigint
     or (p_snapshot -> 'totals' ->> 'netCents')::bigint < 0
     or (p_snapshot -> 'totals' ->> 'vatCents')::bigint < 0 then
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
    currency_code, net_cents, vat_cents, gross_cents, snapshot, costing, note, adjusted, issued_by
  ) values (
    p_org, num, d.quote_id, case when d.quote_id is null then null else v.version end, d.customer_id,
    left(btrim(cust ->> 'name'), 200), p_issue_date, p_due_date, currency,
    (snap -> 'totals' ->> 'netCents')::bigint, (snap -> 'totals' ->> 'vatCents')::bigint,
    (snap -> 'totals' ->> 'grossCents')::bigint,
    snap, null, nullif(btrim(p_note), ''), d.quote_id is not null and coalesce(p_adjusted, true), p_actor
  ) returning id into iid;

  insert into public.invoice_events (organisation_id, invoice_id, kind, actor_id)
  values (p_org, iid, 'issued', p_actor);

  delete from public.invoice_drafts where id = d.id;

  return jsonb_build_object('id', iid, 'number', num);
end;
$$;

revoke execute on function public.issue_invoice_from_draft(uuid, uuid, uuid, uuid, boolean, timestamptz, date, date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.issue_invoice_from_draft(uuid, uuid, uuid, uuid, boolean, timestamptz, date, date, text, jsonb, text) to service_role;
