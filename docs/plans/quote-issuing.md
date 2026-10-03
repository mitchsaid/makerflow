# Plan: issuing a quote (slice 4 of `docs/plans/quotes.md`)

Status: **proposed 2026-10-03, awaiting the founder's answer on the open question below.** The decisions already made live in `docs/plans/quotes.md` ("Numbering", "Lifecycle, revisions and records", "Sending and documents", "Minimum to send a quote", "What every quote must say"); this plan only adds what slice 4 needs on top.

## What the maker can do
1. **Preview** a draft as the real PDF, at any time.
2. **Send** a draft, two ways, both of which assign the number and freeze the quote:
   - **Share PDF:** the phone's share sheet (WhatsApp, email, messages) with the PDF attached; on a computer, download.
   - **Mark as sent:** for a quote sent some other way.
3. If something the quote needs is missing, pressing Send opens a sheet listing exactly what (error standard): no customer, no items, or no way to contact the business (phone or email). The business contact fields are right there; saving them updates the Business profile and **carries on with the send**.
4. A **sent quote** opens as the document with its number, status and activity (created, sent or marked sent), and can be shared or downloaded again at any time. It can no longer be edited.
5. The **Quotes list** shows the number, and status chips with counts, including a derived **Expired** (valid-until date passed while still sent).
6. **Business profile > Quote numbers:** prefix and next number (to continue from another system), with a preview ("Your next quote will be QT-0042"). The number can never go backwards past one already used.

## Placeholders (visible, inactive, "coming soon")
Following the thin-slice rule, the sent quote's actions that belong to later slices are shown where they will live: **Revise** (new version, slice 6), **Record accepted or declined** (slice 6), **Quote again** (slice 6), **Withdraw** (slice 6), **Email to the customer** (needs our own email sender), **Send a link the customer can accept online** (hosted quotes). Deposit, inclusions and exclusions arrive in slice 5.

## The document (PDF)
- Made on the server with **React-PDF** (as `docs/adr/0001-stack.md` planned; written up as ADR 0006 when built). No headless browser.
- One clean A4 layout: business name and contact (and address and VAT number when on file), "Quotation", the quote number, date and valid-until, the customer's details, the lines (name, description, quantity, price, line total, discounts), delivery or collection, totals in the business's VAT mode (wording, rate and layout from the locale pack), notes, and "This quotation is not a tax invoice."
- It is drawn **only from the stored snapshot**, so a sent quote's PDF never changes, even if the business, customer or products change later.

## Data
- `quotes` gains: `number`, `version` (1 for now), `sent_at`, `sent_via` (shared or marked), `snapshot` (everything the document shows, frozen: business and customer details, lines with their amounts, totals, VAT mode and rate, the locale wording used, country and currency).
- `quote_events` (new table): an activity log per quote (created, sent, marked sent; later accepted, declined, revised, withdrawn). Row-level security, `session_required`, tests.
- Sending moves a quote from draft to sent in one transaction: check, number (`issue_document_number`, gapless, already built), snapshot, event. After that the existing policies already stop any change.
- Business profile numbering edits go through a checked function (owners and admins; the next number cannot go below the last issued).

## Open question: how the server is trusted to send
The snapshot holds the totals, worked out by our money code on the server. Two ways to write it:

1. **Server only (recommended).** Sending runs only on our server, using a server key the browser never sees; the database refuses send requests from anyone else. Nobody can create a sent quote with made-up totals, even by calling the database directly. The same mechanism is what tax invoices will need. **Founder step:** add the Supabase secret key to Vercel's environment settings (I give the exact steps; it never goes in chat, code or GitHub).
2. **A database function signed-in members can call**, which checks membership and stores the snapshot it is given. No new secret, but someone could call it directly and freeze their own quote with totals that don't match its lines. Acceptable for quotes (not tax documents); invoices would still need option 1.

## Tests
SQL: only drafts can be sent; numbers are gapless and per business; a sent quote and its lines cannot change; events per business; the send path cannot be reached by a signed-in user directly (option 1) or checks membership (option 2); numbering settings. Unit: snapshot building, the PDF content. Browser (phone): preview, send by share and by mark-as-sent, the missing-details sheet carrying on with the send, a sent quote is read-only with its placeholders, expiry, numbering settings. Accessibility for every new screen and sheet.
