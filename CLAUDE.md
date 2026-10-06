# MakerFlow

Responsive web app for small-scale makers and artisans (South Africa first): quote → job → fulfilment → invoice → payment, with materials and labour costing.

Read `docs/project-context.md` first (current state, working agreements, next steps). Then `docs/product-brief.md` for principles, decisions and the delivery layers. Read `docs/prototype-discovery.md` before touching anything derived from the prototype.

## Repo layout
- `prototype/` — the original AI Studio prototype. **Reference only.** Do not edit it, build on it, or copy its data or state code.
- `app/` — the production app (Next.js, TypeScript, Tailwind, pnpm). Read `app/AGENTS.md` first: this Next.js version differs from older training data, so check `app/node_modules/next/dist/docs/` before writing framework code.
- `docs/` — brief, discovery notes, and (later) `docs/adr/` decision records.

## Rules
- Money is never a JavaScript float. Store integer minor units plus a currency code. Compute totals on the server.
- Every business table has an `organisation_id` and row-level security. Access goes through memberships and roles. Every table in `public` also gets the restrictive `session_required` policy (see `docs/plans/session-bound-rls.md`); a guard test fails if one is missing.
- Issued invoices and credit notes are immutable and are never deleted. Corrections are credit notes. Numbering is sequential and gapless per organisation.
- Country-specific rules (tax, document wording and required fields, address shape, money style) live in a **locale pack** selected by the business's country code: `app/src/lib/locale/<cc>.ts`, with the sources in `docs/locales/<cc>/` (South Africa: `za`). Never hard-code a rate, wording, threshold or format elsewhere, and never fall back to another country's rules. Issued documents snapshot the country and the rules used. See `docs/adr/0004-locale-packs.md` and `docs/locales/README.md`.
- No demo, seed or "reset" shortcuts in product code paths. Fixtures live in a separate dev-only script that refuses to run against production.
  - One deliberate exception: the **public demo account** on the landing page (see `docs/product-brief.md`, section 4). It is a designed feature, not a shortcut: demo data lives only in isolated demo organisations that cannot touch real ones, is built server-side, and the builder refuses to run on any non-demo organisation. Demo accounts never send real email or take real payments.
- **Business profile vs Quotes and invoices vs Settings:** facts about the business (name, contact, address, VAT, what it makes, bank details) live in the Business profile (`/app/business`). How documents are numbered, worded and what they start with (numbering, wording, small print, the policies library, default deposit; later the same for invoices) live in Quotes and invoices (`/app/documents`). Settings (`/app/settings`) is only for the person and the app (account, preferences). Do not mix them.
- Advanced features are offered through friendly, dismissable prompts and never forced on the user.
- Thin slices keep the full feature's interaction: unbuilt parts are visible but inactive placeholder sections ("coming soon"), never a stand-in interaction to be replaced later. Placeholders show in production the same as on dev for now. See `docs/product-brief.md`, principle 9.
- Forms: primary buttons stay enabled; clicking with problems shows them at the fields and in a summary that jumps to the first one; errors appear only after interaction; messages say how to fix it; typed data is never lost. See `docs/adr/0005-form-errors.md`.
- Design mobile-first. UI is built from `app/src/components/ui` (shadcn/ui, see `docs/adr/0003-ui-components.md`): no hand-written buttons, inputs or cards; tap targets at least 44 px, input text at least 16 px; new screens get a case in `e2e/accessibility.spec.ts`.
- Speed is a feature (the app is used as an installed PWA). Each protected page makes one query for its main data (plus the parallel session check), loads through `getWorkspace()`, and is checked with `pnpm perf`. See `docs/adr/0002-performance.md`.
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
- `pnpm stack:start` / `pnpm stack:stop` — local Supabase with auth, API and a mailbox (needed to run the app and browser tests); copy its printed values into `app/.env.local` (see `app/.env.example`)
- `pnpm local` — start the local database and the app at http://localhost:3000 (one command)
- `pnpm check` — lint, typecheck and unit tests (the quick pre-commit check, ~30s)
- `pnpm env:local` — write `app/.env.local` from the running local stack (refuses to overwrite a hosted one without `--force`)
- `pnpm test` — unit tests (Vitest)
- `pnpm perf [db_ms] [phone_ms]` — navigation speed check with simulated latency (needs the local stack; set `CHROMIUM_PATH` if Playwright's browser is not installed)
- `pnpm test:e2e` — browser tests (Playwright, phone viewport). Needs the stack running; starts the dev server itself
- `pnpm db:test:plain` — same tests on plain Postgres with an auth stand-in (sandboxes without Docker; set `DATABASE_URL` to a scratch database)

Fast local loop and daily routine: `docs/runbooks/local-development.md`. First-time setup on a new computer: `./scripts/setup-local.sh` (checks tools, installs dependencies, starts the local stack, writes `app/.env.local`). CI runs on pull requests and on `main`, not on every branch push.

Database changes are migration files only, never dashboard edits. Every new table needs RLS, the `session_required` policy and a test in `app/supabase/tests/`. SQL tests simulate a signed-in user with a real session (`pg_temp.as_user`, copy the helper from an existing test file).
Sign-in uses email magic links (verified server-side, so they work across browsers) and Google (off until configured). Google sign-in is NOT yet tested against a real Google project.
