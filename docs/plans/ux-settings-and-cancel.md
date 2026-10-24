# Plan: settings live with their documents, and cancelling a job asks first

Status: **built 2026-10-24** (UX pass, pull request 3 of 4; from the founder, 2026-10-24: "quotes and invoices settings … should live as settings inside quotes and invoice pages, no? Also don't link to them in business settings", and "cancelled jobs show a weird restore state, better to confirm the cancellation (or deleting?) and then just show the jobs main page"). **No database change.**

## Prototype read
Read in full 2026-10-24 for these behaviours: `Profile.tsx` (all 385 lines: the only settings screen), and in `Jobs.tsx` the job detail header and delete action (about 1960 to 1990), the delete confirmation modal (3110 to 3160) and the list's filter and empty states (1690 to 1795); `Quotes.tsx` and `Invoices.tsx` for where numbering or settings might sit (searched: there are none).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| **No document settings at all.** `Profile.tsx` is "My Profile": business name, phone, email, address, bank details, VAT number and rate. Numbering, wording, terms and themes are not settings in the prototype | **Not applicable;** MakerFlow's document settings are its own. Placement decision: they live inside Quotes and Invoices, not on a page of their own | The founder's decision; the Business profile keeps only facts about the business (the same as the prototype's profile) |
| A job is **deleted** from its detail page ("Delete Job", red) after a modal that says it is permanent and cannot be undone | **Changed:** MakerFlow never deletes a job (it has a number, activity and may have an invoice); it is **cancelled**, after a confirmation, and can be restored. The founder asked "confirm the cancellation (or deleting?)": cancelling is the answer, and delete is **not offered** | Numbering and history; the job's quote can have another job while this one is cancelled |
| The delete modal: icon, a question naming the job, a one-line consequence, "Cancel" and a red confirm | **Kept** as a sheet (the app's confirmation shape): "Cancel this job?", the job named, one line of consequence, a red "Cancel the job" and "Keep the job" | The shape matches "Issue this invoice?" |
| After deleting, the screen returns to the jobs list (`setSelectedJobId(null)`) | **Kept:** cancelling goes back to the Jobs list, with a short note and an **Undo** (new; the prototype could not undo) | Undo is cheap because a cancelled job is only a status |
| The jobs list: a status dropdown and a search; an empty list says "No jobs in queue"; a list with no match says "No jobs match" with a **Clear filters** link | **Later (UX pass 4):** the filter and empty-state pattern is its own slice | Separate slice |
| Cancelled is not a status in the prototype (jobs are deleted) | **Changed:** MakerFlow keeps `cancelled`; the cancelled job's page says so plainly and offers **Restore this job** | Same reason as above |

Missed from the prototype: nothing found.

## What the maker sees
- **Quotes** has a **Quote settings** button (it had one already; it now opens `/app/quotes/settings`): terms, themes, quote wording, the default deposit, discount and delivery or collection, and quote numbers. Its back link goes to Quotes.
- **Invoices** has an **Invoice settings** button: invoice numbers and credit note numbers. Its back link goes to Invoices.
- **No "Quotes and invoices" item** in the desktop sidebar or in More, and the **Business profile has no card** pointing at it. The Quotes tab stays marked while on the quote settings (they are under `/app/quotes`).
- Old addresses (`/app/documents` and below) **redirect** to `/app/quotes/settings`.
- **Cancel this job** opens a sheet: "Cancel this job?", the job and customer, "It leaves your to-do list and nothing more is counted on it. You can restore it later." with **Cancel the job** (red) and **Keep the job**. After cancelling, the Jobs list opens with "Job J-0001 cancelled." and **Undo**.
- A cancelled job's page: the heading says Cancelled, one line ("This job was cancelled, so nothing is counted on it. Restore it to carry on."), and **Restore this job**.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A confirmation | The "Issue this invoice?" sheet | The same sheet shape |
| A page opened from a list page | The Quotes page's "Quote settings" button | As is; the Invoices page gets the same |
| A page header with a back link | `PageHeader` | As is |
| A short note with a button | `Alert` | As is |

Inputs by kind: none new.

## Decisions
1. **Routes:** `/app/quotes/settings` (with `policies` and `themes` below it) and `/app/invoices/settings`. The old `/app/documents` paths redirect (not permanent).
2. **Deleting a job is not offered.** A job has a number and may be linked to a quote and an invoice. *To confirm with the founder later:* whether a job that never started and has no history could be deleted.
3. **CLAUDE.md** is updated: document settings live inside the document's own area.
