-- Costing, slice B1 (docs/plans/costing-and-margin.md): the costing is frozen with a sent quote, and a one-off item can
-- say what it costs.
--
-- SECURITY-SENSITIVE: a new column on a table with row-level security (quote_versions), a replaced SERVER-ONLY
-- SECURITY DEFINER function (send_quote gains one parameter), a new column with a column grant on quote_lines and a
-- replaced SECURITY INVOKER save_quote_draft (same signature). Money. Needs human review before it is applied to any
-- hosted project. Nothing is dropped except the old signature of send_quote.
--
-- * quote_versions.costing: what the quote cost to make when it was sent (the maker's private figures). It is NOT part
--   of the snapshot: the snapshot is what the customer's document is drawn from, and one day a page the customer can
--   open. The costing is read only by signed-in members of the business. A frozen version never changes (the existing
--   immutability trigger covers it), so a later change to a material's price or the hourly rate never alters it.
-- * send_quote takes it as p_costing (null: nothing to record, as for a quote with no costed items).
-- * quote_lines.unit_cost_cents: what a one-off item costs the maker each. Only a one-off item keeps one.
-- ---------------------------------------------------------------------------

alter table public.quote_versions
  add column costing jsonb check (costing is null or jsonb_typeof(costing) = 'object');

alter table public.quote_lines
  add column unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents between 0 and 99999999999);
grant insert (unit_cost_cents) on public.quote_lines to authenticated;

drop function public.send_quote(uuid, uuid, uuid, text, timestamptz, jsonb, bigint, bigint, bigint);

create function public.send_quote(
  p_org uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_via text,
  p_expected_updated_at timestamptz,
  p_snapshot jsonb,
  p_net_cents bigint,
  p_vat_cents bigint,
  p_gross_cents bigint,
  p_costing jsonb default null
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
  if p_costing is not null and jsonb_typeof(p_costing) <> 'object' then
    raise exception 'the costing must be an object' using errcode = '23514';
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

  insert into public.quote_versions (organisation_id, quote_id, version, sent_via, sent_by, snapshot, costing)
  values (p_org, q.id, q.version, p_via, p_actor, p_snapshot, p_costing);

  insert into public.quote_events (organisation_id, quote_id, version, kind, via, actor_id)
  values (p_org, q.id, q.version, 'sent', p_via, p_actor);

  return jsonb_build_object('number', q.number, 'version', q.version);
end;
$$;

revoke execute on function public.send_quote(uuid, uuid, uuid, text, timestamptz, jsonb, bigint, bigint, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.send_quote(uuid, uuid, uuid, text, timestamptz, jsonb, bigint, bigint, bigint, jsonb)
  to service_role;

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
