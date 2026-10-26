-- Sign with another name (docs/plans/quote-sign-off-name.md, founder 2026-10-26): a fourth choice, "other", with the
-- name typed (a studio name, "The Nkosi family"). On the business profile (the usual a new quote starts with) and on
-- each quote. An "other" choice always has its name. save_quote_draft carries the name with the choice; a payload
-- without the choice keeps both. The name printed is frozen in the sent snapshot, as for the other choices.
-- Needs human review (constraints, columns, grants, the function).

alter table public.business_profiles
  drop constraint business_profiles_sign_off_as_check,
  add constraint business_profiles_sign_off_as_check check (sign_off_as in ('business', 'owner', 'none', 'other')),
  add column sign_off_other text check (sign_off_other is null or char_length(btrim(sign_off_other)) between 1 and 120),
  add constraint business_profiles_sign_off_other_named check (sign_off_as <> 'other' or sign_off_other is not null);
grant update (sign_off_other) on public.business_profiles to authenticated;

alter table public.quotes
  drop constraint quotes_sign_off_as_check,
  add constraint quotes_sign_off_as_check check (sign_off_as in ('business', 'owner', 'none', 'other')),
  add column sign_off_other text check (sign_off_other is null or char_length(btrim(sign_off_other)) between 1 and 120),
  add constraint quotes_sign_off_other_named check (sign_off_as <> 'other' or sign_off_other is not null);
grant insert (sign_off_other) on public.quotes to authenticated;
grant update (sign_off_other) on public.quotes to authenticated;

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
      sign_off_as, sign_off_other
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
      nullif(btrim(p_quote ->> 'sign_off_other'), '')
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
      sign_off_other = case when p_quote ? 'sign_off_as' then nullif(btrim(p_quote ->> 'sign_off_other'), '') else sign_off_other end
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
