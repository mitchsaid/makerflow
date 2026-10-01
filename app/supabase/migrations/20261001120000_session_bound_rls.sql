-- Session-bound data access.
--
-- A token whose session has ended (signed out elsewhere, user removed, expired) must
-- not read or change anything, even when used directly against the database API.
-- Implemented as a RESTRICTIVE policy on every table: it is ANDed with all the
-- permissive policies, so no other policy can override it.
--
-- SECURITY-SENSITIVE: row-level security on every table and a security-definer function.
-- Needs human review before this is applied to any hosted project.
--
-- Every future table in `public` must get the same policy; the guard test in
-- supabase/tests/session_required.test.sql fails if one is missing.

-- (select ...) lets Postgres evaluate the check once per statement rather than per row.

create policy session_required on public.organisations
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.memberships
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.profiles
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.business_profiles
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

create policy session_required on public.prompt_dismissals
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ensure_organisation is security definer, so it bypasses row-level security: check the
-- session here. Otherwise identical to the version in 20260930120000_business_profiles.sql.
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
  if uid is null or not public.session_is_active() then
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
