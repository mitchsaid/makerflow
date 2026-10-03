-- Minimal stand-in for the parts of Supabase's `auth` schema and roles that our
-- migrations and tests rely on. ONLY for running tests against plain Postgres
-- (for example in a sandbox without Docker). Never apply this to a Supabase
-- project: real Supabase already has all of this.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb
);

-- Same claim lookup as Supabase: the JWT claims are exposed as a setting.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Sessions: real Supabase has this table; only the columns our code reads.
create table if not exists auth.sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  not_after timestamptz
);

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;
grant execute on function auth.jwt() to anon, authenticated;
