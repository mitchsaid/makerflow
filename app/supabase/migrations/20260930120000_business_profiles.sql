-- Layer 1: business profile and per-user prompt dismissals.
--
-- business_profiles: one row per organisation (contact details, address, VAT status).
-- prompt_dismissals: remembers which friendly prompts a user has dismissed.
--
-- SECURITY-SENSITIVE: RLS policies, grants and a replaced security-definer function.
-- Needs human review before this is applied to any hosted project.
-- (Written as a new migration: 20260929000000_tenancy_foundation.sql is already
-- applied to the hosted dev project and must not be edited.)

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current.
-- clock_timestamp() (not now()) so it also moves inside a single transaction.
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- business_profiles
-- ---------------------------------------------------------------------------

create table public.business_profiles (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  -- Jurisdiction. Fixed to South Africa for now; drives the locale pack later.
  country_code text not null default 'ZA' check (country_code ~ '^[A-Z]{2}$'),
  currency_code text not null default 'ZAR' check (currency_code ~ '^[A-Z]{3}$'),
  -- Optional text fields are stored as NULL when empty, never as ''.
  phone text check (phone is null or char_length(phone) between 1 and 40),
  email text check (email is null or char_length(email) between 3 and 254),
  -- Generic address fields; "region" is the province in South Africa.
  address_line1 text check (address_line1 is null or char_length(address_line1) between 1 and 120),
  address_line2 text check (address_line2 is null or char_length(address_line2) between 1 and 120),
  city text check (city is null or char_length(city) between 1 and 80),
  region text check (region is null or char_length(region) between 1 and 80),
  postal_code text check (postal_code is null or char_length(postal_code) between 1 and 20),
  vat_registered boolean not null default false,
  vat_number text check (vat_number is null or char_length(vat_number) between 1 and 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Registered for VAT if and only if a VAT number is on file.
  constraint business_profiles_vat_consistent check (vat_registered = (vat_number is not null))
);

create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- Every organisation gets a profile row when it is created. Same behaviour as before
-- (idempotent, validates the name, never renames) plus the profile insert.
create or replace function public.ensure_organisation(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
  clean_name text := btrim(coalesce(org_name, ''));
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select m.organisation_id
    into org
    from public.memberships m
   where m.user_id = uid
   order by m.created_at
   limit 1;

  if org is not null then
    return org;
  end if;

  if char_length(clean_name) not between 1 and 120 then
    raise exception 'business name must be between 1 and 120 characters'
      using errcode = '22023';
  end if;

  insert into public.organisations (name)
  values (clean_name)
  returning id into org;

  insert into public.memberships (organisation_id, user_id, role)
  values (org, uid, 'owner');

  insert into public.business_profiles (organisation_id)
  values (org);

  return org;
end;
$$;

-- Organisations that already exist (for example on the hosted dev project).
insert into public.business_profiles (organisation_id)
select id from public.organisations
on conflict do nothing;

revoke all on public.business_profiles from anon, authenticated;
grant select on public.business_profiles to authenticated;
grant update (
  phone, email,
  address_line1, address_line2, city, region, postal_code,
  vat_registered, vat_number
) on public.business_profiles to authenticated;

alter table public.business_profiles enable row level security;

create policy business_profiles_select_members
  on public.business_profiles for select to authenticated
  using (public.is_org_member(organisation_id));

create policy business_profiles_update_admins
  on public.business_profiles for update to authenticated
  using (public.has_org_role(organisation_id, array['owner', 'admin']))
  with check (public.has_org_role(organisation_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------
-- prompt_dismissals: personal to each user, per organisation.
-- ---------------------------------------------------------------------------

create table public.prompt_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  prompt_key text not null check (prompt_key ~ '^[a-z0-9][a-z0-9_.-]{0,63}$'),
  dismissed_at timestamptz not null default now(),
  primary key (user_id, organisation_id, prompt_key)
);

revoke all on public.prompt_dismissals from anon, authenticated;
grant select, insert, delete on public.prompt_dismissals to authenticated;

alter table public.prompt_dismissals enable row level security;

create policy prompt_dismissals_select_own
  on public.prompt_dismissals for select to authenticated
  using (user_id = (select auth.uid()));

create policy prompt_dismissals_insert_own
  on public.prompt_dismissals for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_org_member(organisation_id)
  );

create policy prompt_dismissals_delete_own
  on public.prompt_dismissals for delete to authenticated
  using (user_id = (select auth.uid()));
