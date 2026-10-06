-- Quote deposits: "Deposit to start work", and when the balance is due.
--
-- MONEY AND SECURITY-SENSITIVE (new columns on quotes and the business profile, a replaced
-- function). Needs human review before it is applied to any hosted project.
--
-- * quotes.deposit_kind ('none', 'percent' or 'fixed') with deposit_value (basis points, or cents).
--   The amounts are worked out by the app with the tested calculateDeposit and frozen in the snapshot
--   when a quote is sent; the database only keeps the terms and limits them to sensible values.
-- * quotes.balance_due: 'handover' (on collection or delivery) or 'date' (by balance_due_date).
-- * business_profiles.default_deposit_kind / default_deposit_value: what a new quote starts with
--   (owners and admins change them, through the existing profile policy and a new column grant).
-- * save_quote_draft carries the new quote columns. A payload without them (an older app) means
--   no deposit, balance on handover.
-- No new table; existing row-level security and session_required cover the new columns.

alter table public.quotes
  add column deposit_kind text not null default 'none'
    check (deposit_kind in ('none', 'percent', 'fixed')),
  add column deposit_value bigint not null default 0
    check (deposit_value >= 0),
  add column balance_due text not null default 'handover'
    check (balance_due in ('handover', 'date')),
  add column balance_due_date date,
  add constraint quotes_deposit_percent_limit
    check (deposit_kind <> 'percent' or deposit_value <= 10000),
  add constraint quotes_deposit_none_is_zero
    check (deposit_kind <> 'none' or deposit_value = 0),
  add constraint quotes_balance_date_matches
    check ((balance_due = 'date') = (balance_due_date is not null));

grant insert (deposit_kind, deposit_value, balance_due, balance_due_date) on public.quotes to authenticated;
grant update (deposit_kind, deposit_value, balance_due, balance_due_date) on public.quotes to authenticated;

alter table public.business_profiles
  add column default_deposit_kind text not null default 'none'
    check (default_deposit_kind in ('none', 'percent', 'fixed')),
  add column default_deposit_value bigint not null default 0
    check (default_deposit_value >= 0),
  add constraint business_profiles_deposit_percent_limit
    check (default_deposit_kind <> 'percent' or default_deposit_value <= 10000),
  add constraint business_profiles_deposit_none_is_zero
    check (default_deposit_kind <> 'none' or default_deposit_value = 0);

grant update (default_deposit_kind, default_deposit_value) on public.business_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying the deposit terms and the balance term.
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
      title, description, sign_off, terms, payment_instructions, policies, show_bank_details,
      deposit_kind, deposit_value, balance_due, balance_due_date
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
      coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      coalesce(p_quote ->> 'deposit_kind', 'none'),
      coalesce((p_quote ->> 'deposit_value')::bigint, 0),
      coalesce(p_quote ->> 'balance_due', 'handover'),
      nullif(p_quote ->> 'balance_due_date', '')::date
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
      show_bank_details = coalesce((p_quote ->> 'show_bank_details')::boolean, true),
      deposit_kind = coalesce(p_quote ->> 'deposit_kind', 'none'),
      deposit_value = coalesce((p_quote ->> 'deposit_value')::bigint, 0),
      balance_due = coalesce(p_quote ->> 'balance_due', 'handover'),
      balance_due_date = nullif(p_quote ->> 'balance_due_date', '')::date
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
