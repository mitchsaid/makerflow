-- Product variations (slice 1 of docs/plans/product-choices.md).
--
-- A variation is a complete sellable version of a product with its own price ("Small R300",
-- "Large R600"); the maker names the list ("Size", "Tiers"). A quote item from such a product
-- records which one was chosen and keeps its OWN copy of the name and price, like every line.
--
-- SECURITY-SENSITIVE: a new table with row-level security, new columns and grants on products and
-- quote_lines, a new function (save_product) and a replaced save_quote_draft, both SECURITY
-- INVOKER (they run under the person's own row-level security). Needs human review before this
-- is applied to any hosted project.

-- ---------------------------------------------------------------------------
-- The maker's word for the list, on the product
-- ---------------------------------------------------------------------------

alter table public.products
  add column variation_label text check (variation_label is null or char_length(variation_label) between 1 and 40);

grant insert (variation_label), update (variation_label) on public.products to authenticated;

-- ---------------------------------------------------------------------------
-- product_variations
-- ---------------------------------------------------------------------------

create table public.product_variations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  -- In the business's VAT entry mode, like the product's price.
  price_cents bigint not null check (price_cents between 0 and 99999999999),
  -- Pre-selected when the product is added to a quote. At most one per product (index below).
  usual boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variations_org_id_unique unique (organisation_id, id),
  -- So a quote item can point at a variation OF ITS OWN product (below).
  constraint product_variations_org_product_id_unique unique (organisation_id, product_id, id),
  constraint product_variations_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade
);

create index product_variations_product_idx on public.product_variations (organisation_id, product_id, sort_order);
create unique index product_variations_one_usual on public.product_variations (product_id) where usual;

create trigger product_variations_set_updated_at
  before update on public.product_variations
  for each row execute function public.set_updated_at();

-- A product can have at most 50 variations (more is a sign it should be several products).
create function public.product_variations_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_variations:' || new.product_id::text, 0));
  if (select count(*) from public.product_variations where product_id = new.product_id) >= 50 then
    raise exception 'a product can have at most 50 variations' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_variations_limit() from public, anon, authenticated;

create trigger product_variations_limit
  before insert on public.product_variations
  for each row execute function public.product_variations_limit();

-- Members manage them, like products. They can be removed: quote items keep their own copies.
revoke all on public.product_variations from anon, authenticated;
grant select, delete on public.product_variations to authenticated;
grant insert (organisation_id, product_id, name, price_cents, usual, sort_order)
  on public.product_variations to authenticated;
grant update (name, price_cents, usual, sort_order) on public.product_variations to authenticated;

alter table public.product_variations enable row level security;

create policy product_variations_select_members
  on public.product_variations for select to authenticated
  using (public.is_org_member(organisation_id));

create policy product_variations_insert_members
  on public.product_variations for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy product_variations_update_members
  on public.product_variations for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy product_variations_delete_members
  on public.product_variations for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.product_variations
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- Quote items record the variation chosen, and keep their own copy of its words
-- ---------------------------------------------------------------------------

alter table public.quote_lines
  add column variation_id uuid,
  add column variation_label text check (variation_label is null or char_length(variation_label) between 1 and 40),
  add column variation_name text check (variation_name is null or char_length(variation_name) between 1 and 80);

-- Same business AND the item's own product; a removed variation leaves the item's copy of its words
-- (only the link is cleared).
alter table public.quote_lines
  add constraint quote_lines_variation_same_product
  foreign key (organisation_id, product_id, variation_id)
  references public.product_variations (organisation_id, product_id, id)
  on delete set null (variation_id);

alter table public.quote_lines
  add constraint quote_lines_variation_shape check (
    (variation_label is null) = (variation_name is null)
    and (variation_id is null or (variation_name is not null and product_id is not null))
  );

grant insert (variation_id, variation_label, variation_name) on public.quote_lines to authenticated;

create index quote_lines_org_variation_idx
  on public.quote_lines (organisation_id, variation_id) where variation_id is not null;

-- ---------------------------------------------------------------------------
-- save_product: a product and its variations in one transaction. SECURITY INVOKER.
--
-- p_product_id null adds a product; otherwise it changes that product of this business.
-- p_product: kind, name, description, unit_price_cents, unit, variation_label, and optionally
--   photo_image_id and vat_status (a payload without the key leaves the stored value as it is).
-- p_variations: null leaves the variations and their list name as they are; otherwise a list of { id (to keep an existing one; absent for a new one), name,
--   price_cents, usual }. Existing variations not in the list are removed. With variations, the
--   product's own price becomes the lowest of theirs (its "from" price) and the list needs a name.
-- Errors: P0002 product not found; 22023 bad input; 54000 too many variations; check and key
-- violations as raised.
-- ---------------------------------------------------------------------------

create function public.save_product(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid;
  n integer;
  label text := nullif(btrim(p_product ->> 'variation_label'), '');
begin
  -- No list at all (a form that does not know about variations): they are left as they are.
  if p_variations is not null and jsonb_typeof(p_variations) <> 'array' then
    raise exception 'variations must be a list' using errcode = '22023';
  end if;
  n := coalesce(jsonb_array_length(p_variations), 0);
  if n > 50 then
    raise exception 'a product can have at most 50 variations' using errcode = '54000';
  end if;
  if n > 0 and label is null then
    raise exception 'a list of variations needs a name' using errcode = '22023';
  end if;
  if n = 0 and p_variations is not null then
    label := null;
  end if;

  if p_product_id is null then
    insert into public.products (organisation_id, kind, name, description, unit_price_cents, unit, variation_label)
    values (
      p_org,
      coalesce(p_product ->> 'kind', 'product'),
      p_product ->> 'name',
      nullif(p_product ->> 'description', ''),
      (p_product ->> 'unit_price_cents')::bigint,
      nullif(p_product ->> 'unit', ''),
      label
    )
    returning id into pid;
  else
    update public.products set
      kind = coalesce(p_product ->> 'kind', kind),
      name = p_product ->> 'name',
      description = nullif(p_product ->> 'description', ''),
      unit_price_cents = (p_product ->> 'unit_price_cents')::bigint,
      unit = nullif(p_product ->> 'unit', ''),
      variation_label = case when p_variations is null then variation_label else label end
     where id = p_product_id and organisation_id = p_org
    returning id into pid;
    if pid is null then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  end if;

  -- Optional keys: only when the form carried them.
  if p_product ? 'photo_image_id' then
    update public.products set photo_image_id = nullif(p_product ->> 'photo_image_id', '')::uuid where id = pid;
  end if;
  if p_product ? 'vat_status' then
    update public.products set vat_status = p_product ->> 'vat_status' where id = pid;
  end if;

  if p_variations is null then
    -- Still a product with variations: its price stays their lowest.
    update public.products
       set unit_price_cents = (select min(price_cents) from public.product_variations where product_id = pid)
     where id = pid and exists (select 1 from public.product_variations where product_id = pid);
    return pid;
  end if;

  -- Variations: keep the ones still listed (by id), add new ones, remove the rest.
  update public.product_variations set usual = false where product_id = pid and organisation_id = p_org and usual;

  delete from public.product_variations v
   where v.product_id = pid and v.organisation_id = p_org
     and not exists (
       select 1 from jsonb_array_elements(p_variations) e where e ->> 'id' = v.id::text
     );

  update public.product_variations v set
    name = e.name, price_cents = e.price_cents, usual = coalesce(e.usual, false), sort_order = e.ord - 1
  from rows from (jsonb_to_recordset(p_variations) as (id uuid, name text, price_cents bigint, usual boolean)) with ordinality as e(id, name, price_cents, usual, ord)
   where v.id = e.id and v.product_id = pid and v.organisation_id = p_org;

  insert into public.product_variations (organisation_id, product_id, name, price_cents, usual, sort_order)
  select p_org, pid, e.name, e.price_cents, coalesce(e.usual, false), e.ord - 1
    from rows from (jsonb_to_recordset(p_variations) as (id uuid, name text, price_cents bigint, usual boolean)) with ordinality as e(id, name, price_cents, usual, ord)
   where e.id is null
      or not exists (select 1 from public.product_variations v where v.id = e.id and v.product_id = pid);

  -- The "from" price.
  if n > 0 then
    update public.products
       set unit_price_cents = (select min(price_cents) from public.product_variations where product_id = pid)
     where id = pid;
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_product(uuid, uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying the variation chosen on each item.
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
      deposit_kind, deposit_value, balance_due, balance_due_date, delivery_address, show_photos
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
      nullif(p_quote ->> 'balance_due_date', '')::date,
      nullif(btrim(p_quote ->> 'delivery_address'), ''),
      coalesce((p_quote ->> 'show_photos')::boolean, true)
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
      -- A payload without the deposit keys (an older app still open on a phone) keeps what the draft has.
      deposit_kind = coalesce(p_quote ->> 'deposit_kind', deposit_kind),
      deposit_value = coalesce((p_quote ->> 'deposit_value')::bigint, deposit_value),
      balance_due = coalesce(p_quote ->> 'balance_due', balance_due),
      balance_due_date = case when p_quote ? 'balance_due' then nullif(p_quote ->> 'balance_due_date', '')::date else balance_due_date end,
      -- Same for the delivery address: a payload without the key keeps what the draft has.
      delivery_address = case when p_quote ? 'delivery_address' then nullif(btrim(p_quote ->> 'delivery_address'), '') else delivery_address end,
      -- And the photos switch: a payload without it keeps the draft's.
      show_photos = coalesce((p_quote ->> 'show_photos')::boolean, show_photos)
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
    variation_id, variation_label, variation_name
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, ''),
    l.variation_id, nullif(l.variation_label, ''), nullif(l.variation_name, '')
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text,
    variation_id uuid, variation_label text, variation_name text
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;
