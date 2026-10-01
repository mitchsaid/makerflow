# Plan: onboarding, products and the "start from what you have" head start

Status: **decisions affirmed by the founder on 2026-10-01; plan awaiting founder approval. Nothing built.** Supersedes the onboarding wishes in `docs/product-brief.md` (updated alongside this plan).

## Goal
Get each maker to a first useful result without feeling they are filling in forms: **the first quote for most, but not everyone** (some will start with job tracking or with working out costs and profit). Heavy lifting is done for them wherever possible. Nothing is forced, and nothing is hidden.

## Decisions (founder, 2026-10-01)
1. **Just in time.** No setup wizard. Setup happens in context, around the first thing the maker wants to do.
2. **"Where shall we start?"** An outcome-based, single-choice screen, a starting point and not a gate. Options: send a quote, track a job, work out my costs and profit, invoice someone (plus a quiet "not sure yet"). The answer sets the first guided task, which Home card leads and which prompts appear first. Nothing is locked or hidden, and it can be changed later. It is **not** a feature checklist and its answers are never used for marketing.
3. **One skippable "head start" screen after it.** Paste or upload an old quote or invoice, bring in a product list or spreadsheet, or start fresh. Products also appear later, at the point of need (quote form, job, or "Add product").
4. **Products are optional and built up in layers.** A product with only a name and a price is complete. The app then offers small, dismissable steps to add more (see "Products" below). The full model is stored from the start.
5. **Reading an old quote or invoice (AI) is the headline head start, but: test first, build after the manual path.** A throwaway test on real sample documents measures accuracy and cost; the manual path ships first as the fallback.
6. **Business details are asked for at the first customer-facing document** (first quote, invoice or PDF), not in onboarding. **The business name stays in onboarding** (already built). The "Make your quotes look right" prompt on Home goes. Settings keeps the full business form.

## Flow
1. Sign in (exists).
2. Business name (exists).
3. Where shall we start? (new, skippable)
4. Head start (new, skippable): paste/upload a quote or invoice, bring a product list or spreadsheet, or start fresh.
5. The first guided task for the chosen start, in context:
   - **Quote:** pick or add a customer, add lines (typed, or from products), see totals. Business details are asked for when they first produce the PDF.
   - **Job:** create a job (jobs can exist without a quote), with customer and items.
   - **Costs and profit:** build a product with a recipe and see the margin. Needs no customer and no business address.
   - **Invoice:** as the quote, ending in an invoice.
6. After the first task, contextual prompts (each dismissable, each remembered): add costs to a product, save what you just typed as a product, set your numbering prefix, and so on.

Progress is derived from what exists (do they have a customer? a product? a quote?), not from flags we store, so it cannot drift.

## Products (shape agreed, build later)
Grounded in the prototype (`prototype/src/types.ts`, `components/Products.tsx`, `AdvancedCustomItemModal.tsx`; the Quotes, Jobs and Services internals were not read line by line):
- A product is a configurable offering: base price; required **variations** and optional **extras**, each with price uplifts (and optionally their own inputs and photos); wholesale **price breaks** by quantity; photo; group; stock.
- A product is also a **recipe**: **inputs** (materials with amount and unit, labour as time at an hourly rate, direct costs), some tied to specific variations or extras. Materials are shared between products and have bulk quantity and bulk cost, giving a unit cost.
- A product has a **production plan**: stages, some conditional on options or quantity.
- A quote line is a product plus the chosen options plus a quantity; even a one-off "custom item" in the prototype can carry all of this.
- **Layered disclosure in the UI** (phone-sized steps, not the prototype's three-tab form): name and price → options → what it costs to make → quantity discounts → production steps → stock. Each layer is offered by a friendly prompt and can be skipped.
- Learnings to apply (from `docs/prototype-discovery.md`): a defined unit system (the prototype's unit conversions had bugs), no fuzzy name matching, stock as a ledger of movements.
- Likely business-wide setting: a default hourly rate, offered the first time labour is added.

## Heavy lifting, in order
1. **Deterministic first:** CSV and Shopify product import (needs a real sample export; the Shopify format is unverified, and Shopify variants carry absolute prices that must be converted into a base price plus uplifts).
2. **Reading an old quote or invoice** (PDF, photo, screenshot, or pasted text such as a WhatsApp quote). Could pre-fill: business name, contact details, VAT status and number, numbering pattern, payment terms, and product lines with prices. Several documents together can build a product list from what the maker actually sells.
3. **Reading a costing spreadsheet** to build recipes (hypothesis: makers keep costing in spreadsheets; to validate).
4. Website reading: lowest priority (many small makers sell through Instagram, Facebook or WhatsApp; to validate).

### Guardrails for any AI reading
- Signed-in users only; per-user limits; a spend cap on the AI account; bot protection on sign-up first (hardening item 1 in `docs/security-notes.md`). Demo accounts never call the paid AI.
- Always a "here is what we found, edit anything" review step. Extracted text is untrusted data: schema-validated, never able to trigger actions. Money is checked on the server: extracted lines are reconciled against the document's own total and VAT, and a mismatch is flagged.
- Uploaded files are not stored by default (read, then discarded). Customer personal details inside documents are ignored unless the maker chooses to add that customer.
- Say plainly in the screen that the document is sent to our AI provider to be read.
- **Unverified, to settle before launch:** the AI provider's data-handling terms and our POPIA wording; how long a read takes against Vercel Hobby function limits; whether Word and Excel files can be read directly (PDFs and images can).
- Cost: my reference lists Claude Sonnet 5.5 at $2 / $10 per million input / output tokens and Haiku 4.5 at $1 / $5 (cached late September 2026; recheck). A rough, **unmeasured** guess is a few US cents per document. Measure with the token counter in the experiment.

### Extraction experiment (throwaway, no product code)
- **Input:** 5 to 10 real quotes or invoices from makers, anonymised or blurred, in whatever formats they really use (PDF, phone photo, screenshot, WhatsApp text, Word, Excel). Never committed to the repo; kept in a scratch location only.
- **Run:** a dev-only script that sends each document to the model with a fixed output schema, and records cost and time.
- **Measure:** per-field accuracy (business name, VAT number, numbering pattern, each line's name, quantity and price, totals, VAT) with and without human edits; whether totals reconcile; cost per document; whether a cheaper model is good enough.
- **Decide:** go, go with limits (for example only PDFs and photos), or defer. The result decides how much onboarding is designed around it.
- Needs from the founder: sample documents, and where the makers he knows actually keep their quotes, invoices, price lists and costings.

## Phasing (dependencies matter)
The start screen needs destinations to send people to, so it ships after the features it points at.
- **Now (small):** remove the Home business-details prompt. Settings and business-name onboarding stay. Update its browser test.
- **Alongside the quotes work:** the guided first quote, business details asked at the first PDF or send, and the quote form's "add a product" path.
- **Products (layers, minimal first), costing and jobs:** each slice adds its own guided first task and its layers of prompts.
- **When at least two destinations exist:** "Where shall we start?" and the head-start screen (start fresh and CSV/Shopify first).
- **In parallel from now:** the extraction experiment. After it, the reader as a head-start option.

## Open questions
1. **Roadmap placement of products.** The brief puts products and costing at layer 6, after quotes, jobs and invoices. Since products are central and optional, should a minimal product (name, price, options) come before or with quotes so quote lines can pick one? Recommendation: yes, minimal products with the quotes work; recipes and costing later. Needs the founder's decision when the quotes slice is planned.
2. **Does the start choice reorder navigation, or only the first task and Home?** Recommendation: only the first task and Home, nothing hidden.
3. Where do makers keep their documents and costings (see the experiment).
4. Default hourly rate: when to ask, and whether it is per business or per person.

## Tests per phase
SQL tests for any new table or column (row-level security, `session_required`, and a guard for new tables); browser tests for each journey including skipping every optional screen; accessibility cases for each new screen; `pnpm perf` for each new protected page; an extraction eval with a fixed sample set before any AI path ships.
