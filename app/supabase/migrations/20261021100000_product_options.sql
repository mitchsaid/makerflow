-- Product options and extras (slice 2 of docs/plans/product-choices.md).
--
-- An option specifies or adds to the chosen product: "choose one" (Flavour), "choose any" (Extras:
-- gold leaf, gift tag) or "type something" (Message on the cake). Each value adds an amount (often
-- R0), charged for each item or once for the item line. A quote item keeps its OWN copy of what was
-- chosen (names, typed text and amounts) in quote_lines.options, like everything else on a line.
--
-- SECURITY-SENSITIVE: two new tables with row-level security, a new column on quote_lines, a replaced
-- save_product and save_quote_draft (both SECURITY INVOKER). The way a line's amount is worked out
-- changes in the app (once-per-line extras): money, human review.

-- ---------------------------------------------------------------------------
-- product_option_groups: one option of a product
-- ---------------------------------------------------------------------------

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  -- one: choose one value; any: choose any number; text: type something.
  kind text not null check (kind in ('one', 'any', 'text')),
  -- Must something be chosen or typed? Never for "choose any".
  required boolean not null default false,
  -- item: the amount is added to each item's price; line: added once to the item line.
  charge text not null default 'item' check (charge in ('item', 'line')),
  -- For "type something": what it costs when something is typed, and how long it can be.
  text_price_cents bigint not null default 0 check (text_price_cents between 0 and 99999999999),
  text_max integer not null default 100 check (text_max between 1 and 500),
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_groups_org_id_unique unique (organisation_id, id),
  constraint product_option_groups_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade,
  constraint product_option_groups_any_not_required check (kind <> 'any' or not required),
  constraint product_option_groups_text_price_only check (kind = 'text' or text_price_cents = 0)
);

create index product_option_groups_product_idx on public.product_option_groups (organisation_id, product_id, sort_order);

create trigger product_option_groups_set_updated_at
  before update on public.product_option_groups
  for each row execute function public.set_updated_at();

create function public.product_option_groups_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_option_groups:' || new.product_id::text, 0));
  if (select count(*) from public.product_option_groups where product_id = new.product_id) >= 20 then
    raise exception 'a product can have at most 20 options' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_option_groups_limit() from public, anon, authenticated;

create trigger product_option_groups_limit
  before insert on public.product_option_groups
  for each row execute function public.product_option_groups_limit();

-- ---------------------------------------------------------------------------
-- product_option_values: the values of a "choose one" or "choose any" option
-- ---------------------------------------------------------------------------

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  group_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  -- Added to the price (in the business's VAT entry mode). Zero is common ("Vanilla").
  price_cents bigint not null default 0 check (price_cents between 0 and 99999999999),
  -- Chosen for you on a quote ("choose one" only; at most one per option).
  usual boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_values_org_id_unique unique (organisation_id, id),
  constraint product_option_values_group_same_org
    foreign key (organisation_id, group_id) references public.product_option_groups (organisation_id, id)
    on delete cascade
);

create index product_option_values_group_idx on public.product_option_values (organisation_id, group_id, sort_order);
create unique index product_option_values_one_usual on public.product_option_values (group_id) where usual;

create trigger product_option_values_set_updated_at
  before update on public.product_option_values
  for each row execute function public.set_updated_at();

create function public.product_option_values_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_option_values:' || new.group_id::text, 0));
  if (select count(*) from public.product_option_values where group_id = new.group_id) >= 50 then
    raise exception 'an option can have at most 50 values' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_option_values_limit() from public, anon, authenticated;

create trigger product_option_values_limit
  before insert on public.product_option_values
  for each row execute function public.product_option_values_limit();

-- ---------------------------------------------------------------------------
-- Grants and row-level security: members manage them, like products. They can be removed.
-- ---------------------------------------------------------------------------

revoke all on public.product_option_groups, public.product_option_values from anon, authenticated;
grant select, delete on public.product_option_groups, public.product_option_values to authenticated;
grant insert (organisation_id, product_id, name, kind, required, charge, text_price_cents, text_max, sort_order)
  on public.product_option_groups to authenticated;
grant update (name, kind, required, charge, text_price_cents, text_max, sort_order)
  on public.product_option_groups to authenticated;
grant insert (organisation_id, group_id, name, price_cents, usual, sort_order)
  on public.product_option_values to authenticated;
grant update (name, price_cents, usual, sort_order) on public.product_option_values to authenticated;

alter table public.product_option_groups enable row level security;
alter table public.product_option_values enable row level security;

create policy product_option_groups_select_members on public.product_option_groups
  for select to authenticated using (public.is_org_member(organisation_id));
create policy product_option_groups_insert_members on public.product_option_groups
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy product_option_groups_update_members on public.product_option_groups
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy product_option_groups_delete_members on public.product_option_groups
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.product_option_groups
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy product_option_values_select_members on public.product_option_values
  for select to authenticated using (public.is_org_member(organisation_id));
create policy product_option_values_insert_members on public.product_option_values
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy product_option_values_update_members on public.product_option_values
  for update to authenticated using (public.is_org_member(organisation_id)) with check (public.is_org_member(organisation_id));
create policy product_option_values_delete_members on public.product_option_values
  for delete to authenticated using (public.is_org_member(organisation_id));
create policy session_required on public.product_option_values
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- Quote items keep their own copy of the options chosen
--
-- A list of { group_id, group, kind, charge, value_id, value, text, amount_cents }: the ids say where it
-- came from (and may no longer exist), the rest is the item's own copy. Checked by the app; the
-- database keeps it a list of a sensible size.
-- ---------------------------------------------------------------------------

alter table public.quote_lines
  add column options jsonb not null default '[]'::jsonb
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 100 and pg_column_size(options) <= 40000);

grant insert (options) on public.quote_lines to authenticated;

-- ---------------------------------------------------------------------------
-- save_product: as before, also saving the options (p_options; null leaves them as they are).
-- Each element: { id?, name, kind, required, charge, text_price_cents, text_max,
--   values: [{ id?, name, price_cents, usual }] }. Options and values not listed are removed.
-- ---------------------------------------------------------------------------

drop function public.save_product(uuid, uuid, jsonb, jsonb);

create function public.save_product(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid;
  n integer;
  g record;
  gid uuid;
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
  else

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
  end if;

  -- Options and extras: null leaves them as they are; otherwise the list replaces them (keeping ids).
  if p_options is not null then
    if jsonb_typeof(p_options) <> 'array' then
      raise exception 'options must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_options) > 20 then
      raise exception 'a product can have at most 20 options' using errcode = '54000';
    end if;

    delete from public.product_option_groups og
     where og.product_id = pid and og.organisation_id = p_org
       and not exists (select 1 from jsonb_array_elements(p_options) e where e ->> 'id' = og.id::text);

    for g in
      select e.value as body, e.ordinality as ord from jsonb_array_elements(p_options) with ordinality as e
    loop
      if jsonb_typeof(g.body -> 'values') is distinct from 'array' then
        raise exception 'an option needs a list of values' using errcode = '22023';
      end if;
      if (g.body ->> 'kind') = 'text' and jsonb_array_length(g.body -> 'values') > 0 then
        raise exception 'a text option has no values' using errcode = '22023';
      end if;
      if (g.body ->> 'kind') in ('one', 'any') and jsonb_array_length(g.body -> 'values') = 0 then
        raise exception 'a choice needs at least one value' using errcode = '22023';
      end if;
      if jsonb_array_length(g.body -> 'values') > 50 then
        raise exception 'an option can have at most 50 values' using errcode = '54000';
      end if;

      gid := null;
      update public.product_option_groups set
        name = g.body ->> 'name',
        kind = g.body ->> 'kind',
        required = coalesce((g.body ->> 'required')::boolean, false),
        charge = coalesce(g.body ->> 'charge', 'item'),
        text_price_cents = coalesce((g.body ->> 'text_price_cents')::bigint, 0),
        text_max = coalesce((g.body ->> 'text_max')::integer, 100),
        sort_order = g.ord - 1
       where id::text = g.body ->> 'id' and product_id = pid and organisation_id = p_org
      returning id into gid;
      if gid is null then
        insert into public.product_option_groups (
          organisation_id, product_id, name, kind, required, charge, text_price_cents, text_max, sort_order
        ) values (
          p_org, pid, g.body ->> 'name', g.body ->> 'kind',
          coalesce((g.body ->> 'required')::boolean, false), coalesce(g.body ->> 'charge', 'item'),
          coalesce((g.body ->> 'text_price_cents')::bigint, 0), coalesce((g.body ->> 'text_max')::integer, 100),
          g.ord - 1
        )
        returning id into gid;
      end if;

      -- Its values, the same way.
      update public.product_option_values set usual = false where group_id = gid and organisation_id = p_org and usual;
      delete from public.product_option_values ov
       where ov.group_id = gid and ov.organisation_id = p_org
         and not exists (select 1 from jsonb_array_elements(g.body -> 'values') e where e ->> 'id' = ov.id::text);
      update public.product_option_values ov set
        name = e.name, price_cents = e.price_cents, usual = coalesce(e.usual, false), sort_order = e.ord - 1
      from rows from (jsonb_to_recordset(g.body -> 'values') as (id uuid, name text, price_cents bigint, usual boolean))
           with ordinality as e(id, name, price_cents, usual, ord)
       where ov.id = e.id and ov.group_id = gid and ov.organisation_id = p_org;
      insert into public.product_option_values (organisation_id, group_id, name, price_cents, usual, sort_order)
      select p_org, gid, e.name, e.price_cents, coalesce(e.usual, false), e.ord - 1
        from rows from (jsonb_to_recordset(g.body -> 'values') as (id uuid, name text, price_cents bigint, usual boolean))
             with ordinality as e(id, name, price_cents, usual, ord)
       where e.id is null
          or not exists (select 1 from public.product_option_values ov where ov.id = e.id and ov.group_id = gid);
    end loop;
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product(uuid, uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying each item's options.
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
    variation_id, variation_label, variation_name, options
  )
  select
    p_org, qid, l.sort_order, l.kind, l.product_id, l.name, nullif(l.description, ''),
    l.quantity_milli, l.unit_price_cents,
    coalesce(l.discount_kind, 'none'), coalesce(l.discount_value, 0),
    coalesce(l.vat_status, 'standard'), nullif(l.unit, ''),
    l.variation_id, nullif(l.variation_label, ''), nullif(l.variation_name, ''),
    coalesce(l.options, '[]'::jsonb)
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as l(
    sort_order integer, kind text, product_id uuid, name text, description text,
    quantity_milli bigint, unit_price_cents bigint,
    discount_kind text, discount_value bigint, vat_status text, unit text,
    variation_id uuid, variation_label text, variation_name text, options jsonb
  );

  return qid;
end;
$$;

revoke execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_quote_draft(uuid, uuid, jsonb, jsonb) to authenticated;
