-- Customers: the people and businesses a maker sells to.
--
-- One row per customer per organisation. Name is the only required detail; everything
-- else is optional and can be added later. Business-only details (contact person, VAT
-- number, company registration) can only be set on a customer of kind 'business'.
--
-- Customers are ARCHIVED, never deleted: documents will reference them. There is no delete
-- grant. Any member of the organisation can add, edit, archive and restore customers.
--
-- (organisation_id, id) is unique so later documents can reference a customer with a
-- composite foreign key that cannot point across businesses.
--
-- SECURITY-SENSITIVE: new table with row-level security and column grants.
-- Needs human review before this is applied to any hosted project.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind text not null default 'individual' check (kind in ('individual', 'business')),
  -- Optional text fields are stored as NULL when empty, never as ''.
  contact_person text check (contact_person is null or char_length(contact_person) between 1 and 120),
  email text check (email is null or char_length(email) between 3 and 254),
  phone text check (phone is null or char_length(phone) between 1 and 40),
  -- Billing address, generic fields ("region" is the province in South Africa).
  address_line1 text check (address_line1 is null or char_length(address_line1) between 1 and 120),
  address_line2 text check (address_line2 is null or char_length(address_line2) between 1 and 120),
  city text check (city is null or char_length(city) between 1 and 80),
  region text check (region is null or char_length(region) between 1 and 80),
  postal_code text check (postal_code is null or char_length(postal_code) between 1 and 20),
  -- Where to deliver, when different from the billing address. Free text, several lines.
  delivery_address text check (delivery_address is null or char_length(delivery_address) between 1 and 400),
  vat_number text check (vat_number is null or char_length(vat_number) between 1 and 32),
  company_registration_number text
    check (company_registration_number is null or char_length(company_registration_number) between 1 and 40),
  -- Private to the business: never shown on a document.
  notes text check (notes is null or char_length(notes) between 1 and 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_org_id_unique unique (organisation_id, id),
  constraint customers_business_only_details check (
    kind = 'business'
    or (contact_person is null and vat_number is null and company_registration_number is null)
  )
);

create index customers_org_name_idx on public.customers (organisation_id, name);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- No delete, and the organisation can never be changed after creation.
revoke all on public.customers from anon, authenticated;
grant select on public.customers to authenticated;
grant insert (
  organisation_id, name, kind, contact_person, email, phone,
  address_line1, address_line2, city, region, postal_code,
  delivery_address, vat_number, company_registration_number, notes
) on public.customers to authenticated;
grant update (
  name, kind, contact_person, email, phone,
  address_line1, address_line2, city, region, postal_code,
  delivery_address, vat_number, company_registration_number, notes, archived_at
) on public.customers to authenticated;

alter table public.customers enable row level security;

create policy customers_select_members
  on public.customers for select to authenticated
  using (public.is_org_member(organisation_id));

create policy customers_insert_members
  on public.customers for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy customers_update_members
  on public.customers for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.customers
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));
