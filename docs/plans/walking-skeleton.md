# Plan: walking skeleton (layer 0)

Status: draft for founder review. Nothing here is built yet.

Goal: a thin, real slice that proves the whole pipeline (sign-up, database, security, tests, CI, deploys) with no maker features. Every later layer is built inside this safety net.

## Progress
- Done: scaffold, first migration and security tests, business-name onboarding, magic-link sign-in, protected workspace page, mobile-first shell, unit and browser tests, CI workflow (not yet run on GitHub).
- Not yet: Google sign-in verified against a real Google project, hosted dev environment wired up, Vercel deploys, error tracking, analytics, nightly backups, custom email sender.

## Scope
1. **Scaffold `app/`.** Next.js, TypeScript, Tailwind. Lint, format and typecheck scripts. Pin versions.
2. **Supabase.** Local Supabase for development (needs Docker), a hosted dev project, and a hosted prod project. All schema changes are migration files in git.
3. **Sign-in.** Email magic link and Google. Public landing page (same Next.js app) and a protected app area.
4. **First tenant tables.** `organisations`, `memberships` (with a role), `profiles`. Row-level security on all of them. A new user gets an organisation on first sign-in. The role model exists now, though the UI only shows "owner".
5. **Tests.**
   - Unit tests.
   - Database tests proving one organisation cannot read or write another's data.
   - One browser test: sign up and land in an empty app.
6. **CI (GitHub Actions).** Lint, typecheck and tests on every push. Migration check. Secret scanning.
7. **Environments.** Vercel preview deploy per branch, a dev environment, a prod environment. Secrets live in hosting settings, never in git. Supabase free tier for both hosted projects during the closed alpha (no backups, pauses after 7 days idle, built-in email is rate-limited):
   - scheduled nightly `pg_dump` to storage we control (GitHub Action);
   - a scheduled keep-alive check to avoid pausing;
   - a custom email sender (free tier) for magic links, set up early;
   - upgrade prod to Pro before any real-invoice use.
8. **Error tracking** and basic observability.
9. **Analytics.** Privacy-friendly page and sign-up tracking plus a few product events. No advertising trackers. Nothing collected beyond what is needed.
10. **Mobile-first shell.** Navigation, layout and the neutral-but-warm visual base.
11. **Docs.** Fill in the commands section of `CLAUDE.md`. Short ADRs for choices made (migrations tool, test runner, error tracking, analytics, email provider).

## Out of scope
Any maker feature (customers, invoices, quotes, jobs, costing), billing, AI, team invitations UI.

## Definition of done
- A new person can open the landing page, sign up by magic link or Google, and land in their own empty organisation on their phone.
- A second user cannot see the first user's data, proven by an automated test.
- CI is green on the default branch, and a preview URL exists for every branch.
- Dev and prod are separate, with separate secrets and databases.
- `CLAUDE.md` lists working commands for dev, test, lint, typecheck and migrate.

## Needs a human (Mitch)
- Create the Supabase, Vercel and Sentry-type accounts, and Google sign-in credentials. Claude can't do this for you.
- Choose the product name and domain (Batchwork is the leading candidate, undecided).
- Review the RLS policies and the sign-up flow before anything real goes into prod.

## Risks
- **Cloud-session network limits (widened by the founder for now; tighten once setup is done).** In the original Claude Code cloud environment the network policy blocks supabase.com, vercel.com, and the CDN that serves the Supabase Docker images, so the full local Supabase stack cannot start there and hosted projects cannot be reached. Plan: run the real stack (`supabase start`) and the migrations in GitHub Actions, and in the cloud session test migrations and row-level-security policies against a plain local Postgres with a small stand-in for Supabase's `auth` schema. The founder's own machine, or an environment with those hosts allowed, can run the full stack.
- Docker is required for local Supabase. Confirm your machine can run it.
- Supabase and Vercel region choices affect speed for South African users. Confirm current region availability before creating projects.
