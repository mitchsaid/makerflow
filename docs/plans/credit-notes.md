# Plan: credit notes (slice I4 of invoices and payments)

Status: **built 2026-10-18** (see "Built" at the end), founder: "Do credit notes." Follows `docs/plans/invoices-and-payments.md` (I1 and I2 are built). One slice; it changes the database (**money, tax documents, immutability, numbering and migrations: human review**).

A credit note is how an issued invoice is corrected: the invoice never changes, a credit note lowers what is owed on it. It is a tax document: numbered without gaps, never changed, never deleted (`CLAUDE.md`).

## Where things stand
- Invoices (immutable, numbered `INV-`, from a snapshot), payments (append-only, reversals), the status worked out, Home's owing and overdue.
- `document_sequences` already allows `credit_note` (`CN-`); `issue_document_number` is the one place numbers are given. `set_document_numbering` still refuses credit notes; a test asserts it.
- The invoice page already says "Credit note: coming soon" and "correct this invoice without changing it".
- `docs/locales/za/vat-and-documents.md` answer 7 / guide 13.8.3: a credit note carries the words "credit note", the supplier's name, address and VAT number, the recipient's name and address (unless the invoice was abridged), the date, **the amount by which the value and the VAT changed**, a brief explanation, and enough to identify the original invoice (**number and date**).
- Not there: credit notes, a refund, stock (so "put it back in stock" has nothing to update).

## Prototype read
Read in full on 2026-10-18: `CreateCreditNoteModal.tsx` (all 407 lines), `createCreditNote`, `updateCreditNote`, `deleteCreditNote` in `hooks/useAppState.ts`, the `CreditNote`, `CreditNoteLineItem`, `CreditNoteReason` types and the invoice's `creditedAmount`/`creditNoteIds`, in `Invoices.tsx` the list buttons and filter, the detail header button, the credit-notes ledger card and the view modal, in `DocumentRenderer.tsx` every `isCreditNote` branch, and the credit use in `Customers.tsx` and `CustomerStatementModal.tsx` (credit rows, header only otherwise).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| "Credit" button on every list row and "Issue Credit Note" on the detail (disabled when fully credited); "Issue Another Credit Note" on the ledger card | **Kept on the invoice page** (Credit notes section, Issue a credit note). Not on list rows: the list opens the invoice | One place to do something that changes money; a phone list row stays a link |
| Modal: reason (6 SARS reasons), date (default today), notes prefilled "SARS Section 21 Credit Note for invoice X" | **Kept, changed:** reason from a short list in the locale pack (the same six, in plain words), date (today, not before the invoice, not ahead), **an explanation the maker writes** (SARS asks for a brief explanation; a pre-filled legal sentence says nothing) | |
| Tick the items to credit, all ticked at first; each with a quantity (1 to what was invoiced), a **credit rate** (price each, any value from 0) and "restock" | **Kept, changed:** tick the items; quantity (`QuantityField`, 0 allowed for a price change, up to what is left); **the amount credited** (money, up to what is left of that item), ready filled in as the share of the item's invoiced amount for the quantity. Nothing is ticked at first (crediting everything is a decision) with a "Credit everything left" shortcut | A rate x quantity could exceed the invoiced amount; the amount cap is what keeps a credit within the invoice |
| Nothing stops crediting the same item again and again, or more than the invoice | **Fixed:** each item can be credited only up to the quantity and amount left after earlier credit notes; the invoice's total credited can never pass its total (checked in the database) | The prototype can credit R100 on a R50 invoice |
| Invoice discount handled as a ratio for percentage discounts only (a fixed discount is ignored); VAT as `total - total/1.15`; floats | **Fixed:** the invoice's whole-quote discount is already shared across its items in cents; VAT per VAT status on the credit's own amounts, in the business's entry mode, rounded once per status, and never more than the invoice's VAT left (so a fully credited invoice credits exactly its VAT) | `docs/locales/za/vat-and-documents.md`; money is never a float |
| Number `CN-<year>-<count + 1>` from the array length | **Changed:** gapless per business, given only when issued, by the one checked server function; prefix and start set under Quotes and invoices like the others | Legal; `prototype-discovery.md` item 1 |
| Status of the invoice: `credited` / `partially_credited` set by hand-kept `creditedAmount` | **Changed:** worked out from the credit notes: **Credited** when everything is credited; otherwise the usual status on what is still owed (invoice total less credit); the page says "Credited R x" | A stored amount can drift |
| A credited, already-paid invoice: nothing | **New:** if more was paid than the invoice now comes to, the page says what the customer is owed back; recording a refund is a visible "coming soon" | Money that needs saying |
| Optional restock of returned items into the product's stock | **Later:** stock does not exist yet; the sheet shows "Put returned items back in stock" as coming soon | Thin slice rule |
| Credit note document: "Tax Credit Note" (VAT-registered) or "Credit Note", "Credit Issued To", banner with the original invoice number, its date and the reason, total labelled "Total Credit", no due date | **Kept, locale-driven:** the same pipeline, themes and PDF as invoices; the words, the reference to the invoice (number and date) and the reason come from the locale pack | `vat-and-documents.md` 13.8.3 |
| Ledger card on the invoice (count, credited against total, each note with number, amount, date, reason, items, View Document) | **Kept:** Credit notes section on the invoice page, each linking to the note | |
| View modal with Download PDF and Print | **Kept as a page** with the PDF preview and Share/Download (Print is the PDF's print) | Same as quotes and invoices |
| **Edit** a credit note (`updateCreditNote`) and **delete** one (`deleteCreditNote`, which subtracts the amount again) | **Dropped:** never changed, never deleted. A credit note that was wrong would need a new invoice or a debit note (not built) | Immutable tax documents |
| Customer page lists their credit notes and a count; the statement shows credit rows | **Later:** statements are not planned; the customer page link comes with them | |
| Reason list incl. "Other" with the notes | **Kept** | |

### Missed from the prototype
(None yet. Anything found while building is listed here, with what it cost.)

## What the maker sees
- **On an invoice:** a **Credit notes** section: the notes issued (number, day, reason, amount; each opens the note), what is credited so far, and **Issue a credit note**. The invoice shows **Credited** beside Total, Paid so far and Owing. When everything is credited its status is **Credited**.
- **The sheet:** why (reason), the day, the items on the invoice each with a tick, and for a ticked item **how many** and **how much** (ready filled in), what is left to credit under each; **Credit everything left**; a short explanation; the credit note's total (with VAT) updating as they type; and the plain fact that it gets the next credit note number and can't be changed. "Put returned items back in stock" is a coming-soon card. **Issue credit note** opens it.
- **The credit note page:** like the invoice's: the PDF, Share/Download, who and what for, the invoice it corrects (link), its history. Nothing edits it.
- **Money consequences:** what is owing drops by the credit; a payment can't pass what is now owing; if the customer has already paid more than the invoice now comes to, the page says "They have paid R x more than this invoice now comes to" and offers a coming-soon "Record a refund".

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| The sheet | Right-hand sheet with `FormErrorScope` + `FormSummary` (create-invoice, record-payment) | As is |
| Reason | `SelectField` (the pack's short list) | As is |
| Day | `TextField type="date"` | As is |
| How many of an item | `QuantityField` (with the item's unit, `numberStyle`) | As is, 0 allowed (`min`) |
| How much | `TextField` with `startText` (currency symbol), `parseMoney` | As is |
| Tick an item | Checkbox as the deposit and "Ask for a deposit" do | As is |
| Explanation | `TextAreaField` | As is |
| Document preview, Share/Download | `PdfPreview`, `sharePdf`, the quote/invoice PDF pipeline (a snapshot with a `creditNote` block) | **With a document kind**, as the invoice did; not a copy |
| Number | `issue_document_number` inside the issuing function | As is |
| Numbering settings | `QuoteNumberingForm` (`docType`) | A third document type |
| Status chip, activity list, margin etc. | Invoice page pieces | As is |
| Coming-soon cards | `ComingSoonSection` | As is (restock, refund) |

**Inputs by kind (`docs/ux-inputs.md`):** reason (choice, `SelectField`), day (date), quantity (`QuantityField`), amount (money), explanation (words). No address, customer or item picker is asked for: they come from the invoice.

## Decisions (recommendations in bold)
1. **A credit note is for one invoice, issued from it; several are allowed** until everything is credited. *Recommended.*
2. **Credit by item:** quantity (may be 0 for a price change) and amount, each capped at what is left of that item. The money is in the amount (no rate x quantity); the quantity is for the document and for stock later. *Recommended.*
3. **VAT is the credit's own:** worked out per VAT status on the credited amounts in the invoice's entry mode (the snapshot's VAT settings, not today's), capped at the VAT left, so crediting the whole invoice credits exactly its VAT.
4. **The invoice is untouched.** Credited, owing and status are worked out from the credit notes. Payments cap at what is now owing.
5. **No edit, no delete, no void.** To undo a credit note you would issue a debit note or a new invoice; neither is built, so the sheet says "This can't be undone" plainly. *Founder to confirm that is acceptable for now.*
6. **Refund is not recorded yet**; the page states what is owed back.
7. **Credit note numbers** (`CN-`) are set under Quotes and invoices with the others.
8. **Reasons (ZA):** goods returned or defective; order cancelled or reduced; price or billing correction; discount or rebate allowed; damaged or short delivered; other.
9. **Issue date** not before the invoice's, not ahead of today.

## Data (sketch)
- `credit_notes`: id, organisation, `number` (unique per business), `invoice_id` (+ `invoice_number`), customer name, `issue_date`, `reason` (key), `explanation`, currency, net/VAT/gross cents, `snapshot` (the document), `issued_by`, `created_at`. No grants to write; update/delete/truncate refused by triggers; restrict on the business. Member read + `session_required`.
- `credit_note_lines`: credit note, `line_index` (the invoice's item), `quantity_milli`, `amount_cents`, and the item's limits as the server worked them out (`line_limit_quantity_milli`, `line_limit_amount_cents`). Same protections.
- Server-only `issue_credit_note(...)`: locks the invoice (the same row lock payments take), checks the dates, that each item's limits match earlier notes' and its running total stays within them, that net + VAT = gross, that **the total credited stays within the invoice total**, takes the number in the same transaction, inserts note and lines.
- Replaced: `record_invoice_payment` and the payment trigger (owing = total - credited - paid), `invoice_owed_totals` (same), `set_document_numbering` (credit notes allowed).
- `delete_account` is unchanged: a business with credit notes has invoices, so it is refused already; the test that fails on a credit notes table is updated to say so.

## Slices
**I4 (this plan), one slice:** migration and function, snapshot builder and totals, the document (PDF and text) with the credit note's words, the invoice page section and status, the sheet, the credit note page and PDF, numbering settings, Home/list/payment awareness, tests.

## Tests
SQL: isolation, session required, immutability for every path, server-only, number gapless (and the 30-connection race for `credit_note`), per-item and total caps (including two notes racing the same invoice), the money adds up, payments and owed totals after a credit, numbering settings. Unit: item limits and defaults, totals and VAT clamping (inclusive and exclusive, mixed VAT statuses, full credit in two parts equals the invoice), the form, the status with credits, the document words. Browser: credit part, then the rest, see the number/PDF/owing, a payment can't pass what is owing, the refund note, nothing edits a credit note. Accessibility: the sheet, the invoice with credit notes, the credit note page.

## Questions for the founder
1. **A credit note can't be undone or deleted** (decision 5); if it was wrong, the fix is a new invoice (and a debit note later). OK for now?
2. **Refund** is stated, not recorded, in this slice (decision 6). OK?

## Not planned yet
Debit notes, recording a refund, putting returned items back in stock, credit notes on a customer's page and statements, emailing, a list of all credit notes (they are reached from their invoice).

## Built (2026-10-18; needs human review: migration `20261117100000_credit_notes.sql`, money, a tax document that must never change, gapless numbering, two new tables with RLS, a new server-only `issue_credit_note`, replaced payment/totals/numbering functions)
- **Database.** `credit_notes` and `credit_note_lines`: append-only (no grants; triggers refuse update, delete and truncate), restrict on the business. `issue_credit_note` (service role only) takes the invoice's row lock (shared with payments), checks the reason, a written explanation, the day (not before the invoice, not ahead), each item's limits (unchanged between notes; running quantity and amount within them), that the money adds up, that **the total credited never passes the invoice's total**, takes the number from `issue_document_number` in the same transaction. `record_invoice_payment`, the payment trigger and `invoice_owed_totals` now use total - credited - paid. `set_document_numbering` allows `credit_note`. Tests: `credit_notes.test.sql` (everything above, plus isolation, session required, server-only, member read), the 30-connection race for `credit_note` numbers.
- **The money.** An item's limit is its amount after its own discount and its share of the whole-invoice discount (shared in exact cents, as the invoice's totals were). VAT is worked out once per VAT status in the invoice's entry mode and never passes the VAT left; the credit that takes the last of a status takes exactly the last of its VAT (unit-tested for inclusive and exclusive: a whole invoice credited in two notes credits its exact total and VAT).
- **Screens.** On the invoice page: **Credit notes** (each note, credited so far, **Issue a credit note**), **Credited** beside Total and Owing, the status **Credited** when everything is credited, **Nothing is owing** instead of Record a payment, and, when more was paid than the invoice now comes to, "They have paid R x more than this invoice now comes to" with a coming-soon **Record a refund**. The sheet: why, the day, the items (tick, how many, amount credited, what is left), **Credit everything left**, the explanation, the live total with VAT, a coming-soon "Put returned items back in stock". The credit note page (`/app/credit-notes/[id]`): PDF, Share/Download, why, the invoice it corrects, activity. The invoice's PDF shows **Total credited** and **Amount due**. Invoices list: a **Credited** filter, and "R x credited" / "R x owing" on a row. Credit note numbers are set under Quotes and invoices with the others. Home's owing follows.
- **Decisions taken (veto any):** nothing ticked at first; an explanation is required (no pre-filled legal sentence); quantity may be 0 for a price change; a credit note can't be undone (a debit note or a new invoice would be needed, neither is built).
- **Missed from the prototype:** none new. Not read in full: the customer statement (header and credit rows only), still not planned.
- **Review follow-ups (same PR):** the rules now hold for every insert, not only through `issue_credit_note` (triggers check the invoice total and each item's limits, so code holding the server key can't break them); two credit notes issued at the same moment can no longer leave an invoice owing a few cents (the note that takes the last of the invoice's amounts must take exactly the rest of its total, else the database asks the server to read again and retry once); `reverse_invoice_payment` returns the owing figure with credits; zero is read however it is written ("0,00"); the tax name comes from the invoice's document; a credit line keeps its item's description and variation. Known: a part-quantity credit can print a unit price that doesn't multiply out to the cent (the amount is exact).
