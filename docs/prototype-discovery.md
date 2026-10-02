# Prototype discovery

Reference notes on the AI Studio prototype in `/prototype`. The prototype is a **spec and a source of UI ideas, not a foundation**. The production app is built fresh in `/app`.

Scope of this read: `types.ts`, `hooks/useAppState.ts` (all business logic), `lib/costUtils.ts`, `App.tsx`, `BuyerView.tsx`, parts of `Dashboard.tsx`, and a grep sweep of the rest. The big screen components (`Quotes`, `Invoices`, `Products`, `Jobs`, `Materials`, `Customers`, each 1,000–4,000 lines) were **not read line by line**. Anything about their internals is marked *unverified*.

## 1. What the prototype is

- React 19 + Vite + Tailwind 4, about 30k lines of TypeScript. It has a PWA manifest but no service worker.
- **No backend, no auth, no database.** All state lives in one hook (`useAppState`) and is mirrored to `localStorage` (`maker_*` keys). Nothing is shared between devices or users.
- `express`, `dotenv` and `@google/genai` are listed in `package.json`, and `metadata.json` declares "server-side Gemini API". **No code imports any of them.** They are AI Studio scaffolding and are not evidence of a wanted AI feature (see open question 6).

## 2. Screens and journeys

| Area | What it does |
|---|---|
| Dashboard | Summary, notifications, quick-create actions. **Also hosts the demo-data controls** (see section 6). |
| Products and Services | Catalogue with base price, photo, variations and extras (each with a price uplift), volume price breaks, wholesale and retail tiers, product groups, finished-goods stock, and production stages (including conditional stages). |
| Materials | Raw materials with bulk quantity and bulk cost (giving unit cost), units, stock level, low-stock warning, and supplier. |
| Customers | Individuals and businesses (VAT number, CIPC number, billing and shipping address, default pricing tier). Customer statements with ageing buckets. |
| Quotes | Line items from products or custom items, item and quote discounts, VAT, fulfilment (collection or delivery with a price), expiry, and a document template. Statuses: draft, sent, viewed, accepted, expired, declined. **Internal financials panel** shows revenue, cost and margin per line and per quote. |
| Invoices | Tax invoices with VAT, due date, and statuses: unpaid, paid, overdue, partially credited, credited. **Credit notes** with reason codes, a link to the parent invoice, and optional restock. |
| Jobs | Created from a quote, or directly, or as `stock_creation`. Statuses: Awaiting quote acceptance, Not Started, In Progress, Ready for Collection, Ready for Delivery, Being Delivered, Done. Per-item tracking (consolidated, batch, or per-unit) and stage progress. Completing work **deducts material stock** and can consume finished-goods stock. |
| Buyer view | A simulated customer-facing page for a quote or invoice: view, accept, decline with reason, submit proof of payment. |
| Document templates | Gallery and customiser for branded documents (fonts, colours, banner, table and total styles, logo mode). This is the "beautiful, branded" part of the vision. |
| Profile | Business details, logo, banking details, VAT registration and rate. |
| Floating tools | Scratchpad and a time tracker (standalone, in `localStorage`). *Unverified whether time logs feed job costs.* |

**Flow as implemented:** quote → (buyer accepts) → invoice is created automatically and the job moves to Not Started → job stages → fulfilment status → invoice paid. Creating an invoice directly also auto-creates a job.

## 3. Costing logic (the core differentiator)

- Material unit cost = `bulkCost / bulkQuantity`. Input cost = amount × unit cost, with hard-coded conversions (kg↔g, l↔ml, m↔cm↔mm).
- Labour = hours × hourly rate (minutes supported). Direct costs are a fixed amount.
- Product cost = base inputs, plus inputs attached to each selected variation or extra.
- Line margin = line total − (unit cost × quantity). Order margin sums the lines.

Keep the concept and the per-quote margin visibility. Rebuild the implementation (section 5).

## 4. Domain model worth carrying forward

Business profile, customer, material, product (with inputs, options, price breaks), quote and line items, job and job items, invoice and line items, credit note, notification, and document template style. Two ideas are right and should be kept:

- Issued documents **snapshot** customer and business details, so later edits don't rewrite history. In the new model, hold a foreign key plus a snapshot.
- Credit notes reference the parent invoice and drive its status.

## 5. Problems not to port

**Financial and compliance**
1. **Document numbers are `array.length + 1`.** Deleting a record produces duplicate or reused numbers, and numbers are not gapless. Job numbers are derived from the *invoice* count when a job is auto-created.
2. **Invoices and credit notes can be deleted** (`deleteInvoice`, `deleteCreditNote`). Issued tax documents must be immutable, and corrections must go through credit notes.
3. **All money is JavaScript floats**, with no rounding rules. VAT is derived from the total as `total − total / 1.15`, so VAT-inclusive pricing is assumed everywhere. Line-level `taxRate` fields exist but the invoice applies one rate to the whole total.
4. **Quote → invoice conversion drops data.** `convertQuoteToInvoice` does not copy `unitCost`, `baseUnitPrice`, `hideImage` or line `taxRate`. The margin on an invoice cannot be computed afterwards.
5. **"Proof of payment" marks an invoice paid instantly**, with no verification. Buyer accept and decline flip local state in the maker's own browser.
6. **Costing bugs.** In `calculateMaterialInputCost` the "l input on an ml material" case is missing: the second litre branch duplicates the first, so it falls through with no conversion. Unknown unit pairs silently fall back to a 1:1 conversion (for example grams against pieces). Line-to-product matching falls back to **fuzzy name matching** (`includes`), which can attach the wrong product's costs.

**Architecture**
7. Everything is client-side and single-tenant. There is no tenancy, no roles and no server-side validation.
8. IDs are `Date.now()` strings, which collide under any concurrency.
9. Stock deduction and job side effects are spread across client-side state updaters. In production these must be server-side, transactional, and ideally recorded as a ledger of movements and not as overwritten counts.
10. State updaters call `addNotification`, so effects run inside pure state functions.
11. Images are base64 in `localStorage` or hotlinked from picsum and unsplash. The PWA manifest icons are hotlinked JPEGs declared as PNG.
12. PDFs come from `html2pdf.js`, which rasterises the DOM to JPEG. Output is not text-searchable, is heavy, and varies by device. Move PDF generation to the server.
13. Screen components of 3,000–4,000 lines each mix UI, business rules and state.

## 6. Test-data helpers (excluded from the product)

These exist only for demos and must not be ported:

- `src/data/defaultData.ts` (a sample "Capetonian" workspace, about 1,200 lines).
- `src/data/companyPresets.ts`, six one-click demo companies: Pulp Paperworks (bookbinding), The Lollipop League (confectionery), Veldt & Forge (jewellery), Kogelberg Oak & Timber (furniture), CloudGrip Leather, Fynbos & Clay (ceramics).
- In `useAppState`: `resetToDefaults`, `clearAllData`, `loadCompanyPreset`.
- In `Dashboard.tsx`: "Reset (clear all info)", "Restore Default Workspace", and the "Preconfigured Company Profiles / 1-Click Demo Datasets" section.
- `public/images/*` and `src/assets/images/*` sample product photos.

The **content** of the six presets is still useful as realistic fixtures for automated tests and local development. If we keep any of it, it goes in a dev and test seed script that refuses to run against production, and never in a UI path. The customiser's `sampleItems` are template-preview data and are fine to keep as such.

A real "delete my account and data" flow (POPIA) is a separate, deliberate feature and replaces the prototype's "Reset".

## 7. Open questions (answered)

Answers were given by the founder and are recorded in `product-brief.md`, section 3. In short: invoice conversion is the maker's choice with a prompt on job completion; partial payments and deposits are in scope; complexity is layered in; quotes go out as PDF first; time tracking feeding labour cost is a per-user choice; AI is expected later. A product-import onboarding journey (for example from a Shopify export) was added as a new requirement.

## 8. Deeper reads
- Quotes: `docs/prototype-quotes-analysis.md` (2026-10-02).
