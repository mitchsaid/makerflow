# Plan: job tracking and invoices (the next layers)

Status: **questionnaire answered 2026-10-11; Jobs slice 1 built (see "Founder's answers" and "Built" below).** Founder's priority (2026-10-11): **quotes, invoices and job tracking come before more on margins and materials.** Costs, process and stock (`docs/plans/costs-and-recipes.md`) are paused after slice 1 (materials, built); they pick up again after the layers here. Money, document numbering, immutability and migrations get human review.

## Where things stand
- **Quotes are built end to end:** draft, preview (real PDF), send (share or download), numbered at first save, snapshots that never change, revisions, outcomes (accepted, declined, withdrawn, change the answer, quote again), deposits, terms, themes, pictures, delivery or collection. What is not built: emailing a quote, the customer's online accept link (needs a sending domain and a hosted page, layer 10).
- **Already in place for what follows:** `document_sequences` already allows `invoice` and `credit_note`, with gapless numbering per business; the PDF pipeline and the frozen snapshot pattern (ADR 0006); the locale pack's VAT and document rules for South Africa (`docs/locales/za/`); deposits on the quote, with the part-payment question deliberately left to the invoice (`docs/plans/quote-deposits.md`).
- **Waiting for them:** an accepted quote shows a "Create a job" placeholder ("coming soon"). There are no jobs, invoices, payments or credit notes yet.

## The flow (from the brief, `docs/product-brief.md`)
quote → **accepted** → **job** (make it, then collect or deliver) → **invoice** (the maker's choice when; a prompt when the job is done) → **payment** (deposit, part payments, balance). Issued invoices and credit notes are immutable and never deleted; corrections are credit notes; numbers are sequential and gapless.

## Recommended order
1. **Jobs** (layer 4), two slices. No legal or money risk, and it makes accepted quotes useful at once.
2. **Invoices** (layer 5), three slices: create and issue, payments, credit notes. The "create an invoice?" prompt on a finished job needs jobs first.
3. **Quotes' loose ends** (email, online accept) whenever a sending domain exists; not blocked by or blocking the above.

---

## Part 1: Jobs (layer 4)

### What the maker sees
- **Create a job** on an accepted quote (the placeholder becomes real). It copies what has to be made from the accepted version, frozen as the invoice and quote are: the customer, the items (name, quantity, the chosen variation, choices and wording), collection or delivery with the address, the needed-by date, and the quote's notes. One job per accepted quote; the quote shows "Job J-0007" with a link, the job shows its quote.
- **A job's status** is a few plain steps, moved with one tap: **Not started → Making → Ready → (Out for delivery, delivery jobs only) → Done**, plus **Cancelled**. Each move is logged (who, when). "Ready" says "Ready for collection" or "Ready for delivery" from how the quote was set up.
- **Jobs list** (a new tab or a place under Quotes, see decision 3): active jobs first, sorted by the day they are needed; filters Active, Done, All; a search; an overdue flag when the needed-by day has passed and it is not done. Each row: number, customer, what, needed by, status.
- **A job's page:** the items to make (large, readable on a phone beside the bench), the customer with tap-to-call and tap-to-message, the address (delivery), the needed-by date, an internal **note** the maker writes for themselves, the status buttons, the activity log, and links to the quote (and later the invoice). A **photo** can be added to a job later.
- **Home:** "Needed this week" and "Overdue" counts link to the list (small; later).

### Decisions proposed (to confirm)
1. **The maker chooses to create the job** (button, with a gentle prompt right after recording "They accepted": "Create a job?"), as the brief says for invoices; never automatic. Nothing is forced.
2. **Statuses are minimal** (above). The prototype had seven; most makers need these. A "stage" inside Making (cutting, baking, finishing) arrives with process steps (costs slice 3), not now.
3. **Where it lives:** a **Jobs** tab replaces nothing today (Home, Quotes, Customers, Products, More). A fifth bottom tab fits; or Jobs sits as a switch on the Quotes tab (Quotes | Jobs). Recommendation: **a Jobs tab** once there is something to see, because jobs are what the maker opens every day.
4. **Job numbers** are their own simple sequence (J-0001), per business, not gapless-critical (a job is not a legal document), so a job can be shown as "Job 12" in speech. Needs `job` added to the sequence kinds (a small migration).
5. **Changing the quote after a job exists:** a quote with a job cannot be reopened ("Change the answer") while the job is Making or later; before that it asks to cancel the job first. A revised quote does not change a job by itself.
6. **Jobs without a quote** (a walk-in order): the job's data does not depend on a quote being there. Built on 2026-10-11, at the founder's request.
7. **Per-item progress** (finish 3 of 5 items) and **assigning people**: later (employees, layer 11).

### Data (sketch)
- `jobs` (business; quote and version it came from; customer; number; status; needed-by; fulfilment and address; note; times), `job_items` (a frozen copy of each item: name, quantity, unit, description, variation and choices text, wording; sort order), `job_events` (status changes and notes, like `quote_events`). Every table: `organisation_id`, same-business composite keys, row-level security for members, the restrictive `session_required` policy, SQL tests. Status changes go through one checked function, as outcomes do.
- Slice 1: create, list, view, move status, log. Slice 2: notes, photos, overdue and the Home counts, "needed this week".

### Tests
SQL: isolation, session required, one job per accepted quote, allowed and refused status moves, a job's copy never changes when the quote is revised, events are append-only. Unit: status moves and wording. Browser: accept → create job → move through statuses → list filters and overdue; a delivery job's extra step; another business sees nothing. Accessibility: each screen and the status buttons.

---

## Part 2: Invoices and payments (layer 5)

### What the maker sees
- **Create an invoice** from an accepted quote or a finished job (the maker's choice, with the prompt when a job is marked Done). It starts as a **draft** copied from the accepted quote: customer, items, prices, VAT, the deposit already asked for. The maker can adjust the draft (an extra item, a changed quantity, the invoice date and due date, notes, payment details), then **Issue** it.
- **Issuing** gives the next number (gapless per business), freezes a snapshot, and makes the PDF in the maker's country's wording: for South Africa a **tax invoice** with every required field (`docs/locales/za/vat-and-documents.md`). From then it is **immutable and never deleted**. A mistake is fixed with a credit note.
- **Payments:** record what came in (amount, day, how, note): a deposit, part payments, the balance. The invoice shows **Unpaid, Part paid, Paid, Overdue** and what is still owing. A payment is never edited; a mistake is a reversal line.
- **Credit notes:** issued from an issued invoice (a reason from a short list, the items and amounts credited), with their own gapless numbers, linked to the invoice, and shown on its balance.
- **Send:** download or share the PDF, as quotes do now; email when a domain exists.

### Decisions needed before building
1. **Deposit and VAT (founder and adviser):** in South Africa a deposit is a part payment, and VAT can fall due when it is received. Does the maker issue a **deposit invoice** (or a receipt) first and then a final invoice that shows the deposit already paid, or one invoice at the end with the deposit as a payment? Recommendation: **one invoice per quote by default, with the deposit shown as a payment on it**, and a "Deposit invoice" option for makers who want to invoice up front; the part-payment VAT treatment to be confirmed with the tax adviser (already on the list for the VAT work).
2. **Draft or straight to issued:** recommendation above (a draft the maker can adjust, then Issue). A straight-through "Create and issue" can come later.
3. **Payments recorded by hand only** for now (no card or EFT integration; "Take real payments" is a later layer).
4. **Invoice and quote look the same** (the same themes, picture and wording settings), with their own numbering, wording and payment instructions under Quotes and invoices (`/app/documents`), as that page was set up for.

### Data (sketch, finalised per slice)
`invoices` and `invoice_items` (draft then immutable once issued: updates refused by the database after issue), `invoice_snapshots` or a sent-version table like quotes, `payments` (append-only), `credit_notes` and `credit_note_items`. The same safeguards as quotes: numbers issued only by the checked server function, the snapshot written in the same transaction, issued rows with no update or delete grant. Tests as for quotes issuing, plus concurrency on numbering (30 connections, as now) and the money checks: totals computed on the server from integer cents, the invoice's VAT matching the quote's rules, credit notes never exceeding what was invoiced.

### Slices
1. **Create and issue an invoice** (draft, issue, PDF, view, list, number, immutable).
2. **Payments** (record, balance, statuses, the deposit shown), and the overdue label.
3. **Credit notes.**
4. The prompt on a finished job, and "Create invoice" on the job page.

---

## Founder's answers (2026-10-11)
1. **Order:** jobs first, then invoices.
2. **Statuses** as proposed: Not started, Making, Ready (for collection or delivery), Out for delivery (delivery jobs only), Done, plus Cancelled.
3. **Where jobs live:** a **Jobs tab**, with **Customers moved under More** on a phone (the desktop sidebar keeps both).
4. **Deposit and the invoice:** **one invoice, with the deposit shown as a payment.** The deposit's VAT treatment still needs the tax adviser.
5. Photos of finished work, a delivery time window, a driver: **none of these** are needed for now.
6. **Jobs without a quote** (founder, 2026-10-11, after slice 1): a job can be made by hand, so decision 6 below is no longer "later". Built (see below).

## Built: Jobs slice 1 (needs human review: migration `20261028100000_jobs.sql`)
- **Database:** `jobs`, `job_items` (a frozen copy) and `job_events`, each with row-level security and the restrictive `session_required` policy. Two service-role-only functions: `create_job_from_quote` (needs an accepted quote with a customer; copies the latest sent version's snapshot; one active job per quote; the business's own count for the number) and `move_job_status` (only the allowed moves, each logged). A member can change only the job's `note`. The same migration replaces `record_quote_outcome` with one added rule: **a quote with an active job cannot be reopened** ("Change the answer") until the job is cancelled (decision 5 above, simplified to "active job" rather than by status).
- **App:** a **Jobs** tab (list with To do / Done / All, search, late flag), a job page (what to make with variation and choices, customer with tap-to-call and email, delivery address, needed-by, the maker's note, one big next-step button plus smaller back/cancel/restore, activity log, link to the quote), and **Create a job** on an accepted quote (which then shows "Job J-000N"). Job numbers are shown "J-0001", counted per business (not `document_sequences`: a job is not a legal document).
- **Jobs without a quote (built, needs human review: migration `20261029100000_jobs_without_quote.sql`):** a **New job** button on the Jobs tab opens a form (customer from the saved ones or added on the spot, one or more items with quantity, unit and details, the day needed, collection or delivery with the address, a note). `jobs.quote_id` and `quote_version` may now be empty (only together); a new service-role-only `create_job` function checks everything, copies the customer as the quote path does and shares the same numbering; `move_job_status` is replaced so a job with no quote has nothing to lock or check on restore. Such a job says "Added by hand, without a quote".
- **Job items follow the quote's way (founder, 2026-10-12; needs human review: migration `20261030100000_job_items_like_quote_items.sql`, a replaced `create_job`):** an item is added through the same item sheet as on a quote (`LineSheet` in a `job` mode): pick a product or service, with its variation and choices and the quantity and details, add a new product on the spot, or type a one-off item. The sheet has no price, discount or VAT in this mode, and shows no prices. A job item keeps the product's kind, the variation's words, the choices (words and how many, no amounts) and the picture of what was chosen; the job page shows the picture. The database checks every field and stores only the known ones.
- **Not yet (slice 2):** photos, the Home counts, "needed this week", a prompt right after "They accepted", per-item progress.

## Jobs slice 2: progress, a "mark it ready" prompt, more items, status from the list (founder, 2026-10-13)

Why: the prototype's Jobs screen was read properly on 2026-10-13 (`docs/prototype-discovery.md`, section 9). The founder chose items 1 to 4 of the gaps found. Needs human review: migration `20261031100000_job_progress.sql`.

### What the maker sees
1. **Progress on each item.** On a job that is Not started or Making, each item shows "Made 2 of 5" with a minus, a plus, and an "All made" tick (a done item shows "All made", struck through like a ticked list). The counts keep the item's own units (2.5 metres works). The job page shows "1 of 3 items made" with a bar; list rows show the same line. Ticking the first unit on a Not started job starts it (Making, logged), as the prototype does. Once a job is Ready or later the counts are not shown (they are not touched either); stepping back to Making shows them again.
2. **A prompt, not an automatic move.** When every item is made on a Making job, the page says "Everything is made. Ready to hand it over?" above the same big next-step button (the list row's button does the same). Nothing moves by itself. (The prototype moved the job on its own; MakerFlow offers.)
3. **Add an item to a job** that is Not started, Making or Ready, with the same item sheet as on a quote, in `job` mode. A Ready job goes back to Making (it has something new to make), logged. The item says "Added later" and the activity log says "Added Wedding cake". Not on Out for delivery, Done or Cancelled jobs. At most 50 items per job.
4. **Move a job from the list.** Each active row has one button with its next step ("Start making", "Mark ready for collection", ...), beside (not inside) the row's link. Steps back and cancelling stay on the job page.

### Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Add an item to a job | Item sheet (`quotes/line-sheet.tsx`, `job` mode) | Reused as is; the new "Add an item" button on the job page opens the same sheet and sends one item |
| The step to take next | `JobSteps` and `nextJobStep` | Reused: the list row calls the same `moveJob` action with the same labels |
| Add button wording | `AddButton` (ADR 0008) | Reused for "Add an item" |
| Job status chip, item lines, quantities | `JobStatusChip`, `quantityText`, `formatQuantity` | Reused |
| Counting what is made | None (no counter exists in the app) | **New**: a small counter (minus, a typed number, plus, and "All made"). Typed numbers use the quote's quantity parser. Reason: nothing in the app counts a part of a quantity; the prototype's counter is the model |
| A progress line / bar | None (no progress bar in `components/ui`) | **New**: a plain text line "1 of 3 items made" and a bar made of a div with `role="progressbar"`; not a library component |

### Data
- `job_items.made_milli` (bigint, 0 up to the item's quantity) and `job_items.added_later` (boolean).
- `job_events` gets a third kind, `item_added`, with the item's name in a new `detail` column; its shape rule becomes "status events have a from-status, the others do not".
- Server-only functions (service role), like `move_job_status`: `set_job_item_made(org, job, item, made_milli, actor)` and `add_job_item(org, job, actor, item)`. Both lock the job row, refuse the wrong statuses (55006), and write events. The item checks that `create_job` did inline move into one helper, `job_item_clean`, which `create_job` and `add_job_item` both call, so there is one copy of the rules.
- Members still cannot write items or events directly.

### Built (2026-10-13; needs human review: migration `20261031100000_job_progress.sql`)
All four are built as planned. Differences and details: adding an item has its own page, `/app/jobs/[id]/add-item` (the job page keeps its one query; this page loads the job and the products beside the session check), which opens the item sheet at once; if the save fails the item is kept with the reason and "Try again" reopens it as typed. Counts show "Saving…" while they are on their way to the server (quick taps are sent one after another). The job page's "Where it stands" says "Everything is made. Ready for the next step?" above the usual button. `pnpm perf` was not run: its script still looks for a Customers tab that moved under More in Jobs slice 1 (needs a small fix of its own).

### Tests
SQL: server only; refusals write nothing (other business, not an item of the job, over the quantity, wrong status, bad shape, 51st item); progress starts a Not started job; adding to a Ready job steps it back; `create_job` still refuses everything it did. Unit: item progress helpers (counts, step size, all made, summary line). Browser: count an item, the job starts, all made shows the prompt, mark ready from the prompt; add an item to a job; move from the list; accessibility cases for the new parts.

## Questions for the founder (asked and answered above)
1. **Order:** jobs first, then invoices? (Recommended.) Or invoices first, if you would rather get a deposit invoice out before building the job screens.
2. **Job statuses** as proposed? Anything you track today that is missing (for example "Waiting for materials" or "Waiting for the customer")?
3. **Where jobs live:** a fifth bottom tab, or a switch on Quotes? (Recommended: a tab.)
4. **Deposit and the invoice** (Part 2, decision 1): one invoice with the deposit as a payment (recommended), or a deposit invoice first?
5. Anything you do today for **jobs** that a maker's spreadsheet or WhatsApp notes cover and this would not (photos of the finished work, a delivery date and time window, a driver)?

## Not planned yet
Online payments, reminders by email or WhatsApp, recurring invoices, statements, supplier bills, stock movements from jobs (costs plan, slices 5 and 6), per-item and per-stage progress (costs plan, slice 3), assigning jobs to people (employees, layer 11), jobs without quotes.
