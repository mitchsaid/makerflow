# ADR 0001: Application stack

Status: accepted (founder approved Next.js on Vercel and Supabase-style managed services)

## Decision
- **Next.js (TypeScript)** for the web app, deployed on **Vercel**.
- **Supabase** (managed Postgres, auth, file storage, backups) for data and sign-in.
- Sign-in via email magic link and Google.

## Why
- Claude is strong on this stack, which suits an agent-driven solo build.
- One TypeScript codebase for UI and server logic (money, VAT, numbering, PDFs).
- Server rendering suits both a fast public landing page and, later, public hosted quotes and invoices.
- Branch preview deployments support dev and prod environments and phone testing.
- Mature patterns exist for Supabase auth, row-level security and migrations.
- Low lock-in: Next.js can be self-hosted and the data is ordinary Postgres.

## Trade-offs and follow-ups
- Vercel's free plan is for non-commercial use. Expect a paid plan once there are real users. Check current terms.
- Serverless limits: simple PDFs (React-PDF) are fine. Heavier headless-browser rendering may need a workaround later.
- **Region:** Supabase has no South African region (confirmed by the founder when creating the projects). Both hosted projects are in an EU region, so South African users see extra latency. Keep Vercel functions in the matching region so app-to-database calls stay fast.
- **POPIA:** customer personal information will be stored outside South Africa. Cross-border transfer is permitted under conditions in POPIA (section 72). Confirm the position and the privacy-policy wording with a South African legal adviser before launch.
- Next.js moves quickly. Pin versions and rely on tests.

## Not yet decided
Migration tool, test runner, error tracking, email provider, and PDF approach. Each gets its own ADR when the skeleton reaches it.
