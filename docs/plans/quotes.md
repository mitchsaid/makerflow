# Plan: quotes (layer 3, the first document)

Status: **proposed 2026-10-02, accounting questions researched and settled for now (see `docs/research/sars-vat-documents.md`, "Follow-up research"), awaiting founder approval. Nothing built.** Inputs: `docs/prototype-quotes-analysis.md` (what the prototype does and gets wrong), `docs/research/sars-vat-documents.md` (what SARS requires), `docs/plans/onboarding.md`, and the founder's answers below.

## Goal
A maker can build a quote on a phone in a couple of minutes, with exact money, a document that is correct for South African VAT, and a clear record of what was sent, revised, accepted or declined. Quotes are the first document, so what we build here (numbering, money maths, line items, snapshots, PDF) is the base for jobs and invoices.

## Decisions so far (founder, 2026-10-02)
1. **Deposits are structured:** a percentage or a fixed amount, when the balance is due, a business default with a per-quote override, and clear wording on the document. Payments are recorded later, in the invoice slice.
2. **Delivery and collection are a line on the quote** with an inline choice (Collection or Delivery plus a fee). Fees used before appear as quick chips. No preset manager.
3. **VAT entry is a business setting** (prices including or excluding VAT). The founder notes this also affects whether a document is a valid SARS tax invoice. Researched against the VAT Act and SARS's guide; see "Money and VAT" below.
6. **Nothing is required to send a quote beyond the minimum** (founder, 2026-10-02): no physical address. See "Minimum to send a quote".
4. **Error standard (a general product rule, to be written as an ADR):** buttons stay enabled; clicking shows what is missing at the fields and in a summary that jumps to the first problem; errors appear only after interaction; a small "still needed" hint is allowed; a button may be disabled only with the reason shown beside it.
5. Carried over from earlier decisions: quotes are first; progressive disclosure with friendly dismissable prompts; PDF first, hosted quotes later; name-only customers with a "this is a business" switch; products are optional and created from "Add new product" while building a quote; navigation is not reordered; business details are asked for at the first customer-facing document; services live parallel to products.

Proposed, not yet explicitly confirmed (unless the founder objects): numbering, customers, and inclusions and exclusions as described below.

## What the quote contains
- **Header:** number (assigned on first send; a draft shows "Draft"), issue date, valid-until date (default validity is a setting, with shortcuts such as 7, 14, 30 and 60 days), an optional **needed-by date** (new: makers work to event dates).
- **Customer:** picked or created inline (see "Customers").
- **Lines:** each has a kind (`product`, `service`, `custom`, `delivery`, `collection`), a name, an optional description, a **quantity** (decimals allowed, for example 0.5 kg), a unit price, an optional line discount, and a VAT treatment (standard-rated by default). Quote-level options are chosen from product options later; the first slice has typed lines and minimal products.
- **Quote-level:** optional discount (percentage or fixed), optional **deposit** (see below), **included** and **not included** lists, notes and terms, sign-off line.
- **Private (never on the document):** unit cost and margin per line when known, and customer notes shown while quoting.

## Money and VAT (the part that must be right)
- All amounts are **whole cents** (integers) with a currency code. There is one calculation module, shared by the server (authoritative, stored at issue) and the screen (live preview), with unit tests including rounding. No floating point.
- **Order of operations (documented and fixed):** line amount = quantity x unit price, rounded to the cent; line discount; quote discount allocated pro rata across lines (so VAT is computed on discounted amounts); VAT per line by its treatment; document totals are the sum of the rounded lines. This avoids the prototype's double tax and tax-after-discount errors (analysis items 2 and 3).
- **VAT setting on the business profile:** VAT registered or not (exists), and **prices entered including or excluding VAT** (new column). Each quote snapshots the mode and the rate used.
  - **Not VAT registered:** no VAT lines, no VAT number, and nothing is called a "tax invoice".
  - **VAT registered (VAT Act section 65):** a quoted price must include VAT and say so, **unless the total VAT, the price excluding VAT and the price including VAT are all shown**, and if both are shown they get **equal prominence and impact**. So both entry modes are allowed, **default inclusive**. Inclusive mode: the document states "All prices include VAT at 15%". Exclusive mode: the totals block shows total excluding VAT, the VAT amount and total including VAT at the same size and weight (SARS method 1). Line prices follow the chosen mode. Residual question for the accountant: whether line-level prices in exclusive mode also need the inclusive figure; we treat the totals block as the quoted price of the supply.
  - The rate (15%), the wording, the R5 000 threshold and the layout method come from the locale configuration (`app/src/lib/locale/za.ts`), never from screens. Zero-rated and exempt lines are a later addition; the line's VAT treatment field exists from the start.
  - **Delivery lines are standard-rated by default, whatever the goods' rating** (local transport of goods is a standard-rated service in SARS's guide, and a reported tax court decision held vendors' delivery fees attract VAT). Zero-rated and exempt goods come later and will need the accountant's view on delivering them.
- **Deposit amounts** are calculated from the total with a stated rounding rule, and the balance is total minus deposit, so the two always add up exactly.
- **Deposits and VAT (researched; chosen for now):** a made-to-order deposit is part of the price, so we treat it as a **part payment of the price**: VAT is due on it when received (VAT-registered makers) and a tax invoice for that amount is due within 21 days, following the pattern in SARS's own progressive-supply example (invoice the payment, then invoice the next amount "less already invoiced"). The invoice slice therefore issues a **deposit tax invoice** and a final invoice that shows the deposit already invoiced and paid, not an unallocated "payment on account". If the accountant says the section 9(1) deposit proviso covers maker deposits, VAT could wait until the deposit is applied. The quote only states the terms and calls it "deposit (part payment of the price)".

## Deposits
Terms on the quote: type (percentage or fixed), value, and **balance due** (on completion, on collection or delivery, or N days after). Business-level default (for example 50%, balance on completion) that a new quote starts from, with a per-quote override. The document says, for example: "Deposit to start work: R1 250 (50%). Balance R1 250 due on collection." Carried onto the job and invoice when those exist. Staged milestones (30/40/30) are deliberately not in this slice.

## Delivery and collection
One row at the bottom of the lines: a two-way choice, **Collection** (free; the document shows "Collect from" and the business address) or **Delivery** with a fee and an address (defaults to the customer's address, editable). Previously used delivery fees (label and amount) appear as quick chips, derived from past quote lines, so there is no preset table or manager. The row is a normal line, so it is taxed, shown on the document and editable like any other. The founder's "needed-by" idea doubles as the delivery or collection date.

## Inclusions and exclusions
Two short lists of single lines ("Included", "Not included"), shown on the document, behind a quiet "+ Add what's included". Lines the maker has used before are offered as one-tap suggestions (built from usage, not a managed library). No categories or structure beyond that. Free-text notes and terms stay separate.

## Numbering
A per-business sequence for quotes, with an **editable prefix and next number** (the same mechanism and table as invoices). The number is assigned **when the quote is first sent or marked sent**, so drafts never create gaps. It cannot be edited per quote. Sent quotes are never deleted (withdraw them). Revisions keep the number and add a version ("QT-0042 · v2"). Continuing from another system is "next number" in settings, which onboarding or the document reader can pre-fill. Quotes are not tax documents, so gaplessness is not a legal requirement here, but we keep it anyway for consistency with invoices.

## Customers (folded into this work; replaces "slice 2" in `docs/plans/business-profile-and-customers.md`)
- Name is the only required field. A "this is a business" switch reveals VAT number, company registration and contact person. Email, phone, billing and delivery addresses, and private notes are optional and can be added later, prompted when needed (nothing about the customer is needed to share a quote from the phone; an email address is needed only for the later in-app email; a business customer's address and VAT number are needed for a full tax invoice of R5 000 or more).
- Typing a new name in the picker offers "Add 'X'" and creates the customer on the spot, then offers "Add contact details". A duplicate check warns on the same name or phone.
- The quote **copies the customer's details when it is sent** (name, contact, addresses, VAT number), so later edits never change a sent quote. Drafts show live details.
- Customers are archived, never deleted. A customers list (search, add, edit, archive and restore) ships in the same slice. The prototype's unused retail or wholesale field is dropped.

## Lifecycle, revisions and records
- **Statuses:** draft, sent, accepted, declined, withdrawn; **expired is derived** from the valid-until date (the prototype never set it). "Viewed" arrives with hosted quotes. Transitions follow a table (for example a draft cannot be "accepted" without being sent or marked sent first); no free status dropdown.
- **Sending freezes a version.** Editing a sent quote creates a new version; older versions stay readable. Drafts can be deleted (they never had a number); sent quotes cannot.
- **Recording acceptance or decline** is manual for now: when, how (WhatsApp, email, in person), an optional note, and a decline reason that is stored. It does not auto-create anything. It then offers "Create a job?" and "Create an invoice?" as dismissable prompts, with the preference stored per person on the server, not in the browser. Those prompts appear only when jobs and invoices exist.
- **Activity log** per quote (created, sent, marked sent, revised, accepted, declined, withdrawn).
- **Snapshots at send:** customer details, product names and prices, and the cost of each line, so margins on past quotes do not drift when materials change.
- Lines reference a product by id or are custom. **No fuzzy name matching** anywhere.

## Sending and documents
- **PDF generated on the server** (React-PDF as in ADR 0001) from the stored quote, one clean default layout (templates and branding are layer 7). It carries the required VAT wording per the locale configuration, and an A4 layout that also reads on a phone preview.
- **Sharing:** the phone's share sheet (WhatsApp, email, messages) with the PDF, and **"Mark as sent"** for when the maker sent it another way. Both assign the number and freeze the version. **No real email sending in this slice**: it needs a custom sender on a domain we own (hardening item 4 in `docs/security-notes.md`). Hosted, online-acceptable quotes come later.
- The prototype's "Send quote" claimed to email the customer but sent nothing (analysis item 16). We will not pretend.

## Minimum to send a quote (founder, 2026-10-02: no more than the minimum)
Sending, sharing or marking a quote as sent **requires**:
1. The business name (already collected).
2. **A way to contact the maker:** a phone number or an email address.
3. **The VAT registration number, if the business is VAT registered** (with the section 65 price presentation above).
4. On the quote itself: a customer name, at least one line with a description, quantity and price, a valid-until date and the system-assigned number and date.

**Not required for a quote:** a physical address, a logo, banking details, a business registration number. (SARS's tax invoice rules and the Consumer Protection Act's sales-record rule, section 26, require the address of the premises on the **invoice**, not on a quote; the e-commerce rules apply to website offers.) Two just-in-time asks: choosing **Collection** asks where customers should collect (a suburb is fine); adding a **deposit** gently suggests adding a "how to pay" note, dismissably.

How it works on screen: tapping Send, Share or Mark as sent with a requirement missing does not block silently. Under the error standard, a small sheet appears listing exactly what is missing with the fields right there; saving them updates the business profile and **continues the action**. The quote also states what it covers and **until when** because the Consumer Protection Act (section 15(4)) stops a supplier charging more than an estimate it has given without the customer's authority, so a change of scope is a new version.

## Screens (mobile first; shadcn components; one accessibility case each)
- **Quotes list:** search by customer or number, status chips with counts (including a derived Expired), cards on phones, a table on wide screens.
- **Quote builder:** one scrolling form in sections (Customer, Items, Delivery or collection, Extras: discount, deposit, included, notes), a **sticky total bar**, and a line editor as a bottom sheet with quantity and price up front and discount, VAT treatment and notes behind "More". A **Preview** step shows the actual PDF. Drafts save as you go.
- **Quote detail:** the document, status and activity, and the actions that fit the status (share, mark sent, record accepted or declined, revise, quote again, withdraw).
- **Quote again:** copy any quote into a new draft (same customer or a different one).
- **Home:** the empty state invites the first quote.

## Errors (applies to every form, new and old)
Per decision 4. Components: field-level error text, a form summary with links to the first problem, a "still needed" hint. Messages say how to fix the problem ("Choose a customer so we know who the quote is for"). Typed data is never lost on a failed save; the server's validation errors map back to fields. A follow-up small slice retrofits the sign-in, onboarding and settings forms. Written up as an ADR when the first quote form is built.

## Delivery in thin slices (each its own PR, each with tests)
1. **Foundations:** the money module (cents, VAT order of operations, deposit and rounding, with unit tests), the shared document-number sequence (also used by invoices), the error standard ADR and components, the VAT-entry column on the business profile.
2. **Customers:** table, list, add, edit, archive, the picker (usable on its own).
3. **Quote draft builder:** header, customer inline, typed lines, totals, delivery or collection line, discount. Drafts only, saved server-side.
4. **Issuing:** number assignment, snapshot, server PDF, share, mark sent, status rules, derived expiry, activity log.
5. **Deposit, inclusions and exclusions, notes and terms** on the document and in the builder.
6. **Revisions, quote again, record accepted or declined,** and the later job and invoice prompts as those features exist.
7. **Minimal products and the line picker with "Add new product"** (name, price, description, kind). Options, price breaks, recipes and costs then arrive as the products work layers on, and the quote's private margin strip appears when costs exist.

Order note: slice 7 could move earlier if makers' first quotes should use products, but typed lines let the first quotes ship sooner.

## Database and security notes (human review required)
New tables (all with `organisation_id`, row-level security, the `session_required` restrictive policy, and tests): customers, quotes, quote_lines, quote_events, document_sequences, and later products. Issued (sent) quotes are immutable except through defined functions (status changes and revisions); enforce with grants, triggers and tests, in the same spirit as invoices. Numbering is assigned by a database function holding a row lock, tested for concurrency. Totals are computed on the server; the screen's numbers are a preview. **Touching RLS, money and tax logic, and migrations all need human review**, and the SARS points marked "to confirm" need the accountant.

## Tests
SQL: isolation between businesses, `session_required` and the guard, immutability of sent quotes, numbering (sequence, concurrency, no gaps from drafts), revisions. Unit: the money module (rounding, inclusive and exclusive VAT, discounts, deposits). Browser (phone viewport): build a quote with an inline customer, a typed line, delivery, a deposit; send or mark sent; revise; record accepted; derived expiry; every error message and the summary jump. Accessibility cases for each new screen. `pnpm perf` for each new protected page (one query for its main data).

## Open questions
1. Anything the accountant disagrees with in "Follow-up research" (exclusive-mode line display, deposits and the section 9(1) proviso, delivery of zero-rated goods). The choices made are the conservative ones.
2. Products before or after the builder (slice 7 position). Currently last so typed lines ship sooner.
3. Quantity precision: how many decimals, and which units (the prototype had an unreliable conversion system, so units stay a plain label until costing).
4. Whether the prescribed content of consumer estimates in the CPA regulations adds anything beyond a validity period and a breakdown (regulations not read).
