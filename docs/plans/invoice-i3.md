# Plan: the rest of invoicing (I3)

Status: **I3a, I3b and I3c planned and built 2026-10-22** (see the "Built" sections). Founder, 2026-10-22: "do ... I3, the rest of invoicing: a prompt to invoice when a job finishes, an invoice with no quote, and an editable draft." Parent plan: `docs/plans/invoices-and-payments.md` (its "I3 (later)").

Three slices, each its own pull request:
- **I3a: the prompt to invoice when a job finishes.** No database change.
- **I3b and I3c: an invoice with no quote, and an editable draft.** One piece of machinery (a draft invoice that can be edited and then issued). Needs a migration (human review) and is planned when it starts.

## Where things stand
- An accepted quote shows **Create invoice** (a sheet: invoice date, due day, note), which issues a numbered invoice from the quote's last sent version.
- A job made from a quote knows its quote; a job can be moved to Done. Nothing links a finished job to an invoice.
- Friendly, dismissable prompts are remembered per person (`prompt_dismissals`): the logo prompt, the "Create a job?" card after "They accepted".

## Prototype read
The prototype has **no prompt on a finished job**: it makes an invoice automatically when a quote is accepted (`recordQuoteAccepted` calls `convertQuoteToInvoice`) and a job's Done does nothing to invoices. Read in full 2026-10-17 (`Invoices.tsx`, `useAppState.ts`; see `invoices-and-payments.md`, "Prototype read"); the Jobs screen was read in full for `jobs-and-invoices.md`. The founder chose a prompt, not an automatic invoice (an invoice is a tax document; 2026-10-11). I3b and I3c's read is in `invoices-and-payments.md` ("Direct invoice with no quote", "Edit an invoice"); they get their own table when planned.


| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Accepting a quote creates the invoice automatically and moves the job to Not Started | **Changed (I3a):** nothing is automatic; a finished job offers to invoice, and the maker chooses | An invoice is a tax document; founder, 2026-10-11 |
| Marking a job Done changes nothing about invoices | **Added:** the prompt on a Done job, and the invoice shown on the job | The founder asked for it |
| Direct invoice with no quote (and a job made behind it) | **Later (I3b)**, with no job made behind the maker's back | `invoices-and-payments.md` |
| Edit an invoice at any time | **Later (I3c):** an editable draft before issuing; an issued invoice never changes | Issued documents are immutable |

## I3a: what the maker sees
- A job that is **Done**, was made from a quote, and has no invoice yet shows a card at the top: **"Invoice QT-0001?"**, "The job is done. Turn the quote into an invoice." with **Create invoice**, **Not now** and **Don't ask me again**.
  - **Create invoice** opens the quote with the same Create invoice sheet already open (the quote's own sheet: nothing is copied).
  - **Not now** closes the card for this visit; a plain **Invoice** section on the job stays, with the same button.
  - **Don't ask me again** is remembered for this person in this business (as the logo and job prompts are); the plain section stays.
- A job that already has an invoice shows **Invoiced: INV-0001** with a link, in the same place.
- A Done job **made by hand (no quote)** shows a visible placeholder, "Invoice this job: invoices without a quote are coming." until I3b.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A friendly card with Not now and Don't ask me again | `CreateJobNudge` (`quotes/create-job-nudge.tsx`) | Same shape and the same dismiss pattern (`prompt_dismissals`), with its own key `invoice-finished-job` |
| Making the invoice | `CreateInvoice` sheet on the quote | As is; a `defaultOpen` value so the card can open it |
| Unbuilt part visible | `ComingSoonSection` | As is |

Inputs by kind: none new.

## Decisions
1. **The card sends the maker to the quote's sheet** rather than copying the sheet onto the job page. The sheet needs the quote's version, customer and the checks (`invoiceProblems`), which the quote page already has; a second copy would drift. *Recommended.*
2. **Only when the job is Done**, not when the last item is made (that is the existing "Mark ready" prompt).
3. **A job's invoice is found through its quote** (one invoice per quote), so the job's read gains the quote's invoice id and number; still one query.

## Data
No database change. The job's read embeds the quote's invoice (`quotes ( number, invoices ( id, number ) )`).

## Tests
Unit: when the card shows (done, has a quote, no invoice, not dismissed). Browser: a quote made into a job, taken to Done: the card shows; Create invoice opens the quote with the sheet open; issuing makes the invoice; the job then says Invoiced; a second job: Not now, then Don't ask me again, and the plain section stays. Accessibility: the card.

## Not planned yet
Prompting from the Jobs list's quick step; prompting when a job has no quote (I3b).

## Built, slice I3a (2026-10-22, no database change)
- A **Done** job made from a quote shows **Invoice QT-0001?** at the top (Create invoice, Not now, Don't ask me again; key `invoice-finished-job`). Create invoice opens the quote with its own sheet ready (`?next=invoice`, `CreateInvoice` `defaultOpen`). Not now and Don't ask me again swap the card for a plain **Invoice** section with the same button, so the job always has one. A job that is invoiced says **Invoiced: INV-0001** with a link; a done job made by hand shows a visible "Invoice this job: invoices without a quote are coming" placeholder (replaced in I3b).
- The job's read embeds the quote's invoice (`quotes ( number, invoices!invoices_quote_same_org ( id, number ) )`), still one query.
- Tests: unit (`shouldNudgeInvoiceJob`), `e2e/job-invoice.spec.ts` (the card, issuing from it, Not now and Don't ask me again, a job made by hand), an accessibility case. `acceptedQuote` split out of `issuedInvoice` in `e2e/invoice-helpers.ts`.

---

# I3b and I3c: an invoice with no quote, and an editable draft (planned 2026-10-22, not built)

One piece of machinery serves both: a **draft invoice** that can be edited and then issued. I3b builds it with **New invoice** (no quote). I3c adds **Adjust before issuing** on an accepted quote, which starts a draft from the quote's items. **Money, tax documents, a migration and a new table: human review, and a review agent before merging.**

## Where things stand
- An invoice is made only from an accepted quote's last sent version (`issue_invoice`), frozen, numbered inside the issuing transaction, never changed. `invoices.quote_id` and `quote_version` are required; one invoice per quote.
- The pieces a direct invoice needs already exist: `CustomerPicker`, the quote's item sheet (`LineSheet`) and item list, `DeliverySection`, `parseQuote` (works out every total on the server), `buildQuoteSnapshot`, `buildInvoiceSnapshot`, `invoiceProblems`, `NewJobForm` (a quote-shaped form built from those pieces without the quote builder).
- Not there: anywhere to keep an invoice that is not issued yet.

## Prototype read
Read in full 2026-10-17 (`Invoices.tsx` create and edit form 1 to 2230, `useAppState.ts` `createInvoiceDirect`, `updateInvoice*`; see `invoices-and-payments.md`).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| **New invoice** with no quote: customer, items (qty stepper, edit, remove, clear), fulfilment presets and price, invoice discount, tax toggle and rate, dates, notes, banking text, template | **Kept, changed (I3b):** customer, items through the quote's item sheet, delivery or collection, a discount, the invoice date, the due day and a note. VAT is the business's setting (never a per-invoice toggle); the template is the business's design; banking is the saved bank details | One way to ask for each thing; tax is not a per-document choice |
| Creating one **also creates a job** | **Dropped:** a job is the maker's choice (the Jobs tab, or "Turn into a job") | Nothing happens behind the maker's back |
| The invoice is **editable at any time** (items, customer, dates, even its number) | **Changed (I3c):** editable **until it is issued**, as a draft with no number; once issued it never changes (a mistake is a credit note) | Issued tax documents are immutable |
| Number typed by hand | **Dropped:** given when issued, gapless | Legal |
| A converted invoice copies the quote and can then be edited | **Kept (I3c):** "Adjust before issuing" starts a draft from the quote's items; issuing it records that it was changed | The prototype's flexibility without losing the link |

Missed from the prototype: nothing found yet.

## What the maker sees
- **Invoices list:** **New invoice** and a **Drafts (n)** filter; a draft row shows the customer, the total so far and "Draft". A draft can be opened, edited and **discarded** (a draft is not a tax document).
- **New invoice** (also reached from a Done job made by hand, and from a customer's page): a form like New job's, with prices: customer (chosen, or added in the same picker), items (the quote's item sheet: product, service or one-off, with variations, choices, price, discount), delivery or collection, a discount on the invoice, the **invoice date** (today), the **due day** (the usual), a **note**, and the totals as they stand ("R2 300 incl VAT"). **Save draft** keeps it; **Issue invoice** opens the same confirmation the quote's invoice uses (what happens next: numbered, can't be changed, a credit note corrects it) and issues it. Problems are named at the field and in a summary (the business address an invoice must show; the customer's address for a tax invoice of R5 000 and over).
- **A Done job made by hand** shows **Start an invoice**: New invoice with the customer and the items (names and quantities, no prices) filled in, ready for prices.
- **I3c, on an accepted quote:** next to **Create invoice** (the quote as agreed, one tap) a **Adjust before issuing** that opens a draft with the quote's items, to change and then issue. The issued invoice says "Made from quote QT-0001 and changed before issuing".

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Choose a customer | `CustomerPicker` | As is (`subject` "invoice") |
| Add and edit items with prices | `LineSheet` (`mode: "quote"`) and the item rows in the quote builder | As is. The item list rows are lifted out of `quote-builder.tsx` so both forms share them |
| Delivery or collection and its fee and address | `DeliverySection`, `DeliveryAddress` | As is |
| A discount on the whole document | The discount section in the quote builder | Lifted out into a shared `DiscountSection` |
| The totals | `calculateDocument` (the quote builder's totals rows) | As is |
| Dates, note | `TextField type="date"`, `TextAreaField` | As is |
| The confirmation before issuing | The Create invoice sheet (`create-invoice.tsx`) | The sheet takes the draft's id instead of the quote's |
| A list with a "Drafts" filter | The Invoices list filter chips | One more chip |
| The problem list (address etc.) | `invoiceProblems`, the sheet's "Before you can issue it" list | As is |

Inputs by kind: customer (picker), items (the item sheet), money (the sheet's price field), percent or amount (the discount section's), dates (`type="date"`), note (text area), delivery (`DeliveryAddress`). Nothing new.

## Decisions (recommendations in bold)
1. **A draft is stored as the form's values (one JSON object), not as invoice lines.** The quote's draft machinery has a dozen tables (lines, options, extras, steps, costs) that an invoice does not need; the draft is private working state, the numbers are worked out on the server when it is issued, and the issued invoice is a frozen snapshot like every other. *Recommended.*
2. **Issuing a draft recomputes everything on the server** from the saved values (`parseQuote`, the same money code as a quote) and builds the snapshot; the database checks the money adds up and gives the number inside the same transaction, as `issue_invoice` does. It cannot compare with a quote's agreed lines (there are none, or they were changed on purpose), so the database's job is: lock the draft, check it, number, insert, delete the draft, all in one transaction.
3. **`invoices.quote_id` and `quote_version` become optional together** (both set, or both null); the unique key on `quote_id` stays (still one invoice per quote); a new `adjusted` flag is true for an invoice made from a quote's draft. An invoice with no quote has no private costing (nothing was costed), so no margin panel.
4. **No job is made** (decided with the prototype read).
5. **One draft per accepted quote** at a time (a unique key), so "Adjust before issuing" reopens the one in progress.
6. **A draft can be discarded; an issued invoice never can.**
7. **A limit of 100 drafts a business** so the list cannot grow without end.

## Data
- `invoice_drafts` (id, organisation, `quote_id` null or the accepted quote (unique), `customer_id` null, `values jsonb` (the form), `created_by`, created and updated times). Row-level security for members, the restrictive `session_required` policy; members write drafts under their own session (insert, update and delete grants to members' policy: a draft is not a tax document); `values` is checked to be an object of a bounded size; a trigger keeps `updated_at`.
- `invoices.quote_id`, `quote_version` nullable with a check that they come together; `invoices.adjusted boolean not null default false`. The immutability triggers are unchanged.
- `issue_invoice_from_draft` (service role only, security definer): the snapshot, the dates and the note come from the server; it locks the draft, checks the quote (when linked: accepted, no invoice yet), the customer, the dates and that the money adds up, takes the number, writes the invoice and its "issued" event, and deletes the draft. Errors as `issue_invoice`.
- `delete_account` is unchanged in behaviour (drafts of a deleted business go with it; a business with invoices is still refused).

## Slices
**I3b:** the draft table and issuing function; the shared pieces lifted out of the quote builder; New invoice, Save draft, Drafts on the list, Discard, Issue; Start an invoice from a Done job made by hand and New invoice from a customer's page. **I3c:** the link to a quote, `adjusted`, Adjust before issuing, the wording on the invoice.

## Tests
SQL: isolation between businesses, session required, members only, a draft cannot hold a bad shape, issuing numbers gaplessly and a failed issue leaves no number or invoice, a draft is deleted when issued and not before, one draft per quote, the quote link rules (accepted only, no second invoice), the quote-and-version pair, the immutability still holding for the new columns, and the concurrency test for numbering still passing with three kinds of issue. Unit: the draft's values parse and the totals, the snapshot of a direct invoice (no quote number, title, due day), the problems list. Browser: New invoice end to end (customer, items with VAT, delivery, discount, dates; save, reopen, edit, issue; the number, the PDF, the statement shows it), Discard, the Drafts filter, Start an invoice from a job, and (I3c) Adjust before issuing with a changed price and the invoice's wording. Accessibility: the form, the list with drafts, the confirmation.

## Questions for the founder
1. **A draft as the form's values** (decision 1): fine?
2. **No margin on an invoice with no quote** (decision 3): fine for now?
3. **Adjusted invoices** say so on their page; should the document itself (the PDF) say anything? Recommended: no, the customer sees an invoice, not its history.

## Not planned yet
Recurring invoices, progress billing, sending the invoice from MakerFlow, an invoice for a job that has no quote and no prices carried over from it (the job's items come across without prices).

## Built, I3b and I3c (2026-10-22; **needs human review: migration `20261119100000_invoice_drafts.sql`**: money, tax documents, gapless numbering, a new table with RLS, a new server-only `issue_invoice_from_draft`, two columns of `invoices` made optional together, a new `adjusted` flag)
- **Database:** `invoice_drafts` (the form as one JSON object, at most 200 KB; members create, change and discard under their own session; the link to a quote and the organisation never change; a draft linked to a quote needs an ACCEPTED quote of the same business, one draft per quote; at most 100 a business; the restrictive `session_required` policy). `invoices.quote_id` and `quote_version` are optional together; `adjusted` is true only with a quote. `issue_invoice_from_draft` (service role only): locks the draft, refuses if it changed since the server read it (40001), checks the quote when linked (accepted, no invoice, a sent version), the customer, the items, the currency (the business's own) and that the money adds up, takes the number inside the same transaction, writes the invoice and its event, deletes the draft. Immutability of invoices is untouched. SQL tests: `invoice_drafts.test.sql`; `delete_account.test.sql` seeds a draft.
- **App:** `lib/invoices/draft.ts` (the form is the quote form plus a due day; `parseInvoiceDraft` reads it strictly with the one money code and says things in the invoice's words), `draft-data.ts`, `prepare-draft.ts` (builds the document with the quote's snapshot builder and the invoice's converter; `quoteNumber` null without a quote), `draft-actions.ts` (`saveInvoiceDraft`, `discardInvoiceDraft`, `issueInvoiceDraft` which saves, re-reads, prepares and issues, `startInvoiceFromJob`, `startInvoiceFromQuote`). Plain issuing (`issueInvoice`) now also removes the quote's draft.
- **Screens:** `/app/invoices/new` and `/app/invoices/drafts/[id]` (`InvoiceDraftForm`: customer, items through the quote's item sheet worded for an invoice, delivery or collection, a discount, the invoice date and due day, a note, the totals, Save draft, Issue invoice with a confirmation, Discard draft); the Invoices list has **New invoice** and a **Drafts (n)** filter; a customer's Invoices section has **New invoice**; a Done job made by hand has **Start an invoice** (its customer and items, no prices); on an accepted quote, **Adjust before issuing** in the Create invoice sheet (replaces the placeholder) opens a draft from the quote as agreed, and the issued invoice says "Made from quote QT-0001, and changed before it was issued" (or "Made without a quote").
- **Reused (not copied):** `LineRow` and `DiscountFields` lifted out of the quote builder; `photosFor` lifted out of `prepareQuote`; `LineSheet` takes `document="invoice"` for its words.
- **Not done:** a margin on an invoice with no quote (nothing was costed); the invoice's PDF does not say it was adjusted; drafts do not yet show on a customer's Invoices section (the Invoices list shows them).
- Tests: `draft.test.ts`, `invoice_drafts.test.sql`, `e2e/invoice-drafts.spec.ts` (6), an accessibility case.
