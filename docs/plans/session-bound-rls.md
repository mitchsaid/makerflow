# Plan: session-bound data access (security slice, before shadcn)

Status: built and tested locally, 2026-10-01 (awaiting human review and merge). Founder chose to do this as its own slice, first.

Result: all SQL tests (including the new guard tests, mutation-tested), plain-Postgres tests and 13 browser tests pass; the policy is evaluated once per statement (EXPLAIN); navigation timing unchanged.

## Problem
A sign-in token (JWT) outlives its session by up to the token lifetime. The app already checks `session_is_active()` on every page and action, but someone holding a stolen token could still query the database API directly (bypassing the app) until it expires.

## Design
1. A **restrictive** row-level-security policy named `session_required` on every table in `public`: `using/with check ((select public.session_is_active()))`. Restrictive policies are ANDed with all other policies, so it cannot be bypassed by a permissive one, and it lives in one obvious place per table. The `(select ...)` wrapper lets Postgres evaluate it once per statement, not per row.
2. `ensure_organisation()` (security definer, so it bypasses row-level security) checks the session itself.
3. **Guard tests** so a future table or function cannot forget it:
   - every table in `public` has RLS on and a `session_required` restrictive policy;
   - the functions callable by signed-in users are exactly an allow-list.
4. Behaviour tests: with a live session, everything works as before; once the session is deleted, the same token reads nothing, writes nothing and cannot call `ensure_organisation`.
5. Existing SQL tests now create a real session for each simulated user (a small helper per file).
6. The app keeps its explicit `session_is_active()` check so a dead session redirects to sign-in rather than to onboarding.

## Rule going forward
Every new business table: RLS, the `session_required` policy, and tests (the guard test enforces it).

## Not in this slice
Shorter token lifetime (Supabase project setting, founder to change on hosted dev and prod; suggested 15 minutes), step-up re-authentication for payments and deletion (later), cookie hardening and Content-Security-Policy (hardening backlog).

## Review
Touches row-level security, a security-definer function and a migration: **needs human review** before it is applied to a hosted project.
