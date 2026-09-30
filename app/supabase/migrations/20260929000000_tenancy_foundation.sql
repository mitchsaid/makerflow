-- Layer 0: tenancy foundation.
--
-- Tables: organisations, profiles, memberships.
-- Every later business table gets an organisation_id and RLS policies built on
-- the helper functions below.
--
-- SECURITY-SENSITIVE: RLS policies, grants and security-definer functions.
-- Needs human review before this is applied to any hosted project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) <= 120),
  created_at timestamptz not null default now()
);

-- Roles are a fixed set for now. A finer-grained permissions model comes with
-- the employees layer; the UI only shows "owner" until then.
create table public.memberships (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies (here and in later migrations).
-- security definer so they can read memberships without recursing into its
-- own RLS. search_path is pinned to avoid search-path hijacking.
-- ---------------------------------------------------------------------------

create function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organisation_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organisation_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any (allowed_roles)
  );
$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile is created automatically for each new auth user.
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Truncated so an unusually long provider-supplied name can never make
    -- sign-up fail on the profiles length check.
    left(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''), 120)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- First-sign-in organisation. The app asks for the business name during
-- onboarding and passes it here. Idempotent: if the user already belongs to an
-- organisation it is returned unchanged (the name argument is ignored), so a
-- repeated call cannot rename or duplicate anything. The advisory lock stops
-- two concurrent submissions from creating two organisations.
-- Note for the employees layer: invited staff must join an existing
-- organisation, so the app calls this only for users who signed up directly.
-- ---------------------------------------------------------------------------

create function public.ensure_organisation(org_name text)
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

  return org;
end;
$$;

revoke execute on function public.ensure_organisation(text) from public, anon;
grant execute on function public.ensure_organisation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges. Start from nothing, then grant the minimum. There are no direct
-- INSERT or DELETE grants: organisations and memberships are created through
-- ensure_organisation(), and invitations/removals come with the employees layer.
-- ---------------------------------------------------------------------------

revoke all on public.organisations from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select on public.organisations to authenticated;
grant select on public.memberships to authenticated;
grant select on public.profiles to authenticated;

grant update (name) on public.organisations to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;

-- organisations: members can read; owners and admins can rename.
create policy organisations_select_members
  on public.organisations for select to authenticated
  using (public.is_org_member(id));

create policy organisations_update_admins
  on public.organisations for update to authenticated
  using (public.has_org_role(id, array['owner', 'admin']))
  with check (public.has_org_role(id, array['owner', 'admin']));

-- memberships: you can see your own, and everyone in organisations you belong to.
create policy memberships_select_own_orgs
  on public.memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_org_member(organisation_id)
  );

-- profiles: you can see your own and those of people you share an organisation with.
create policy profiles_select_self_or_colleagues
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs
        on theirs.organisation_id = mine.organisation_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = profiles.id
    )
  );

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
