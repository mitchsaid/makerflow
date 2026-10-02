-- Quotes (drafts) and their lines.
--
-- A quote belongs to one organisation and, optionally while it is a draft, one customer of
-- that SAME organisation (composite foreign key, so a customer of another business can never
-- be attached). Lines live in quote_lines. Delivery and collection are ordinary lines with
-- their own kind, at most one per quote.
--
-- This migration only lets DRAFTS be created, edited or deleted: the insert, update and delete
-- policies all require status = 'draft' (reading is open to members whatever the status). Sending
-- (numbering, snapshots, immutability) arrives with the issuing slice as separate, checked
-- functions that move a quote out of draft; from then on members cannot edit or delete it
-- through the API at all.
--
-- Totals (net, VAT, gross) are stored so lists can show them without loading lines. The app
-- computes them on the server with the shared money module whenever a draft is saved. They
-- are a convenience for drafts: a person calling the database API directly could store other
-- numbers on their own draft, which is why issuing recomputes everything from the lines.
--
-- Saving goes through save_quote_draft(), one transaction, so a failure never leaves a quote
-- without its lines. It is SECURITY INVOKER: every statement runs under the caller's
-- row-level security, including the session_required policy.
--
-- SECURITY-SENSITIVE: new tables with row-level security and column grants, and a function
-- callable by signed-in users.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  -- Optional while drafting; the app asks for it before the quote can be sent.
  customer_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'withdrawn')),
  issue_date date not null,
  valid_until date not null,
  needed_by date,
  quote_discount_kind text not null default 'none'
    check (quote_discount_kind in ('none', 'percent', 'fixed')),
  -- Basis points for a percentage, cents for a fixed amount, 0 for none.
  quote_discount_value bigint not null default 0 check (quote_discount_value >= 0),
  notes text check (notes is null or char_length(notes) between 1 and 2000),
  -- The business's country and currency when the draft was started.
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  -- Last computed totals, in cents (see the note above).
  net_cents bigint not null default 0 check (net_cents between 0 and 99999999999),
  vat_cents bigint not null default 0 check (vat_cents between 0 and 99999999999),
  gross_cents bigint not null default 0 check (gross_cents between 0 and 99999999999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_org_id_unique unique (organisation_id, id),
  constraint quotes_customer_same_org
    foreign key (organisation_id, customer_id) references public.customers (organisation_id, id),
  constraint quotes_valid_until_after_issue check (valid_until >= issue_date),
  constraint quotes_discount_consistent check (
    (quote_discount_kind = 'none' and quote_discount_value = 0)
    or (quote_discount_kind = 'percent' and quote_discount_value between 1 and 10000)
    or (quote_discount_kind = 'fixed' and quote_discount_value >= 1)
  )
);

create index quotes_org_updated_idx on public.quotes (organisation_id, updated_at desc);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  quote_id uuid not null,
  sort_order integer not null check (sort_order >= 0),
  kind text not null default 'custom'
    check (kind in ('product', 'service', 'custom', 'delivery', 'collection')),
  name text not null check (char_length(name) between 1 and 200),
  description text check (description is null or char_length(description) between 1 and 1000),
  -- Thousandths of a unit (1 unit = 1000), always more than zero.
  quantity_milli bigint not null check (quantity_milli between 1 and 9999999999),
  unit_price_cents bigint not null check (unit_price_cents between 0 and 99999999999),
  discount_kind text not null default 'none' check (discount_kind in ('none', 'percent', 'fixed')),
  discount_value bigint not null default 0 check (discount_value >= 0),
  vat_status text not null default 'standard' check (vat_status in ('standard', 'zero', 'exempt')),
  created_at timestamptz not null default now(),
  constraint quote_lines_quote_same_org
    foreign key (organisation_id, quote_id) references public.quotes (organisation_id, id)
    on delete cascade,
  constraint quote_lines_order_unique unique (quote_id, sort_order),
  constraint quote_lines_discount_consistent check (
    (discount_kind = 'none' and discount_value = 0)
    or (discount_kind = 'percent' and discount_value between 1 and 10000)
    or (discount_kind = 'fixed' and discount_value >= 1)
  )
);

-- Delivery or collection: at most one such line per quote.
create unique index quote_lines_one_fulfilment
  on public.quote_lines (quote_id) where kind in ('delivery', 'collection');

-- ---------------------------------------------------------------------------
-- Grants and row-level security
-- ---------------------------------------------------------------------------

revoke all on public.quotes, public.quote_lines from anon, authenticated;

-- status, id and the timestamps are never written by users; country and currency are set
-- when a draft is created and never change.
grant select, delete on public.quotes to authenticated;
grant insert (
  organisation_id, customer_id, issue_date, valid_until, needed_by,
  quote_discount_kind, quote_discount_value, notes, country_code, currency_code,
  net_cents, vat_cents, gross_cents
) on public.quotes to authenticated;
grant update (
  customer_id, issue_date, valid_until, needed_by,
  quote_discount_kind, quote_discount_value, notes,
  net_cents, vat_cents, gross_cents
) on public.quotes to authenticated;

-- Lines are replaced as a whole when a draft is saved, so there is no update grant.
grant select, delete on public.quote_lines to authenticated;
grant insert (
  organisation_id, quote_id, sort_order, kind, name, description,
  quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status
) on public.quote_lines to authenticated;

alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;

create policy quotes_select_members
  on public.quotes for select to authenticated
  using (public.is_org_member(organisation_id));

create policy quotes_insert_draft_members
  on public.quotes for insert to authenticated
  with check (public.is_org_member(organisation_id) and status = 'draft');

create policy quotes_update_draft_members
  on public.quotes for update to authenticated
  using (public.is_org_member(organisation_id) and status = 'draft')
  with check (public.is_org_member(organisation_id) and status = 'draft');

create policy quotes_delete_draft_members
  on public.quotes for delete to authenticated
  using (public.is_org_member(organisation_id) and status = 'draft');

create policy quote_lines_select_members
  on public.quote_lines for select to authenticated
  using (public.is_org_member(organisation_id));

-- Lines can only be added to, or removed from, a DRAFT quote of the same business.
create policy quote_lines_insert_draft_members
  on public.quote_lines for insert to authenticated
  with check (
    public.is_org_member(organisation_id)
    and exists (
      select 1 from public.quotes q
       where q.id = quote_id and q.organisation_id = quote_lines.organisation_id and q.status = 'draft'
    )
  );

create policy quote_lines_delete_draft_members
  on public.quote_lines for delete to authenticated
  using (
    public.is_org_member(organisation_id)
    and exists (
      select 1 from public.quotes q
       where q.id = quote_id and q.organisation_id = quote_lines.organisation_id and q.status = 'draft'
    )
  );

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.quotes
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.quote_lines
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- save_quote_draft: create or update a draft and replace its lines, atomically.
--
-- p_quote keys: customer_id, issue_date, valid_until, needed_by, quote_discount_kind,
--   quote_discount_value, notes, country_code and currency_code (used on create only),
--   net_cents, vat_cents, gross_cents.
-- p_lines: an array of objects with sort_order, kind, name, description, quantity_milli,
--   unit_price_cents, discount_kind, discount_value, vat_status.
-- Returns the quote id. Raises P0002 when the draft does not exist (or is no longer a draft)
-- and 54000 when there are more than 100 lines. Everything else is checked by the table
-- constraints and policies, which run as the caller.
-- ---------------------------------------------------------------------------

create function public.save_quote_draft(
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
      net_cents, vat_cents, gross_cents
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
      coalesce((p_quote ->> 'gross_cents')::bigint, 0)
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
      gross_cents = coalesce((p_quote ->> 'gross_cents')::bigint, 0)
     where id = p_quote_id and organisation_id = p_org and status = 'draft'
    returning id into qid;

    if qid is null then
      raise exception 'draft quote not found' using errcode = 'P0002';
    end if;

    delete from public.quote_lines where quote_id = qid and organisation_id = p_org;
  end if;

  insert into public.quote_lines (
    organisation_id, quote_id, sort_order, kind, name, description,
    quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status
  )
  select
    p_org, qid, l.sort_order, l.kind, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard')
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;
