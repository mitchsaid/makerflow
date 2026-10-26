-- Ways to pay (docs/plans/payment-methods.md; founder, 2026-10-26: "How to pay needs some restructuring ... multiple
-- options, eg. paying by scanning a QR code or other methods").
--
-- SECURITY-SENSITIVE: where customers send money is how invoice fraud happens, so this is a new table with
-- row-level security that only OWNERS may change (as business_bank_details), a function that writes quotes, and new
-- columns. Needs human review before it is applied to any hosted project.
--
-- * public.payment_methods: the ways a business is paid other than its one bank account (which stays in
--   business_bank_details, untouched, so every sent document and statement keeps working). Each way has a kind (the
--   country's locale pack lists the kinds and their fields; the database only keeps it a short slug), a name, its
--   details (a small object of short text values), and whether new quotes show it. Members read; owners add, change
--   and remove. At most 20 a business. A way that is removed or changed never changes a document that was sent: those
--   hold their own copy in the snapshot.
-- * quotes.hidden_payment_methods: the ways the maker unticked on this quote (hidden rather than shown, so a way added
--   later appears on new quotes without touching old drafts). save_quote_draft carries it; a payload without the key
--   keeps the draft's. An invoice draft keeps it in its form, as it does the rest of the quote's values.

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z][a-z-]{0,29}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 2000),
  on_new_quotes boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_methods_org_id_unique unique (organisation_id, id)
);

create index payment_methods_org_idx on public.payment_methods (organisation_id, sort_order, created_at);

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- A business's list of ways to pay is short. The limit stops one account filling the database.
create function public.payment_methods_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.payment_methods where organisation_id = new.organisation_id) >= 20 then
    raise exception 'this business has reached its limit of ways to pay' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.payment_methods_limit() from public, anon, authenticated;

create trigger payment_methods_limit
  before insert on public.payment_methods
  for each row execute function public.payment_methods_limit();

-- Members read; only owners write; the business of a way can never be changed.
revoke all on public.payment_methods from anon, authenticated;
grant select on public.payment_methods to authenticated;
grant insert (organisation_id, kind, name, details, on_new_quotes, sort_order) on public.payment_methods to authenticated;
grant update (kind, name, details, on_new_quotes, sort_order) on public.payment_methods to authenticated;
grant delete on public.payment_methods to authenticated;

alter table public.payment_methods enable row level security;

create policy payment_methods_select_members
  on public.payment_methods for select to authenticated
  using (public.is_org_member(organisation_id));

create policy payment_methods_insert_owners
  on public.payment_methods for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner']));

create policy payment_methods_update_owners
  on public.payment_methods for update to authenticated
  using (public.has_org_role(organisation_id, array['owner']))
  with check (public.has_org_role(organisation_id, array['owner']));

create policy payment_methods_delete_owners
  on public.payment_methods for delete to authenticated
  using (public.has_org_role(organisation_id, array['owner']));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.payment_methods
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

alter table public.quotes
  add column hidden_payment_methods uuid[] not null default '{}'
    check (cardinality(hidden_payment_methods) <= 20);
grant insert (hidden_payment_methods) on public.quotes to authenticated;
grant update (hidden_payment_methods) on public.quotes to authenticated;

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
      title, description, sign_off, payment_instructions, policies, show_bank_details,
      deposit_kind, deposit_value, balance_due, balance_due_date, balance_due_text, delivery_address, show_photos, show_quantity_prices,
      sign_off_as, sign_off_other, hidden_payment_methods
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
      nullif(p_quote ->> 'payment_instructions', ''),
      coalesce(p_quote -> 'policies', '[]'::jsonb),
      coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      coalesce(p_quote ->> 'deposit_kind', 'none'),
      coalesce((p_quote ->> 'deposit_value')::bigint, 0),
      coalesce(p_quote ->> 'balance_due', 'handover'),
      nullif(p_quote ->> 'balance_due_date', '')::date,
      nullif(btrim(p_quote ->> 'balance_due_text'), ''),
      nullif(btrim(p_quote ->> 'delivery_address'), ''),
      coalesce((p_quote ->> 'show_photos')::boolean, true),
      coalesce((p_quote ->> 'show_quantity_prices')::boolean, false),
      coalesce(p_quote ->> 'sign_off_as', 'business'),
      nullif(btrim(p_quote ->> 'sign_off_other'), ''),
      coalesce(array(select jsonb_array_elements_text(p_quote -> 'hidden_payment_methods'))::uuid[], '{}')
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
      payment_instructions = nullif(p_quote ->> 'payment_instructions', ''),
      policies = coalesce(p_quote -> 'policies', '[]'::jsonb),
      show_bank_details = coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      -- A payload without the deposit keys (an older app still open on a phone) keeps what the draft has.
      deposit_kind = coalesce(p_quote ->> 'deposit_kind', deposit_kind),
      deposit_value = coalesce((p_quote ->> 'deposit_value')::bigint, deposit_value),
      balance_due = coalesce(p_quote ->> 'balance_due', balance_due),
      balance_due_date = case when p_quote ? 'balance_due' then nullif(p_quote ->> 'balance_due_date', '')::date else balance_due_date end,
      -- The balance's own words go with the balance: sent together, or kept together.
      balance_due_text = case when p_quote ? 'balance_due' then nullif(btrim(p_quote ->> 'balance_due_text'), '') else balance_due_text end,
      -- Same for the delivery address: a payload without the key keeps what the draft has.
      delivery_address = case when p_quote ? 'delivery_address' then nullif(btrim(p_quote ->> 'delivery_address'), '') else delivery_address end,
      -- And the photos switch: a payload without it keeps the draft's.
      show_photos = coalesce((p_quote ->> 'show_photos')::boolean, show_photos),
      -- Same for the quantity price switch.
      show_quantity_prices = coalesce((p_quote ->> 'show_quantity_prices')::boolean, show_quantity_prices),
      -- Who signs: a payload without it (an older app still open) keeps the draft's.
      sign_off_as = coalesce(p_quote ->> 'sign_off_as', sign_off_as),
      -- The other name goes with the choice: sent together, or kept together.
      sign_off_other = case when p_quote ? 'sign_off_as' then nullif(btrim(p_quote ->> 'sign_off_other'), '') else sign_off_other end,
      -- The ways to pay left off this quote: a payload without the key (an older app still open) keeps the draft's.
      hidden_payment_methods = case when p_quote ? 'hidden_payment_methods'
        then coalesce(array(select jsonb_array_elements_text(p_quote -> 'hidden_payment_methods'))::uuid[], '{}')
        else hidden_payment_methods end
     where id = p_quote_id and organisation_id = p_org and status = 'draft'
    returning id into qid;

    if qid is null then
      raise exception 'draft quote not found' using errcode = 'P0002';
    end if;

    delete from public.quote_lines where quote_id = qid and organisation_id = p_org;
  end if;

  insert into public.quote_lines (
    organisation_id, quote_id, sort_order, kind, product_id, name, description,
    quantity_milli, unit_price_cents, discount_kind, discount_value, vat_status, unit,
    variation_id, variation_label, variation_name, options, list_price_cents, quantity_price_text, unit_cost_cents
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, ''),
    l.variation_id, nullif(l.variation_label, ''), nullif(l.variation_name, ''),
    coalesce(l.options, '[]'::jsonb),
    -- The quantity price that set the price each: the price before it, and its words (both, or neither).
    case when nullif(btrim(l.quantity_price_text), '') is not null then l.list_price_cents end,
    case when l.list_price_cents is not null then nullif(btrim(l.quantity_price_text), '') end,
    -- What a one-off item costs the maker each (nothing for an item from a product: its cost comes from the product).
    case when l.product_id is null and l.kind = 'custom' then l.unit_cost_cents end
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text,
    variation_id uuid, variation_label text, variation_name text, options jsonb,
    list_price_cents bigint, quantity_price_text text, unit_cost_cents bigint
  );

  return qid;
end;
$$;
