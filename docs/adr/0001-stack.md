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
- Verify region availability. Supabase has a Cape Town region. Confirm where Vercel functions can run and keep them close to the database.
- Next.js moves quickly. Pin versions and rely on tests.

## Not yet decided
Migration tool, test runner, error tracking, email provider, and PDF approach. Each gets its own ADR when the skeleton reaches it.
