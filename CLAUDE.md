# MakerFlow

Responsive web app for small-scale makers and artisans (South Africa first): quote → job → fulfilment → invoice → payment, with materials and labour costing.

Read `docs/product-brief.md` for principles, decisions and the delivery layers. Read `docs/prototype-discovery.md` before touching anything derived from the prototype.

## Repo layout
- `prototype/` — the original AI Studio prototype. **Reference only.** Do not edit it, build on it, or copy its data or state code.
- `app/` — the production app (Next.js, TypeScript, Tailwind, pnpm). Read `app/AGENTS.md` first: this Next.js version differs from older training data, so check `app/node_modules/next/dist/docs/` before writing framework code.
- `docs/` — brief, discovery notes, and (later) `docs/adr/` decision records.

## Rules
- Money is never a JavaScript float. Store integer minor units plus a currency code. Compute totals on the server.
- Every business table has an `organisation_id` and row-level security. Access goes through memberships and roles.
- Issued invoices and credit notes are immutable and are never deleted. Corrections are credit notes. Numbering is sequential and gapless per organisation.
- South African rules (VAT, document titles, required fields) live in a locale configuration, not scattered in code.
- No demo, seed or "reset" shortcuts in product code paths. Fixtures live in a separate dev-only script that refuses to run against production.
  - One deliberate exception: the **public demo account** on the landing page (see `docs/product-brief.md`, section 4). It is a designed feature, not a shortcut: demo data lives only in isolated demo organisations that cannot touch real ones, is built server-side, and the builder refuses to run on any non-demo organisation. Demo accounts never send real email or take real payments.
- Advanced features are offered through friendly, dismissable prompts and never forced on the user.
- Design mobile-first.
- Never commit secrets or `.env` files.

## Working style
- Plan first for anything larger than a small fix. Build in thin vertical slices, each with tests.
- Auth, RLS policies, money and tax logic, and migrations get human review. Say so when you touch them.
- Do not create a pull request unless asked.

## Commands
Run from `app/` with pnpm:
- `pnpm dev` — dev server
- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript, no emit
- `pnpm build` — production build
- `pnpm db:start` / `pnpm db:stop` — local Supabase stack (needs Docker); starting it applies every migration in `app/supabase/migrations/`
- `pnpm db:reset` — rebuild the **local** database from the migrations
- `pnpm db:test` — SQL security tests against the local stack
- `pnpm db:test:plain` — same tests on plain Postgres with an auth stand-in (sandboxes without Docker; set `DATABASE_URL` to a scratch database)

Database changes are migration files only, never dashboard edits. Every new table needs RLS and a test in `app/supabase/tests/`.
Still to add: app unit tests and browser tests.
