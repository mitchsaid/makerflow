-- Pictures: product photos and the business logo, shown on quotes.
--
-- SECURITY-SENSITIVE (a new table with row-level security, new columns with grants, a replaced
-- function callable by signed-in users). Needs human review before it is applied to any hosted
-- project. Decisions in docs/plans/quote-looks.md.
--
-- * images: each upload is stored in the database as two small renditions made by the server (a
--   display copy and a thumbnail), never the original. Members of the business can read and add
--   them; nobody can change or delete one, because a sent quote's frozen snapshot names the images
--   it used and must keep them forever. Replacing or removing a photo only stops pointing at it.
-- * products.photo_image_id and business_profiles.logo_image_id point at an image of the SAME
--   business (composite foreign keys, so a business can never point at another's picture).
-- * quotes.show_photos: the per-quote switch (on by default). save_quote_draft carries it; a
--   payload without it (an older app still open on a phone) keeps what the draft has.

create table public.images (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null check (kind in ('product', 'logo')),
  -- Both renditions are in this format: JPEG for photos, PNG for logos (to keep transparency).
  content_type text not null check (content_type in ('image/jpeg', 'image/png')),
  -- The display rendition's size in pixels.
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  display bytea not null check (octet_length(display) between 1 and 700000),
  thumb bytea not null check (octet_length(thumb) between 1 and 150000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint images_org_id_unique unique (organisation_id, id)
);

create index images_org_idx on public.images (organisation_id);

-- Members read (name the columns you need: the bytes are big) and add. No update, no delete.
revoke all on public.images from anon, authenticated;
grant select on public.images to authenticated;
grant insert (organisation_id, kind, content_type, width, height, display, thumb)
  on public.images to authenticated;

alter table public.images enable row level security;

create policy images_select_members
  on public.images for select to authenticated
  using (public.is_org_member(organisation_id));

create policy images_insert_members
  on public.images for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy session_required on public.images
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- Pointers to images
-- ---------------------------------------------------------------------------

alter table public.products add column photo_image_id uuid;
alter table public.products
  add constraint products_photo_same_org
  foreign key (organisation_id, photo_image_id) references public.images (organisation_id, id);
grant insert (photo_image_id), update (photo_image_id) on public.products to authenticated;

alter table public.business_profiles add column logo_image_id uuid;
alter table public.business_profiles
  add constraint business_profiles_logo_same_org
  foreign key (organisation_id, logo_image_id) references public.images (organisation_id, id);
grant update (logo_image_id) on public.business_profiles to authenticated;

alter table public.quotes add column show_photos boolean not null default true;
grant insert (show_photos) on public.quotes to authenticated;
grant update (show_photos) on public.quotes to authenticated;

-- ---------------------------------------------------------------------------
-- save_quote_draft: as before, also carrying the photos switch.
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
