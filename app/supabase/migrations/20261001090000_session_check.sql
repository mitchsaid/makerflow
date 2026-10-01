-- Immediate sign-out everywhere.
--
-- A sign-in token (JWT) stays cryptographically valid for about an hour even after
-- the session behind it has been ended (signed out on another device, user removed).
-- This function lets the app ask: "does the session this token belongs to still exist?"
-- The app calls it on every protected page and action, so a sign-out takes effect on
-- the next request instead of when the token expires.
--
-- SECURITY-SENSITIVE: security-definer function reading the auth schema.
-- Needs human review before this is applied to any hosted project.

create function public.session_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  );
$$;

revoke execute on function public.session_is_active() from public, anon;
grant execute on function public.session_is_active() to authenticated;
