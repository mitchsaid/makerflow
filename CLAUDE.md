# MakerFlow

Responsive web app for small-scale makers and artisans (South Africa first): quote → job → fulfilment → invoice → payment, with materials and labour costing.

Read `docs/product-brief.md` for principles, decisions and the delivery layers. Read `docs/prototype-discovery.md` before touching anything derived from the prototype.

## Repo layout
- `prototype/` — the original AI Studio prototype. **Reference only.** Do not edit it, build on it, or copy its data or state code.
- `app/` — the production app (not created yet).
- `docs/` — brief, discovery notes, and (later) `docs/adr/` decision records.

## Rules
- Money is never a JavaScript float. Store integer minor units plus a currency code. Compute totals on the server.
- Every business table has an `organisation_id` and row-level security. Access goes through memberships and roles.
- Issued invoices and credit notes are immutable and are never deleted. Corrections are credit notes. Numbering is sequential and gapless per organisation.
- South African rules (VAT, document titles, required fields) live in a locale configuration, not scattered in code.
- No demo, seed or "reset" shortcuts in product code paths. Fixtures live in a separate dev-only script that refuses to run against production.
- Advanced features are offered through friendly, dismissable prompts and never forced on the user.
- Design mobile-first.
- Never commit secrets or `.env` files.

## Working style
- Plan first for anything larger than a small fix. Build in thin vertical slices, each with tests.
- Auth, RLS policies, money and tax logic, and migrations get human review. Say so when you touch them.
- Do not create a pull request unless asked.

## Commands
To be filled in when `app/` is scaffolded (dev, test, lint, typecheck, migrate).
