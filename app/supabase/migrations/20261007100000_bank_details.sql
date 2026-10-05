-- Structured bank details: one set per business, owners only can change them, reused on quotes
-- (and, later, invoices); and a per-quote switch to leave them off a quote.
--
-- * public.business_bank_details: one row per business. `details` holds the fields the country's
--   locale pack asks for (South Africa: account holder, bank, account type, account number, branch
--   code), as short text values; the app checks them against the pack, the database only keeps
--   them small. Every member can read them (documents show them); ONLY OWNERS can write them,
--   because changing where customers send money is how invoice fraud happens. No delete.
-- * quotes.show_bank_details: on by default; a quote can leave them off. What a sent quote showed is
--   frozen in its snapshot, so changing the details never changes a sent quote.
--
-- SECURITY-SENSITIVE: a new table with an owners-only write policy, a new column on a table with
-- column grants, and a replaced function that signed-in users can call (save_quote_draft, still
-- security invoker).

create table public.business_bank_details (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- {"holder": "...", "bank": "...", ...}: short text values. The app checks them field by field
  -- against the locale pack; the database keeps it an object of modest size.
  details jsonb not null
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2000),
  -- Ask customers to use the document number (quote or invoice number) as their payment reference.
  use_reference boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One account for now. Dropping this constraint is how more accounts come later.
  constraint business_bank_details_one_per_business unique (organisation_id)
);

create trigger business_bank_details_set_updated_at
  before update on public.business_bank_details
  for each row execute function public.set_updated_at();

-- No delete, and the business can never be changed after creation.
revoke all on public.business_bank_details from anon, authenticated;
grant select on public.business_bank_details to authenticated;
grant insert (organisation_id, country_code, details, use_reference)
  on public.business_bank_details to authenticated;
grant update (country_code, details, use_reference)
  on public.business_bank_details to authenticated;

alter table public.business_bank_details enable row level security;

create policy business_bank_details_select_members
  on public.business_bank_details for select to authenticated
  using (public.is_org_member(organisation_id));

create policy business_bank_details_insert_owners
  on public.business_bank_details for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner']));

create policy business_bank_details_update_owners
  on public.business_bank_details for update to authenticated
  using (public.has_org_role(organisation_id, array['owner']))
  with check (public.has_org_role(organisation_id, array['owner']));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.business_bank_details
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- The per-quote switch
-- ---------------------------------------------------------------------------

alter table public.quotes add column show_bank_details boolean not null default true;

grant insert (show_bank_details) on public.quotes to authenticated;
grant update (show_bank_details) on public.quotes to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying p_quote -> 'show_bank_details' (missing means true).
-- ---------------------------------------------------------------------------

create or replace function public.save_quote_draft(
  p_org uuid,
  p_quote_id uuid,
  p_quote jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  qid uuid;
begin
  if p_lines is not null and jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) > 100 then
    raise exception 'a quote can have at most 100 lines' using errcode = '54000';
  end if;

  if p_quote_id is null then
    insert into public.quotes (
      organisation_id, customer_id, issue_date, valid_until, needed_by,
      quote_discount_kind, quote_discount_value, notes, country_code, currency_code,
      net_cents, vat_cents, gross_cents,
      title, description, sign_off, terms, payment_instructions, policies, show_bank_details
    ) values (
      p_org,
      nullif(p_quote ->> 'customer_id', '')::uuid,
      (p_quote ->> 'issue_date')::date,
      (p_quote ->> 'valid_until')::date,
      nullif(p_quote ->> 'needed_by', '')::date,
      coalesce(p_quote ->> 'quote_discount_kind', 'none'),
      coalesce((p_quote ->> 'quote_discount_value')::bigint, 0),
      nullif(p_quote ->> 'notes', ''),
      p_quote ->> 'country_code',
      p_quote ->> 'currency_code',
      coalesce((p_quote ->> 'net_cents')::bigint, 0),
      coalesce((p_quote ->> 'vat_cents')::bigint, 0),
      coalesce((p_quote ->> 'gross_cents')::bigint, 0),
      nullif(p_quote ->> 'title', ''),
      nullif(p_quote ->> 'description', ''),
      nullif(p_quote ->> 'sign_off', ''),
      nullif(p_quote ->> 'terms', ''),
      nullif(p_quote ->> 'payment_instructions', ''),
      coalesce(p_quote -> 'policies', '[]'::jsonb),
      coalesce((p_quote ->> 'show_bank_details')::boolean, true)
    )
    returning id into qid;
  else
    update public.quotes set
      customer_id = nullif(p_quote ->> 'customer_id', '')::uuid,
      issue_date = (p_quote ->> 'issue_date')::date,
      valid_until = (p_quote ->> 'valid_until')::date,
      needed_by = nullif(p_quote ->> 'needed_by', '')::date,
      quote_discount_kind = coalesce(p_quote ->> 'quote_discount_kind', 'none'),
      quote_discount_value = coalesce((p_quote ->> 'quote_discount_value')::bigint, 0),
      notes = nullif(p_quote ->> 'notes', ''),
      net_cents = coalesce((p_quote ->> 'net_cents')::bigint, 0),
      vat_cents = coalesce((p_quote ->> 'vat_cents')::bigint, 0),
      gross_cents = coalesce((p_quote ->> 'gross_cents')::bigint, 0),
      title = nullif(p_quote ->> 'title', ''),
      description = nullif(p_quote ->> 'description', ''),
      sign_off = nullif(p_quote ->> 'sign_off', ''),
      terms = nullif(p_quote ->> 'terms', ''),
      payment_instructions = nullif(p_quote ->> 'payment_instructions', ''),
      policies = coalesce(p_quote -> 'policies', '[]'::jsonb),
      show_bank_details = coalesce((p_quote ->> 'show_bank_details')::boolean, true)
     where id = p_quote_id and organisation_id = p_org and status = 'draft'
    returning id into qid;

    if qid is null then
      raise exception 'draft quote not found' using errcode = 'P0002';
    end if;

    delete from public.quote_lines where quote_id = qid and organisation_id = p_org;
  end if;

  insert into public.quote_lines (
    organisation_id, quote_id, sort_order, kind, product_id, name, description,
    quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status, unit
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, '')
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;
