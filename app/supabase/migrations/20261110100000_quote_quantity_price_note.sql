-- Quantity prices can be shown on the customer's quote, when the maker wants (docs/plans/quantity-prices-and-steps.md;
-- founder, 2026-10-17: "make this optional").
--
-- SECURITY-SENSITIVE: new columns with column grants on two tables that have row-level security, and a replaced
-- SECURITY INVOKER save_quote_draft (same signature). Needs human review before it is applied to any hosted project.
-- Nothing is dropped or rewritten.
--
-- * quotes.show_quantity_prices: the per-quote switch, off unless the maker turns it on. save_quote_draft carries it;
--   a payload without it keeps the draft's.
-- * quote_lines.list_price_cents and quote_lines.quantity_price_text: when an item's price each came from a quantity
--   price (and was not typed over), the price before it and the words ("10 or more: 10% off"). Both or neither.
--   The words are the maker's screen's own copy, frozen with the line like its other words. Whether a document shows
--   them is the quote's switch.
-- ---------------------------------------------------------------------------

alter table public.quotes add column show_quantity_prices boolean not null default false;
grant insert (show_quantity_prices) on public.quotes to authenticated;
grant update (show_quantity_prices) on public.quotes to authenticated;

alter table public.quote_lines
  add column list_price_cents bigint check (list_price_cents is null or list_price_cents between 0 and 99999999999),
  add column quantity_price_text text check (quantity_price_text is null or char_length(quantity_price_text) between 1 and 200),
  add constraint quote_lines_quantity_price_shape check ((list_price_cents is null) = (quantity_price_text is null));
grant insert (list_price_cents, quantity_price_text) on public.quote_lines to authenticated;

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
      deposit_kind, deposit_value, balance_due, balance_due_date, balance_due_text, delivery_address, show_photos, show_quantity_prices
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
      coalesce((p_quote ->> 'show_quantity_prices')::boolean, false)
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
      show_quantity_prices = coalesce((p_quote ->> 'show_quantity_prices')::boolean, show_quantity_prices)
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
    variation_id, variation_label, variation_name, options, list_price_cents, quantity_price_text
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
    case when l.list_price_cents is not null then nullif(btrim(l.quantity_price_text), '') end
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text,
    variation_id uuid, variation_label text, variation_name text, options jsonb,
    list_price_cents bigint, quantity_price_text text
  );

  return qid;
end;
$$;
