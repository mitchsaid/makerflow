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
| Quotes out | PDF first. A hosted, online-viewable and acceptable quote comes later. |
| Time tracking | Feeds labour cost only if the maker chooses (a per-user setting). |
| AI | Expected eventually. Not in early slices. |
| Onboarding | Not in the prototype. Wanted: import an existing product list (for example a Shopify export) to seed the product set with sensible configuration. |
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

## 5. Delivery layers (proposal)

0. **Walking skeleton:** landing page, sign-up and sign-in, empty organisation, database with migrations, dev and prod environments, CI, error tracking.
1. **Business profile and customers.**
2. **Custom invoice, VAT-aware, immutable on issue, gapless numbering, branded PDF.** Payments, deposits and credit notes follow directly.
3. **Quotes with revisions, PDF, and convert-to-invoice.**
4. **Jobs and fulfilment tracking, and the "create invoice?" prompt.**
5. **Materials, products and costing, and margin.**
6. **Templates and branding customisation.**
7. **Stock (raw materials and finished goods).**
8. **Product import and onboarding.**
9. **Hosted quotes with online acceptance.**
10. **Employees, roles, permissions.**
11. **AI features, and paid plans once decided.**

Layers 5–7 can be reordered after user feedback. The data model is designed for all of them up front.

## 6. Non-goals for now

Accounting-package integrations, native mobile apps, other countries, online payment gateways, AI features, and billing.

## 7. To verify with an accountant before launch

- Required fields on a South African tax invoice, and treatment of VAT on deposits and part-payments.
- Rules for credit notes and corrections, and for retention of records.
- Data stored in the EU: POPIA cross-border transfer conditions and privacy-policy wording (see ADR 0001).
- How comparable tools (for example FreshBooks, QuickBooks) handle editing, voiding and audit trails on issued invoices. This informs the lock-on-issue design. It has not yet been checked against those products.
- POPIA obligations for customer personal data.

## 8. Open questions

- Final product name, domain and branding of the app itself (see the decisions table).
- Deposit model: a deposit invoice, or a payment on account against a later invoice.
- Which product-import formats to support first (Shopify CSV, generic CSV).
- Front-end framework and host: decided, see `docs/adr/0001-stack.md`.
