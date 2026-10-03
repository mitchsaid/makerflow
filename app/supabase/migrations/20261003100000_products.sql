-- Products: what a business sells (things it makes, and services), first layer.
--
-- This layer holds only what is decided: kind, name, description and a unit price. Options
-- (variations and extras), costs and materials, quantity prices, production steps, stock and
-- photos are designed later with the founder and get their own tables then; nothing here
-- blocks them (stable ids, and quote lines will keep their own copy of what they sold).
--
-- The price is typed in the business's VAT entry mode (including or excluding VAT), exactly
-- like a quote line's price.
--
-- Products are ARCHIVED, never deleted: quote lines will point at them. There is no delete
-- grant. Any member of the organisation can add, edit, archive and restore products.
-- (organisation_id, id) is unique so quote lines can reference a product with a composite
-- foreign key that cannot point across businesses.
--
-- SECURITY-SENSITIVE: new table with row-level security and column grants.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null default 'product' check (kind in ('product', 'service')),
  name text not null check (char_length(name) between 1 and 200),
  -- Shown on quotes. Optional text is stored as NULL when empty, never as ''.
  description text check (description is null or char_length(description) between 1 and 1000),
  unit_price_cents bigint not null check (unit_price_cents between 0 and 99999999999),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_org_id_unique unique (organisation_id, id)
);

create index products_org_name_idx on public.products (organisation_id, name);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- No delete, and the organisation can never be changed after creation.
revoke all on public.products from anon, authenticated;
grant select on public.products to authenticated;
grant insert (organisation_id, kind, name, description, unit_price_cents)
  on public.products to authenticated;
grant update (kind, name, description, unit_price_cents, archived_at)
  on public.products to authenticated;

alter table public.products enable row level security;

create policy products_select_members
  on public.products for select to authenticated
  using (public.is_org_member(organisation_id));

create policy products_insert_members
  on public.products for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy products_update_members
  on public.products for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.products
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));
