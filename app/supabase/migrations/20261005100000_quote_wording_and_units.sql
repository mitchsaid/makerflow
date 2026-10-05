-- Quote wording and units: an optional title, description, sign-off, terms and "how to pay" on
-- a quote, a unit on quote lines and products, and the business's defaults for the wording.
--
-- Everything is optional and stored as NULL when empty. The wording defaults live on the
-- business profile (owners and admins edit them through the existing update policy) and are
-- copied into a new draft by the app; nothing here changes how a quote is numbered, totalled
-- or frozen (the snapshot is JSON and simply carries the new fields).
--
-- SECURITY-SENSITIVE: new columns on tables with column grants, and a replaced function that
-- signed-in users can call (save_quote_draft, still security invoker).

alter table public.quotes
  add column title text check (title is null or char_length(title) between 1 and 120),
  add column description text check (description is null or char_length(description) between 1 and 2000),
  add column sign_off text check (sign_off is null or char_length(sign_off) between 1 and 200),
  add column terms text check (terms is null or char_length(terms) between 1 and 4000),
  add column payment_instructions text
    check (payment_instructions is null or char_length(payment_instructions) between 1 and 1000);

alter table public.quote_lines
  add column unit text check (unit is null or char_length(unit) between 1 and 20);

alter table public.products
  add column unit text check (unit is null or char_length(unit) between 1 and 20);

alter table public.business_profiles
  add column default_sign_off text check (default_sign_off is null or char_length(default_sign_off) between 1 and 200),
  add column default_terms text check (default_terms is null or char_length(default_terms) between 1 and 4000),
  add column payment_instructions text
    check (payment_instructions is null or char_length(payment_instructions) between 1 and 1000);

-- Column grants: the new columns are written by people, so they are added to the lists.
grant insert (title, description, sign_off, terms, payment_instructions) on public.quotes to authenticated;
grant update (title, description, sign_off, terms, payment_instructions) on public.quotes to authenticated;
grant insert (unit) on public.quote_lines to authenticated;
grant insert (unit) on public.products to authenticated;
grant update (unit) on public.products to authenticated;
grant update (default_sign_off, default_terms, payment_instructions) on public.business_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, with the new quote fields and the line unit.
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
      title, description, sign_off, terms, payment_instructions
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
      nullif(p_quote ->> 'payment_instructions', '')
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
      payment_instructions = nullif(p_quote ->> 'payment_instructions', '')
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
