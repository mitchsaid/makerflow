# Plan: onboarding, products and the "start from what you have" head start

Status: **decisions affirmed by the founder on 2026-10-01; plan awaiting founder approval. Nothing built.** Supersedes the onboarding wishes in `docs/product-brief.md` (updated alongside this plan).

## Goal
Get each maker to a first useful result without feeling they are filling in forms: **the first quote for most, but not everyone** (some will start with job tracking or with working out costs and profit). Heavy lifting is done for them wherever possible. Nothing is forced, and nothing is hidden.

## Decisions (founder, 2026-10-01)
1. **Just in time.** No setup wizard. Setup happens in context, around the first thing the maker wants to do.
2. **"Where shall we start?"** A **first-time-only** screen (shown once per person per business, after the business name; invited staff never see it). An outcome-based, single-choice screen, a starting point and not a gate. Options: send a quote, track a job, work out my costs and profit, invoice someone (plus a quiet "not sure yet"). The answer sets the first guided task, which Home card leads and which prompts appear first. Nothing is locked or hidden, and it can be changed later. It is **not** a feature checklist and its answers are never used for marketing.
3. **One skippable "head start" screen after it, about an old quote or invoice only** (paste or upload, or start fresh). *Confirmed by the founder 2026-10-01.* It is shown for the quote, invoice and "not sure yet" starts, and skipped for the job and costing starts. It does not ship until the reader exists (a screen with a single "start fresh" option is pointless). **Product-list imports (Shopify, CSV) are not in onboarding:** they are offered the first time a maker touches products (see "Products" below).
4. **Products are optional and built up in layers.** A product with only a name and a price is complete. The app then offers small, dismissable steps to add more (see "Products" below). The full model is stored from the start.
5. **Reading an old quote or invoice (AI) is the headline head start, but: test first, build after the manual path.** A throwaway test on real sample documents measures accuracy and cost; the manual path ships first as the fallback.
6. **Business details are asked for at the first customer-facing document** (first quote, invoice or PDF), not in onboarding. **The business name stays in onboarding** (already built). The "Make your quotes look right" prompt on Home goes. Settings keeps the full business form.

## Flow
1. Sign in (exists).
2. Business name (exists).
3. Where shall we start? (new, skippable)
4. Head start (new, skippable, only once the reader exists): paste/upload an old quote or invoice, or start fresh.
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
- **Creating the first product** follows the prototype but stays in context: in the quote's "add a line" picker (Products, Custom item) there is an "Add new product" option. In the prototype that button closes the picker and sends the maker to the Products page (what happens to the half-built quote there is unverified). In production it should open the product builder over the quote and return with the new product already on the line. The same builder serves the Products screen and later jobs and invoices.
- **Shopify and CSV import** are offered at the first product contact: as a discreet choice beside "Add new product" in the quote picker ("Add one product" or "Import from Shopify or a CSV"), more prominently in the empty state of the Products screen, and later as a quieter menu item. Shopify's documented format is summarised below, so a mapper can be drafted now; a real export (the founder knows makers with Shopify sites; product data is public, so privacy is not a concern) is still wanted as a test fixture.
- **What Shopify's product CSV looks like** (from Shopify's help documentation, https://help.shopify.com/en/manual/products/import-export/using-csv, read 2026-10-01 through a summarising fetch; to be confirmed against a real export):
  - One product spans several rows sharing a "URL handle". The first row holds the product and its first variant; later rows hold only the handle plus variant fields, or an extra image (one row per image). Products without variants use "Default Title" as the option name.
  - Up to **3 options** per product (Option1 to Option3, each with a name and a value). A variant is a *combination* of option values with its own price, SKU and stock.
  - Columns of interest: Title (the only required one), Description (HTML), Type, Tags, Status (active, draft or archived), Price, Compare-at price, **Cost per item**, Inventory quantity (single location only), Product image URL (public HTTPS), SKU. Ignored: weight and dimensions, SEO, Google Shopping, markets, metafields, gift cards. The "Collection" column exists on import only, not on export.
  - UTF-8, comma-separated. Shopify says older templates remain compatible, so the importer should accept both the current column names and the older ones (for example "Handle" and "Variant Price"; the older names are from my memory and unverified).
  - **How it maps to our model:**
    - Title, Description (HTML stripped), Type (proposed product group), Status (archived becomes inactive), Inventory quantity (stock).
    - Options become **required variations**. Shopify prices each *combination*, while our model adds an uplift per option value. The importer picks a base price (the cheapest variant) and derives uplifts, and **checks that the prices really are additive**. If they are not (for example Large costs extra only in Red), it flags the product and offers separate products or an approximation to confirm.
    - **Cost per item** can seed a single direct-cost input, so the maker sees a margin straight away without a recipe.
    - Images: copying from the given web addresses means our server fetching user-supplied URLs (needs the same protections as any such fetch), plus a storage decision. Decide when building.
    - Prices could include or exclude VAT, and the CSV does not say. The importer must ask ("Do your prices include VAT?").
  - Not covered by the docs I read: whether real exports differ from the documented format. A real export is still worth getting as a test fixture.
- **Labour rates and employees.** The first time someone adds a labour input, ask what their hourly rate is and save it as a named business-wide rate (for example "My time"). Recipes reference a **named rate** (not a typed number on each product), so changing a rate updates costs everywhere. When employees arrive, rates attach to roles (for example baker, decorator, owner) and recipes keep pointing at the role's rate. Pay rates and margins are sensitive, so who can see or edit rates and margins belongs to the roles and permissions layer (staff can already see colleagues' roles; rates and margin views are owner and admin by default). Quote and invoice lines snapshot their cost when created, so changing a rate never rewrites history. Time tracking, if a maker turns it on, records actual hours against the estimate.
- Open: whether "services" are a separate kind from products, as in the prototype, or products with no stock. Decide when the products slice is planned.

## Heavy lifting, in order
1. **Deterministic first:** CSV and Shopify product import, offered at the first product contact (see "Products"). Needs a real sample export; the Shopify format is unverified, and Shopify variants carry absolute prices that must be converted into a base price plus uplifts.
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
- **Alongside the quotes work:** the guided first quote, business details asked at the first PDF or send, and the quote line picker with **minimal products** (name, price, perhaps options) created in context through "Add new product". Products with the quotes work is decided (see below).
- **Products (layers, minimal first), costing and jobs:** each slice adds its own guided first task and its layers of prompts.
- **When at least two destinations exist:** "Where shall we start?". CSV/Shopify import arrives with the products work.
- **In parallel from now:** the extraction experiment. After it, the reader, and with it the head-start screen.

## Decisions on the earlier open questions (founder, 2026-10-01)
1. **Products and quotes:** follow the prototype. The first product is created from "Add new product" while building a quote, so minimal products come with the quotes work.
2. **Navigation is not reordered** by the start choice. It only sets the first task and what leads on Home.
3. **Where makers keep their documents and costings:** unknown yet; deferred until the founder learns. Shopify exports are likely useful for building products and are offered at the first product contact, with a more discreet option afterwards.
4. **Hourly rate:** asked when a maker first sets up inputs in a product, as a named rate; designed to scale to employees (see "Products").

## Still open
- Services as a separate kind or not.
- Where rates and margins are visible once employees exist (roles and permissions layer).

## Tests per phase
SQL tests for any new table or column (row-level security, `session_required`, and a guard for new tables); browser tests for each journey including skipping every optional screen; accessibility cases for each new screen; `pnpm perf` for each new protected page; an extraction eval with a fixed sample set before any AI path ships.
