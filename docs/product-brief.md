# MakerFlow product brief

Status: draft v1, from the founder Q&A. Change it freely. `CLAUDE.md` links here and should stay short.

## 1. Who and what

A responsive web app for small-scale makers and artisans (confectioners, jewellery-makers, dress-makers). It gives them one end-to-end workflow instead of spreadsheets and notebooks:

**quote → job → fulfilment (collection or delivery) → invoice → payment**

with materials and labour costing so they know their margin on every quote. First market: South Africa. Solo makers first, then employees with roles and permissions. Other countries later.

## 2. Principles

Product
1. **Simple by default, powerful when wanted.** Advanced features (profit tracking, variations, price breaks, stages, stock) are off until the maker meets a need for them.
2. **Progressive disclosure with a friendly voice.** The app offers discovery through short, warm prompts ("Want to track your profit on this quote?"). Every prompt is **dismissable**, dismissals are remembered, and a maker can run a fully uncluttered app.
3. **Mobile-first.** Design each screen for a phone first. On desktop, use the extra space where it helps (for example tables). It is the same app, not a second one.
4. **The maker's brand is the star.** The app itself is neutral, calm and warm (not sterile). Personality lives in the customer-facing documents.
5. **Money is exact.** No floating-point arithmetic for amounts. Totals are computed on the server.
6. **Issued documents are trustworthy.** Invoices lock on issue. Corrections go through credit notes. Quotes are revised as new versions and the old ones are kept. Nothing tax-relevant is ever deleted. Numbering is sequential and gapless per business.
7. **Jurisdiction is configuration.** South Africa is the first "locale pack": VAT rules, document titles, required invoice fields, numbering, currency. Nothing SA-specific is hard-coded outside it.
8. **Multi-tenant from day one.** Every business record belongs to an organisation. Users join through a membership with a role, even while the UI only shows "owner".
9. **Build in layers.** Ship a thin working slice, then add capability. Model the data for the full vision, and expose only what the current layer needs.

Engineering
10. Tests and CI are the feedback loop. Every slice ships with tests. Auth, RLS, money and tax logic are reviewed by a human.
11. No demo or seed shortcuts in product code paths. Dev and test fixtures live in a separate seed script that refuses to run against production.
12. Managed services over self-hosting, unless there is a clear reason.

## 3. Decisions so far

| Topic | Decision |
|---|---|
| Invoice creation | The maker chooses when to convert a quote to an invoice. When a job is completed, a smart prompt offers to create the invoice. |
| Payments | Partial payments and deposits are in scope from early on. Invoice balance and status are **derived from recorded payments**. |
| Complexity | Everything in the prototype is wanted eventually, delivered iteratively (see section 5). |
| Quotes out | PDF first. A hosted, online-viewable and acceptable quote comes later. **Quotes are the first document to build** (founder priority). |
| Navigation | Mobile: bottom tab bar. Desktop: left sidebar. |
| Logo upload | Later, with the branded document templates. |
| Customer form | Name only required. A "this is a business" switch reveals VAT number, company registration and contact person. Email, phone and addresses optional. |
| Time tracking | Feeds labour cost only if the maker chooses (a per-user setting). |
| AI | Expected eventually. **One exception pulled earlier:** reading an old quote or invoice to pre-fill onboarding (tested on real samples first, built after the manual path). See `docs/plans/onboarding.md`. |
| Onboarding | Just in time, no setup wizard. Business name, then an outcome-based "Where shall we start?" (a starting point, not a gate), then one skippable head-start screen (paste or upload an old quote or invoice, bring a product list or spreadsheet, or start fresh). Business details are asked for at the first customer-facing document. Plan: `docs/plans/onboarding.md`. |
| Products | Rich and optional: a product can be just a name and a price, or grow through layers (options, costs and recipes, price breaks, production stages, stock). The full model is stored from the start; the UI discloses it through friendly prompts. |
| Sign-in | Email magic link and Google. |
| VAT | Both VAT-registered and non-registered makers supported from the first invoice slice. |
| Pricing model | **Deferred** until real-user feedback. Data model keeps room for plans and limits, no billing code yet. |
| Stack direction | Managed services, Supabase-style (auth, Postgres, storage, backups). Next.js on Vercel, see `docs/adr/0001-stack.md`. |
| Tone | Neutral with warmth and friendliness. |
| Environments | Local Supabase for development, a hosted dev project, and a separate prod project. **Both hosted projects on Supabase free during the closed alpha** (testers told it is a trial). Nightly database dumps to storage we control via a scheduled CI job. **Upgrade prod to Pro before anyone relies on it for real invoices.** |
| Landing page | Lives in the same Next.js app. |
| Analytics | Privacy-friendly page and sign-up tracking plus a few key product events. No advertising trackers. |
| Invoice numbering | Simple sequence with an editable prefix and start number (for example INV-0001). Sequential and gapless per business. Makers migrating from another system can continue their numbers. |
| Hosted projects | Supabase, EU region (no SA region exists). `makerflow-dev` https://mbbfjhjzhilathupnxdb.supabase.co and `makerflow-prod` https://ziusocayienstklwockp.supabase.co. Project URLs are not secrets. Keys and passwords are never stored in the repo. |
| Business name at sign-up | The app asks for the business name during onboarding (no default such as "My workshop"). |
| Staff visibility | Staff can see the roles of colleagues in their organisation. |
| Public demo | The landing page offers a live demo that visitors can try, with data that resets. **Private temporary sandbox per visitor**, see section 4a. |
| Product name | Undecided. **Batchwork** is the leading candidate. Check CIPC, trademark, domains and app stores first. MakerFlow is the working title. |

## 4. Core journeys (target)

1. **Sign up and set up the business:** land, create an account, enter business details, logo, banking details, VAT status.
2. **Custom invoice (first slice):** pick or add a customer, add line items, apply VAT if registered, issue, download a branded PDF.
3. **Record payments:** part-payment, deposit, full payment. Balance updates.
4. **Quote:** create, revise (v1, v2), send as PDF, mark accepted or declined.
5. **Quote to job:** the maker turns an accepted quote into a job, then tracks status through collection or delivery.
6. **Job to invoice:** on completion the app offers to create the invoice.
7. **Costing:** materials and labour, with margin per quote and per invoice.
8. **Import products:** bring a Shopify or CSV product list into the catalogue.
9. **Team:** invite employees with roles and permissions.

## 4a. Public demo account (requirement)

The landing page has a live demo that visitors can try without signing up, with sample data that resets.

Why it needs care: it is the one place where demo data is a real feature, and it is open to the public. It must never let a visitor reach real customers' data, and it must not send real emails or take real payments.

Decision: **A, a private sandbox per visitor** (chosen by the founder). Option B is kept below for the record.

Design options:
- **A. A private sandbox per visitor (recommended).** Each visitor gets their own temporary demo organisation, filled with sample data, that expires after some hours and can be reset with a button. Visitors can't see or vandalise each other's edits. Uses anonymous sign-in, bot protection, and a scheduled clean-up job.
- **B. One shared demo account that resets on a timer.** Simplest, and matches the wording most literally. But everyone edits the same data, visitors can leave junk or offensive content for the next person, and concurrent use gets confusing.

Design implications already in mind:
- Demo organisations are flagged in the database and carry an expiry.
- Sample data is created by a server-side builder that only runs on demo organisations.
- Demo organisations are blocked from sending real email and from any payment features.
- The demo grows with the product: it starts with what exists (profile, customers, invoices) and gains quotes, jobs and costing as those layers ship.

## 5. Delivery layers (proposal)

Founder priority (set 2026-09-30): **quotes are the first document to build**, because a quote comes first in a maker's workflow of work. Everything before it is kept as lean as possible.

0. **Walking skeleton:** landing page, sign-up and sign-in, empty organisation, database with migrations, dev and prod environments, CI, error tracking. *(Core done; hardening items remain: backups, error tracking, bot protection, custom email.)*
1. **App shell and lean business profile:** bottom-tab navigation, business contact details and address, VAT status. Bank details are deliberately left for the invoice layer. Includes the first dismissable prompt.
2. **Customers:** list, add (name only required), edit, archive. Customers can also be added from inside the quote form.
3. **Quotes (the first document):** custom line items, VAT-aware totals, statuses (draft, sent, accepted, declined, expired), revisions (v1, v2 with history kept), sequential quote numbers with editable prefix, branded PDF. The public demo starts here.
4. **Jobs and fulfilment tracking:** accepted quote becomes a job; collection or delivery status.
5. **Invoices:** convert from a quote (maker's choice, with the "create invoice?" prompt when a job completes), VAT-aware, immutable on issue, gapless numbering, bank details, payments and deposits, credit notes.
6. **Materials, products and costing, and margin.**
7. **Templates and branding customisation (including logo upload).**
8. **Stock (raw materials and finished goods).**
9. **Product import and onboarding.** (Pieces of this arrive earlier, with each feature's guided first task; see `docs/plans/onboarding.md`.)
10. **Hosted quotes with online acceptance.**
11. **Employees, roles, permissions.**
12. **AI features, and paid plans once decided.**

Later layers can be reordered after user feedback. The data model is designed for all of them up front.

## 6. Non-goals for now

Accounting-package integrations, native mobile apps, other countries, online payment gateways, AI features, and billing.

## 7. Tax, legal and accounting questions

The VAT, tax invoice, deposit and quotation questions are answered in `docs/locales/za/vat-and-documents.md`. The remaining items below are still open.

- Required fields on a South African tax invoice, and treatment of VAT on deposits and part-payments. (Answered from the VAT Act, SARS's VAT 404 guide and the Consumer Protection Act and its regulations in `docs/locales/za/vat-and-documents.md`.)
- Rules for credit notes and corrections, and for retention of records. (Answered in `docs/locales/za/vat-and-documents.md`: credit note particulars per guide 13.8.3, records kept at least five years.)
- Data stored in the EU: POPIA cross-border transfer conditions and privacy-policy wording (see ADR 0001).
- How comparable tools (for example FreshBooks, QuickBooks) handle editing, voiding and audit trails on issued invoices. This informs the lock-on-issue design. It has not yet been checked against those products.
- POPIA obligations for customer personal data.

## 8. Open questions

- Final product name, domain and branding of the app itself (see the decisions table).
- Deposit model: a deposit invoice, or a payment on account against a later invoice.
- Which product-import formats to support first (Shopify CSV, generic CSV).
- Front-end framework and host: decided, see `docs/adr/0001-stack.md`.
