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
1. **Progress on each item.** On a job that is Not started or Making, each item shows "Made 2 of 5" with a minus, a plus, and an "All made" tick (a finished item shows "All made"). The counts keep the item's own units (2.5 metres works). The job page shows "1 of 3 items made" with a bar; list rows show the same line. Ticking the first unit on a Not started job starts it (Making, logged), as the prototype does. Once a job is Ready or later the counts are not shown (they are not touched either); stepping back to Making shows them again.
2. **A prompt, not an automatic move.** When every item is made on a Making job, the page says "Everything is made. Ready for the next step?" above the same big next-step button (the list row's button does the same). Stepping a job back from Making to Not started keeps its counts. Nothing moves by itself. (The prototype moved the job on its own; MakerFlow offers.)
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
All four are built as planned. Differences and details: adding an item has its own page, `/app/jobs/[id]/add-item` (the job page keeps its one query; this page loads the job and the products beside the session check), which opens the item sheet at once; if the save fails the item is kept with the reason and "Try again" reopens it as typed. Counts show "Saving…" while they are on their way to the server (quick taps are sent one after another). The job page's "Where it stands" says "Everything is made. Ready for the next step?" above the usual button. `pnpm perf` could not be run at the time (its script still looked for a Customers tab that moved under More); fixed 2026-10-14, and it now times Quotes, Jobs, Products, More and Home: about 60 ms to react, about 0.5 s for content, one data query plus the session check per page.

### Tests
SQL: server only; refusals write nothing (other business, not an item of the job, over the quantity, wrong status, bad shape, 51st item); progress starts a Not started job; adding to a Ready job steps it back; `create_job` still refuses everything it did. Unit: item progress helpers (counts, step size, all made, summary line). Browser: count an item, the job starts, all made shows the prompt, mark ready from the prompt; add an item to a job; move from the list; accessibility cases for the new parts.

## Jobs slice 3: Home counts and a "Create a job?" nudge (founder, 2026-10-14)

Status: planned and built 2026-10-14. **No database change** (no migration), so no migration review. Money and tax are not touched.

### Prototype read
Read in full: `Dashboard.tsx` (lines 1 to 583, the whole Home screen: the welcome banner and Create New menu, the three money cards, Recent Quotes, the quick links, the Testing Area), the quote-accepted flow in `Quotes.tsx` (`handleQuoteAcceptedStateTrigger`, `handleConfirmJobConversionPrompt`, the "Convert to Job?" modal, the Job entry in the Convert menu), `convertQuoteToJob` in `useAppState.ts`, and the "Production Stats Summary Cards" and status filter in `Jobs.tsx` (lines 1690 to 1800).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| The Home screen has **no job numbers at all**: only money cards (collected, outstanding, overdue invoices), Recent Quotes and a "Job Progress" link | **Added, not from the prototype**: "Needed this week" and "Late" job counts on Home | The founder's request; a job has a needed-by day here, the prototype's jobs have none |
| Money cards on Home (collected, outstanding, overdue) | **Later**, with invoices | There are no invoices yet |
| Recent Quotes table on Home | **Later**: Home grows as the layers do; not part of this slice | Out of scope |
| Create New menu (Quote, Invoice, Job, Product) | **Later**: the tabs and each page's own Add button cover it for now | Out of scope |
| Welcome banner "Hi, {name}!" with a subtitle | **Changed**: the business name is the heading; no subtitle | Less text on a phone |
| A quote can be marked accepted from any status (draft, sent, viewed, expired, declined) | **Dropped**: "They accepted" is only offered on a sent quote; "Change the answer" reopens a declined or accepted one | An answer belongs to something that was sent |
| A success toast ("Quote accepted & Job created successfully!") | **Changed**: the card, or the new job opening, is the confirmation | |
| A notification on every quote status change | **Later**: notifications are not built | |
| A dropdown filtering the Jobs list by each exact status | **Later**, with the stat cards | Not asked for |
| Quick links to Catalogue, Customers, Job Progress | **Dropped**: the tab bar does this | |
| Jobs list shows stat cards: In Progress, Ready (Collection), Ready (Delivery), Being Delivered, Done | **Later**: the list's filter buttons with counts do the job today (To do, Done, All, now Late and This week); counts by exact status are a candidate | Not asked for |
| Accepting a quote opens a modal "Convert to Job?" with "No, Just Accept" and "Yes, Create Job" | **Changed**: after "They accepted" is saved, a friendly card at the top of the quote offers "Create a job"; "Not now" closes it | The brief: advanced steps are offered by dismissable prompts, never forced; the quote still shows the plain "Create a job" section |
| A "Don't ask again (always use this choice)" checkbox, remembered in the browser for either answer (yes always creates the job, no never asks) | **Changed**: "Don't ask me again" is remembered for this person in this business (the `prompt_dismissals` table, like the logo prompt); an automatic "always create the job" is **dropped** | Never silently create things; a stored choice in the browser is per device |
| Convert menu on a quote: Invoice or Job, any time | **Kept** as the existing "Create a job" section on an accepted quote; invoices come later | |
| `convertQuoteToJob` when a job exists already: sets it back to Not Started | **Dropped**: one job per accepted quote; a second attempt says so (already handled by `create_job_from_quote`) | Numbers and history stay honest |
| A notification "Job … created from Quote …" | **Later**: notifications are not built | |
| Delete a job | **Built later (2026-10-26)**: a job that is not started, or cancelled, can be deleted by an owner or admin (anything else keeps its record: cancel it). The number is free again when it was the newest; an older one leaves a gap, which is fine because a job is not a legal document (numbers are the highest plus one) | Founder: "Can't deletion just release the number in the sequence?" |

### What the maker sees
1. **Home** shows a **Jobs** card instead of the "You're all set up" placeholder: two big numbers, **Late** (needed on a day that has passed, not finished) and **Needed this week** (needed today or in the next six days, not finished). Each is a link that opens the Jobs list already filtered to those jobs. With no active jobs the card says "Nothing to make right now" and offers **New job**. When there are jobs but none are late or due this week it says "Nothing is due in the next week." with a link to the list.
2. The **Jobs list** gets two more filter buttons, **Late (n)** and **This week (n)**, beside To do, Done and All. The page reads `?show=late` or `?show=week` so Home can link to them; the buttons still switch locally with no round trip.
3. **After "They accepted" is saved**, the quote page shows a card at the top, under the outcome banner: "Create a job for QT-0001? You can follow it from making to collected or delivered." with **Create a job** (the same button as the section lower down), **Not now** and a smaller **Don't ask me again**. "Not now" only removes the card. "Don't ask me again" is remembered for this person in this business and is never shown again after an acceptance (the plain Create a job section stays on every accepted quote). The card is shown straight after the answer is recorded (and again on a reload until it is closed), and never on a quote that already has a job or when the answer was not "accepted".

### Decisions (made, to confirm)
1. **"This week" is the next seven days from today** (today plus six), not the calendar week, so on a Sunday it does not read zero. The two counts never overlap: late is before today.
2. **Only active jobs count** (not done, not cancelled) and only those with a needed-by day. A job with no day set is in neither count.
3. **Home asks one question** for jobs: the status and needed-by day of active jobs only (no items), so it stays light. The counting is a small pure function (`jobDueCounts`); the Jobs list uses the same two predicates (`isOverdueJob`, `isDueThisWeekJob`).
4. **The nudge is a card, not a popup**, and lives in the page (`?next=job` on the address after the answer is saved), so it survives the page refresh that follows recording an answer and a reload shows it once more until dismissed. Closing it removes the address part. (Known quirk: the address, not the answer, drives the card, so going Back to it after cancelling the job shows it again; harmless.)
5. **No new table or column:** the dismissal uses `prompt_dismissals` (key `create-job`).

### Interactions reused
| Need | Reused | Notes |
| --- | --- | --- |
| A friendly dismissable card with "Not now" remembered per person | The `LogoPrompt` pattern (`Alert` card, a dismiss action writing `prompt_dismissals`, `dismissedPrompts` from `requireOrganisation()`) | A separate component, because it has two ways to dismiss; a new prompt key |
| Make a job from a quote | `CreateJobButton` and `createJob` | Given a compact mode (no long explanation) for the card |
| Filter buttons with counts | the Jobs list's filter group | Two more entries |
| Showing a day | `formatDay` (on the list rows; Home shows counts only) | |

### Tests
Unit: the due counts (late, this week, boundaries today and day seven, active only, no day), the two new list filters, the `?show=` parsing. Browser: Home shows both counts and links to the filtered list; with no jobs it offers New job; after "They accepted" the card appears, "Create a job" opens the new job, "Not now" removes the card and it does not come back on reload, "Don't ask me again" is remembered and the next acceptance shows no card; the card does not show on a quote that has a job; accessibility cases for Home and the card.

## Missed from the prototype (Jobs)
Jobs slice 1 was planned without reading the prototype's Jobs screen (see "Prototype read" in `docs/plans/README.md`). Reading it afterwards (`docs/prototype-discovery.md`, section 9) found these behaviours the plan never listed. Built in slice 2: counting what is made per item, progress on the list rows, adding an item to an existing job, moving a job from the list, and a prompt when everything is made (the prototype moved the job by itself; MakerFlow offers). Still open: stock jobs and using finished stock, batch, one-by-one and stage tracking, material deduction as units are finished (the costs slices), "Awaiting quote acceptance", and deleting a job (MakerFlow cancels instead, so numbers stay gapless). Cost: one extra slice and a founder question ("did you review the prototype?") that the plan should have answered.

**Before the invoice plan (Part 2): read the prototype's Invoices, credit notes, payments and Buyer view in full, and add the "Prototype read" table here.** The summary in `docs/prototype-discovery.md` is not a read.

## Questions for the founder (asked and answered above)
1. **Order:** jobs first, then invoices? (Recommended.) Or invoices first, if you would rather get a deposit invoice out before building the job screens.
2. **Job statuses** as proposed? Anything you track today that is missing (for example "Waiting for materials" or "Waiting for the customer")?
3. **Where jobs live:** a fifth bottom tab, or a switch on Quotes? (Recommended: a tab.)
4. **Deposit and the invoice** (Part 2, decision 1): one invoice with the deposit as a payment (recommended), or a deposit invoice first?
5. Anything you do today for **jobs** that a maker's spreadsheet or WhatsApp notes cover and this would not (photos of the finished work, a delivery date and time window, a driver)?

## Not planned yet
Online payments, reminders by email or WhatsApp, recurring invoices, statements, supplier bills, stock movements from jobs (costs plan, slices 5 and 6), per-item and per-stage progress (costs plan, slice 3), assigning jobs to people (employees, layer 11), jobs without quotes.

## Cancelled jobs and deleting (2026-10-26)
Founder: "I don't like that the 'show all' button on jobs showed archived jobs. Do jobs need to be archived? Can't they just be cancelled/deleted?" Jobs were never archived; the cancelled ones showed under **All**.
- **All** is every job that is not cancelled (to do and done). **Cancelled** is its own filter chip, shown only while something is cancelled. The empty-list button says **Show to-do jobs**.
- **Delete this job** (job page, owners and admins) for a job that is Not started or Cancelled, after a sheet that asks. It removes the job, its items and its activity log (`delete_job`, server-only, migration `20261123100000_delete_job.sql`, needs human review); the quote and any invoice are untouched, and the quote can get a new job. The Jobs list says "Job J-0003 deleted."
- Staff can still cancel and restore; only owners and admins delete.
