# Plan: customer statements

Status: **planned and built 2026-10-19** (see "Built" at the end), after the founder asked "What about statements?" (the prototype's customer statement was the one invoice-side feature still not read in full or planned). One slice. **No database change** (a statement is a view, not an issued document).

A statement of account tells one customer what they owe: their invoices, what they have paid and been credited, a running balance, how old what is owing is, and how to pay. It is **not** a tax document: it is not numbered, not stored and not frozen. It is drawn from the invoices, payments and credit notes as they are today, dated "as at" today; a PDF the maker shares is a copy that later changes never alter.

## Where things stand
- Invoices (customer, due day, total), payments (append-only, reversals), credit notes, the amount owing worked out per invoice (`lib/invoices`), bank details with an optional payment reference (`lib/bank`), the document PDF pipeline and its fonts (`lib/quotes/pdf`), the customer page (an edit form), the Invoices list.
- Not there: anything that adds an invoice's, payment's and credit note's entries into one customer ledger.

## Prototype read
Read in full on 2026-10-19: `CustomerStatementModal.tsx` (all 522 lines), the `StatementTransaction` and `AgingSummary` types, and in `Customers.tsx` the "Generate Statement" buttons and the credit-note rows that open it (the customer detail and the list).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| "Generate Statement" on the customer's detail screen (and a credit note row opens it too) | **Kept:** a **Statement of account** link on the customer's page, to a page of its own | |
| A modal with live ledger, ageing and remittance for the customer | **Changed:** a page (the app's way: a document page with a PDF preview, Share/Download, a text version for screen readers) | Same as invoices and credit notes |
| Ledger: invoices (debit) and credit notes (credit), oldest first, running balance, with date, type, reference, description ("Tax Invoice - 2x Cake, ..."), debit, credit, balance | **Kept**, and **payments are added** (credit, on the day received) and a reversed payment shows as a debit "Payment reversed" | The prototype had no payments (its `Payment` type was unused) |
| Period chips: All time, This month, Last 30 days, Last 90 days, Year to date (a "custom" range exists in state but has no screen) | **Kept** (the same five); the unused custom range **dropped** | |
| A period drops the earlier rows, and the running balance **starts again at zero** | **Fixed:** an **opening balance** (what was owing before the period) is carried forward, so the closing balance is right whatever the period | A statement for the last 30 days that said R0 owing before an unpaid old invoice would be wrong |
| Status filter "Outstanding / Unpaid only" (hides paid invoices **and every credit note**) | **Changed:** "Only what is owing": the invoices that still have something owing, with their payments and credit notes, so the balance equals what is owing | A credit note against an open invoice is part of why its balance is what it is |
| Account overview: total invoiced (all time), total credit notes, current amount due | **Kept**, for the chosen period; plus **paid in the period**; "current amount due" is the closing balance | |
| Ageing: Current (0-30), 31-60, 61-90, 90+ days from the **invoice date** (changed 2026-10-20, see "Built"), on invoices not marked paid, less credited | **Kept** (from the invoice date, as the prototype did; a business may read it from the due day: founder's call), on what is still owing after payments and credit | Payments now count |
| Header: logo, business name, tagline, address, phone, email, VAT number (if registered); "Statement of Account"; statement date; account reference (name cut to 12 capitals); currency | **Kept** from the business profile; no tagline (not in MakerFlow); the reference is the customer's name, used as the payment reference when the business asks for one | |
| Customer block: name, contact person, billing address, phone, email, company registration and VAT number | **Kept** | |
| Remittance advice with **bank details, falling back to invented defaults** ("FNB", "62849102844", "250655") when none are saved | **Fixed:** only the business's saved bank details, or no bank block; **never invented ones** | An invented account number on a document a customer pays into |
| "Please use <name> as your payment reference"; "Email proof of payment to <email>"; a thank-you line | **Kept** as the reference line (when the business asks for a reference) and the business's email; no hard-coded thank-you | The brand line was the demo company's |
| Copy Summary (text to the clipboard with the balance and the banking details) | **Later:** Share PDF covers sending it | |
| Download PDF, Print | **Kept:** Share/Download PDF (print is the PDF's print) | |
| Click an invoice or credit note row to open it (`onSelectInvoice`) | **Kept on screen:** each row links to its invoice or credit note | |
| Statement is live: nothing is stored, nothing is numbered | **Kept** | A statement is a view |
| Credit notes list and a count on the customer screen | **Later:** the statement shows them; a count on the customer page is not planned | |

### Missed from the prototype
(None yet. Anything found while building is listed here, with what it cost.)

## What the maker sees
- On a **customer's page**: **Statement of account** (a link). It opens the statement page.
- The **statement page**: the customer, the period chips (the same chip buttons as the Invoices list), **Only what is owing** (a tick), a summary (what was owing before, invoiced, credited, paid, **balance**), the ageing in four boxes, the real PDF (preview, Share/Download), and a table of the entries for screen readers and anyone who wants to tap a row to open the invoice or credit note. With nothing to show: a title and one line.
- The **PDF**: the business (logo, address, VAT number), "Statement of account", the date, the customer, the summary, the ageing, the entries with a running balance, and how to pay (bank details, and the customer's name as the reference when the business asks for one).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Period | Filter chip buttons (`aria-pressed`) as on the Invoices and Jobs lists | As is; the choice is in the address (`?period=`), so the PDF and a reload keep it |
| Only what is owing | Checkbox as the deposit tick | As is (`?owing=1`) |
| The document | `PdfPreview`, `ShareDocument`, the PDF pipeline (fonts, logo, business details) | A **new document drawing** (a ledger, not items and totals): new component, same fonts, logo and styles' basics; not a copy of the quote drawing |
| Bank details | `bankLines(bank, reference, locale)` | As is |
| Money, dates | `formatMoney`, `formatDay` | As is |
| Back | `PageHeader` | As is |

**Inputs by kind (`docs/ux-inputs.md`):** a period (a choice, chips), "only what is owing" (a tick). No address, quantity, date or amount is typed.

## Decisions (recommendations in bold)
1. **A view, not a stored document:** no number, no snapshot, no table. *Recommended.* Sharing a PDF is the maker's choice; it is a copy.
2. **Ageing from the invoice date** (as the prototype), in four boxes: current (0 to 30 days), 31 to 60, 61 to 90, over 90. *Recommended; founder to confirm (some read it from the due day).*
3. **Payments and reversals are entries** (credit and debit) so the running balance is the real one.
4. **An opening balance** for any period but "All time".
5. **Credit on account:** an invoice paid more than it now comes to (a credit note after a payment) is shown as "Credit on account" and not netted against another invoice's age.
6. **Never invented bank details.**
7. **One currency per business;** amounts are added as they are.

## Data
Nothing new in the database. One read for the customer's invoices (`customer_id`), each with its payments and credit notes embedded and the item names from its document, under the person's own row-level security. The sums, the ledger and the ageing are plain code (`lib/statements`), unit-tested.

## Slices
One: the page, the PDF, the link, tests.

## Tests
Unit: the ledger (order, running balance, opening balance for each period, a reversal, a credit note after a payment), the ageing buckets (the day boundaries), only-what-is-owing, credit on account, the period dates. Browser: an invoice with a payment and a credit note, then the statement: the rows and balance, a period that carries the opening balance, only what is owing, the PDF is a PDF, the rows link to their documents. Accessibility: the statement page and an empty one.

## Questions for the founder
1. **Ageing from the invoice date or the due day?** (decision 2)
2. A statement per customer only (no "all customers owing" list) for now: the Invoices list already filters Unpaid and Overdue. OK?

## Not planned yet
Emailing a statement, a statement run for every customer, reminders, copy-the-summary, a custom date range, a customer-side "view my statement" link (hosted pages, layer 10).

## Built
2026-10-19, one slice, no database change.
- **Page:** `/app/customers/[id]/statement`, linked from the customer's page ("Statement of account"). Period chips (All time, This month, Last 30 days, Last 90 days, Year to date) and "Only what is owing" are links (`?period=`, `?owing=1`), so a statement can be bookmarked and the PDF follows the same choices. Summary, ageing, the real PDF (`PdfPreview`, Share or Download), and the same statement as a text table for screen readers, each row linking to its invoice or credit note.
- **PDF:** `/app/customers/[id]/statement/pdf` (`lib/statements/pdf`), drawn from the live figures, never stored, never numbered. Bank details only when the business has entered them and something is owing.
- **Logic:** `lib/statements` (ledger, opening balance, ageing, credit on account), `data.ts` (one read), `load.ts` (shared by page and PDF). Words in the locale pack (`documents.statement`).
- **Tests:** 11 unit tests; `e2e/statements.spec.ts`; accessibility case.
- **Ageing, decided 2026-10-20 (founder):** by days past the **due day**, not the invoice date: Not yet due, 1 to 30, 31 to 60, 61 to 90 and over 90 days overdue (nothing is overdue on the due day itself). This matches "Overdue" on the Invoices list, and an invoice on short terms is not shown as current when it is late. Accounting packages mostly age this way; older month-end statements use the invoice date. No setting: add invoice-date ageing only if an accountant asks.
- **Still open for the founder:** per-customer statements only.
