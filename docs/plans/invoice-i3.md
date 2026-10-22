# Plan: the rest of invoicing (I3)

Status: **I3a planned and built 2026-10-22**; I3b and I3c not started. Founder, 2026-10-22: "do ... I3, the rest of invoicing: a prompt to invoice when a job finishes, an invoice with no quote, and an editable draft." Parent plan: `docs/plans/invoices-and-payments.md` (its "I3 (later)").

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
