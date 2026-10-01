# Project context: read this first in any new session

Last updated: 2026-10-01. Keep it current; it is how a fresh session (local or cloud) picks up where the last one left off.

## Working with the founder
- Solo founder. Prefers plain language, short numbered steps, and an explicit "who does what" (founder vs Claude).
- Decisions are asked as short multiple-choice forms with a recommended option first. Plan first for anything bigger than a small fix, then build in thin slices.
- Cost-conscious: free tiers while testing, paid only when real users depend on it.
- Verify claims and say what is unverified. Own mistakes plainly. Never guess at prices or product behaviour: check the docs.
- Do not open a pull request unless asked; give the compare link instead. The founder reviews and merges. Auth, RLS, money, tax and migrations get human review: say so.
- Never put secrets in chat, commits or docs. Hosted keys, passwords and connection strings live only in GitHub and Vercel secret settings.
- The founder uses a separate (personal) Claude account for MakerFlow and a work account elsewhere. Never touch `~/.claude`, shell profiles or Claude settings outside this repo.

## Product, principles, roadmap
See `docs/product-brief.md` (principles, decisions, delivery layers, journeys) and `docs/prototype-discovery.md` (what the AI Studio prototype did and what not to port). **Quotes are the first document to build.**

## State of the build
Done and merged (or in the open pull request, see below): landing page, email-link sign-in, business-name onboarding, protected workspace, tenancy tables with row-level security and mutation-checked tests, CI, fast local setup, plus (in the open PR) the app shell with bottom tab bar, business profile with South African validation, and the first dismissable prompt.

Hosted setup (nothing here is secret):
- Supabase, EU region (no South African region exists): `makerflow-dev` ref `mbbfjhjzhilathupnxdb`, `makerflow-prod` ref `ziusocayienstklwockp` (created, empty, not yet used). Free tier for both during the closed alpha.
- Vercel project `makerflow-hsp1` (Hobby plan, non-commercial; upgrade before charging). Its Production and Preview environment variables currently point at the **dev** Supabase project. Switch Production to prod before any real customer uses it.
- GitHub: ruleset on `main` (pull request required, three CI checks required, no bypass). Environment `dev` holds the secret `SUPABASE_DB_URL`. "Deploy database to dev" is a manual workflow on `main`. Dependabot is on.
- Hosted sign-in uses Supabase's default emails (custom templates need custom SMTP), so links must be opened in the same browser that asked for them.

## Immediate next steps
1. Founder merges the open pull request, then runs "Deploy database to dev" (applies the business-profile migration).
2. Founder sets up local development with the Claude desktop app (`docs/runbooks/local-development.md`).
3. **Onboarding:** decisions affirmed and the plan is written (`docs/plans/onboarding.md`); awaiting founder approval before any code. Founder to supply sample quotes or invoices (anonymised) for the extraction experiment, and to say where makers keep their quotes, price lists and costings. Next small step: remove the Home business-details prompt.
4. Slice 2: customers (see `docs/plans/business-profile-and-customers.md`), then quotes.
5. Hardening backlog and launch checklist: `docs/security-notes.md` (backups, error tracking, bot protection, custom email on a domain we own, Google sign-in test, prod project).
- Product name is undecided (MakerFlow is the working title; Batchwork is the leading candidate, availability unchecked).

## Things learned the hard way
- Next.js here is v16: `proxy.ts` replaces middleware, `cookies()` is async. Read `app/AGENTS.md` and `app/node_modules/next/dist/docs/` before framework code.
- React resets a `<form action>` after the action finishes, which desynced a controlled checkbox. Controlled forms submit by hand (see `app/src/app/app/settings/business-profile-form.tsx`).
- Hosted Supabase: custom email templates need custom SMTP; new users get the "confirm signup" email, returning users the magic link; the direct database connection is IPv6-only, so CI uses the session pooler connection string.
- Added migrations must never edit an already-applied one; write a new file.
- A path-filtered required CI check never reports and blocks merges. Keep the three required jobs unconditional.
- `pkill -f "next dev"` inside a shell command kills that shell (the pattern matches itself).

## Sessions
- Cloud sessions (claude.ai/code) and local sessions are separate conversations. Both read `CLAUDE.md` and this file, but neither sees the other's chat. Anything important belongs in `docs/`, not only in chat.
- Do not let two sessions edit the same branch at once. Use one branch per piece of work.
