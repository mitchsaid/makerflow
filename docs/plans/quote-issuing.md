# Plan: issuing a quote (slice 4 of `docs/plans/quotes.md`)

Status: **approved and built 2026-10-03** (founder confirmed all four decisions below). Written up in `docs/adr/0006-issuing-pdf-and-server-key.md`; migration `20261004100000_quote_issuing.sql`. The decisions already made live in `docs/plans/quotes.md` ("Numbering", "Lifecycle, revisions and records", "Sending and documents", "Minimum to send a quote", "What every quote must say"); this plan only adds what slice 4 needs on top.

## What the maker can do
1. **Preview** a draft as the real PDF, at any time.
2. **Send** a draft, two ways, both of which freeze the quote (it already has its number):
   - **Share PDF:** the phone's share sheet (WhatsApp, email, messages) with the PDF attached; on a computer, download.
   - **Mark as sent:** for a quote sent some other way.
3. If something the quote needs is missing, pressing Send opens a sheet listing exactly what (error standard): no customer, no items, or no way to contact the business (phone or email). The business contact fields are right there; saving them updates the Business profile and **carries on with the send**.
4. A **sent quote** opens as the document with its number, status and activity (created, sent or marked sent), and can be shared or downloaded again at any time. It can no longer be edited.
5. **Revise** a sent quote (brought into this slice, founder 2026-10-03): it opens as a new draft version with the same number ("QT-0042 · v2"); sending it freezes v2, and earlier versions stay readable from the quote's activity.
6. The **Quotes list** shows the number, and status chips with counts, including a derived **Expired** (valid-until date passed while still sent).
7. **Quotes and invoices > Quote numbers:** prefix and next number (to continue from another system), with a preview ("Your next quote will be QT-0042"). The number can never go backwards past one already used.

## Placeholders (visible, inactive, "coming soon")
Following the thin-slice rule, the sent quote's actions that belong to later slices are shown where they will live: **Record accepted or declined**, **Quote again** and **Withdraw** (built in slice 6, `docs/plans/quote-outcomes.md`), **Email to the customer** (needs our own email sender), **Send a link the customer can accept online** (hosted quotes). Deposit, inclusions and exclusions arrive in slice 5.

## The document (PDF)
- Made on the server with **React-PDF** (as `docs/adr/0001-stack.md` planned; written up as ADR 0006 when built). No headless browser.
- One clean A4 layout: business name and contact (and address and VAT number when on file), "Quotation", the quote number, date and valid-until, the customer's details, the lines (name, description, quantity, price, line total, discounts), delivery or collection, totals in the business's VAT mode (wording, rate and layout from the locale pack), notes, and "This quotation is not a tax invoice."
- It is drawn **only from the stored snapshot**, so a sent quote's PDF never changes, even if the business, customer or products change later.

## Data
- `quotes` gains: `number`, `version`, `last_sent_at`. A new `quote_versions` table holds each send: version, sent time, `sent_via` (shared or marked) and the `snapshot` (everything the document shows, frozen: business and customer details, lines with their amounts, totals, VAT mode and rate, the locale wording used, country and currency).
- Each version is kept: revising copies the sent version into a new draft version under the same number; the sent one stays frozen with its snapshot.
- `quote_events` (new table): an activity log per quote (created, sent, marked sent, revised; later accepted, declined, withdrawn). Row-level security, `session_required`, tests.
- Sending moves a quote from draft to sent in one transaction: check, number (`issue_document_number`, gapless, already built), snapshot, event. After that the existing policies already stop any change.
- Quotes and invoices numbering edits go through a checked function (owners and admins; the next number cannot go below the last issued).

## Decisions (founder, 2026-10-03)
1. **Only our server can send.** Sending runs on our server with a server key the browser never sees; the database refuses send requests from anyone else, so nobody can freeze a quote with totals that don't match its lines, even by calling the database directly. Invoices will use the same path. **Founder step before this ships:** add the Supabase secret key to Vercel's environment settings (exact steps given at the time; it never goes in chat, code or GitHub).
2. **Revise is in this slice** (see "What the maker can do", item 5), not a placeholder.
3. **Sending options:** Share PDF (download on a computer) and Mark as sent work; Email to the customer and the online link are visible "coming soon".
4. **Numbering: a number is given when the draft is first saved and shown on it** (founder, 2026-10-03, after comparing Xero, Zoho, QuickBooks and Invoice Ninja). Deleting a never-sent draft leaves a gap, allowed for quotes. A revision keeps the number. Invoices stay gapless and are numbered when issued.

## What was built beyond this plan
- Quotes list: status filter chips with counts, number and version on each row.
- A sent quote shows its versions, and `?version=` opens an earlier one; PDFs per version.
- The PDF embeds Noto Sans; emoji and symbols are dropped from the PDF only.
- **Not built (shown as "coming soon"):** email, online link. (Accepted/declined, quote again and withdraw were built in slice 6.) **Not built, not shown:** discarding a revision to go back to the sent version (opening Revise by mistake means sending version 2 unchanged for now).

## Tests
SQL: only drafts can be sent; numbers are gapless and per business; a sent quote and its lines cannot change; events per business; the send path cannot be reached by a signed-in user directly; revising keeps the number, adds a version and leaves the earlier one unchanged; numbering settings. Unit: snapshot building, the PDF content. Browser (phone): preview, send by share and by mark-as-sent, the missing-details sheet carrying on with the send, a sent quote is read-only with its placeholders, expiry, numbering settings. Accessibility for every new screen and sheet.

## Preview step and designs (founder, 2026-10-03: "the step after a quote draft should be a preview ... eventually choose different designs/templates, and download or send")
Decisions (all the recommended options): the preview shows **the real PDF drawn on the screen** (pdf.js, loaded only there); **Preview is the next step** after a draft (the draft's main button is Preview, which saves first; Send lives on the preview, next to Edit and Download); the preview has a **Design** section with one design (Classic) in use and "More designs" and "Your logo and colours" as visible "coming soon"; a **sent quote opens on the same document screen** (its frozen PDF, with Share, Download and Revise).
- A design is a set of styles keyed in `app/src/lib/quotes/designs.ts` and `pdf/designs.ts`. Each sent version records its design (`snapshot.design`; absent means classic), and a released design is never edited, only added to, so a sent quote never changes when designs do.
- The pages are pictures, so the same snapshot is kept as text for screen readers (the former on-screen document, now visually hidden).
- When a fix is needed (no customer, no items...), the Send sheet takes you back to the edit screen and lands on the field.
- Not built: choosing a design, logo and colours (need a place to store them per business); zooming the preview (it fits the screen width; use Download for the full-size document).
