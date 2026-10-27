# UX pass 3: Home overview and Create new, card menus, a quieter job page

## Status
**Planned, 2026-10-27; waiting for the founder's answers (section "Questions").** Founder, from using the app on a phone: "Home should provide a financial overview of amounts outstanding etc. Home should also have a 'Create new...' button ... You should be able to convert a quote into a job without going to the preview stage ... the cards should have some kind of thing you can click to delete, convert etc ... Job tracking: weird hover interaction ... the three buttons just sitting there feel odd. Maybe choosing the status should be some kind of dropdown? Cancel and delete feel very prominent ... do you really need both? ... a tight/locked relationship between quotes and jobs ... Notes should auto-save ... Change steps shouldn't be so prominent ... 'Where it came from' feels like metadata."

Part of it touches the database (job moves and deleting jobs, a new total for Home), so it needs human review.

## Where things stand
- **Home** (UX pass 2, C): attention-only cards (money owed, quotes waiting, jobs due); a count of nothing is left out. No overview of money in, no quick way to start a document except "New quote" / "New job" in an empty or caught-up card.
- **Job page:** one big next-step button, then *Cancel this job* and *Delete this job* as buttons of equal weight, then the items (each with *Change steps*), customer, a note with a *Save note* button, *Where it came from* and *Activity*.
- **Job rows** (Jobs list, customer page): a link card with a hover colour, and the next-step button *below* the link, outside it (so the hover colour stops above the button).
- **Statuses and moves:** Not started, Making, Ready, Out for delivery (delivery only), Done, Cancelled; the server allows only certain moves (`move_job_status`). A job can be deleted only while Not started or Cancelled (`delete_job`, 2026-10-26).
- **Quote to job:** only an accepted quote with a customer becomes a job; one live job per quote (a cancelled one does not count); a quote with a live job cannot have its answer changed. On a *sent* quote the quote page offers "Already a yes? Record it and start the job" (`turn-into-job`). Nothing on the list cards.

## Prototype read
Re-read for this plan: `prototype/src/components/Dashboard.tsx` in full (583 lines), and in `Jobs.tsx` the job list row (about 1800 to 1875), the detail header and status area (about 1955 to 1975, 2350 to 2385) and the delete modal (3120 to 3155). The rest of `Jobs.tsx` and the quote-to-job flow are covered by the reads in `docs/prototype-discovery.md` (sections 9 and the coverage table: Jobs 2026-10-13/16, Dashboard 2026-10-14, "Convert to Job?" 2026-10-14).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Home has a **Create New** button with a dropdown: Quote, Invoice, Job, Product | **Kept** (this plan): a *Create new* button at the top of Home that opens a sheet with Quote, Invoice, Job (the founder named three; Product is a fourth to confirm) | It was dropped in UX pass 2 when Home became attention-only |
| Home has three money cards: **Collected earnings** (paid invoices), **Outstanding** (unpaid) and **Overdue**, each with a count of invoices | **Changed**: Outstanding and Overdue exist already; **Collected** is added as *Paid this month* (an all-time total is not useful to a maker) | The founder asked for "a financial overview of amounts outstanding etc" |
| Home lists the five **most recent quotes** in a table with status and amount | **Later** (offered below as an option): a short *Recent* list | Not asked for; Quotes is one tap away |
| Home has quick links to Catalogue, Customers, Job progress | **Dropped**: the bottom bar and More already do this | Duplicate navigation |
| Home hosts demo-data controls (Reset, Restore, company presets) | **Dropped** (CLAUDE.md: no demo shortcuts in product code; the public demo account is separate) | Rule |
| A job's **status is a dropdown** (Not started, In Progress, Ready for Collection or Ready for Delivery and Being Delivered, Done), on the list row and on the detail screen; any status can be chosen at any time | **Changed** (recommended): a status dropdown on the job page; the list row keeps its one next-step button | Founder: "choosing the status should be some kind of dropdown" |
| The prototype has **no Cancelled status**: a job is deleted (a trash button on the list row, and *Delete Job* on the detail header, each behind a "Delete Job?" confirmation) | **Changed** (recommended): drop *Cancel this job*; keep **Delete**, lower on the page, behind a question | Founder: "do you really need both?" |
| A job can be **deleted at any status** | **Kept** (recommended) for every status | Same |
| The prototype's quote has **Convert to Job** from its menu on the list and detail (any accepted quote, or "awaiting acceptance") | **Kept**: a *Turn into a job* action in a menu on the quote's card | Founder: convert without the preview stage |

Missed from the prototype: nothing new found.

## What the maker sees

**Home.**
- A **Create new** button (a plus and the words, the main button) under the business name. It opens a sheet: *Quote*, *Invoice*, *Job* (and *Product* if wanted), each a big tap target that goes straight to that new form. The sheet is the same kind as the other bottom sheets, not a floating menu (a floating menu is awkward on a phone).
- **Money** first, always shown once there is any invoice: **Owing** (all unpaid), **Overdue** (red, only when something is) and **Paid this month**; each opens the Invoices list narrowed to those. A line: "3 invoices owing".
- The attention cards stay under it (quotes waiting, jobs due). Nothing owed and nothing waiting still says so in one line.

**Cards get a ⋯ menu** (quotes, jobs, invoices, products, customers where they have an action): a small outlined icon button at the card's right, a full 44 px tap target, opening a sheet of actions for that card.
- **Quote:** *Turn into a job* (a sent or accepted quote with a customer; a sent one is recorded as accepted first, as "Already a yes?" does on the quote page), *Delete* (drafts only: a sent quote is a record of what the customer was told).
- **Job:** *Delete*.
- **Invoice:** nothing to delete (issued invoices are never deleted); *Record a payment* is the candidate.
- The menu is only there when the card has an action.

**Job page, quieter.**
- Top: the title and a **Status** dropdown (a native select, as the app's other choices): Not started, Making, Ready (or Ready for delivery), Out for delivery (delivery jobs), Done. Changing it is one tap and is logged as now. The list row keeps its one-tap next-step button.
- Then the items and their progress, the customer, the **note (saves itself** a moment after typing stops and when leaving the box; a small "Saved" says so; no button).
- *Change steps* becomes a small text link under an item's progress ("Edit steps"), not a button.
- **History** at the bottom, closed: *Where it came from* and *Activity* inside it.
- **Delete this job** is the last thing on the page, a quiet text-weight danger link, behind the same question. *Cancel this job* goes (see Decisions).

**Job rows: one hover.** The whole card (the details and the next-step button) is one hover and focus area, so the colour no longer stops above the button.

**Quote to job, looser.** From the card's menu, from the quote page, and from the preview: *Turn into a job* never needs the preview stage. A job can be made from any quote that is sent or accepted. A job's quote link stays, but nothing about the quote is locked more than it must be: see Decisions.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Choose from a short list (status) | `SelectField` / the app's native select | As is |
| A sheet of choices (Create new, card menu) | `Sheet` (side or bottom, as the item sheet and the cancel sheet) | As is; **new** small component `ActionSheet` (a titled list of big buttons), because three screens need the same list of actions |
| The ⋯ trigger | `Button` `variant="outline" size="icon"` (as `SettingsLink`) | As is; **new** `RowMenu` that wraps the trigger and the sheet |
| Confirm a delete | The sheet used by *Delete this job* and *Delete draft* | As is |
| Saves itself (the note) | None yet: every other note has a Save button | **New** `useAutoSave` (debounced save and on blur, "Saved" in a status line); a reason: a note is one free field with no problems to show, so a button only adds a step. Not used for forms with several fields or checks |
| Money amounts | `formatMoney` and the Home `MoneyLink` | As is |
| Collapsed extras | None yet (a `<details>` is the simplest honest control) | **New** `Disclosure` wrapper over `<details>` with a 44 px summary, for *History* |
| A text link that is an action (Edit steps, Delete this job) | `Button variant="link"` (as `UseOnNewQuotes`) | As is |

Inputs by kind: the status is a choice (select); the note is text; no address, quantity, date, price or picture is asked for.

## Decisions (with a recommendation)
1. **Drop Cancel; keep Delete, for any status.** One way to get rid of a job, one question. A cancelled job today leaves a number, a chip, a Restore button and a quote that is "free again" but still carries a record the maker did not ask for. Existing cancelled jobs keep showing under *Cancelled* with Restore and Delete until they are deleted. Needs a migration (`delete_job` accepts every status) and **human review**. *Alternative:* keep Cancel and tuck both under the ⋯ menu.
2. **A job's status moves freely** among Not started, Making, Ready, Out for delivery (delivery only) and Done, as in the prototype (every move is still logged with who and when). The strict move table (`move_job_status`) made sense with big buttons; with a dropdown it only makes a maker go round three taps for a mistake. Needs a migration and **human review**. *Alternative:* the dropdown lists only the moves the table allows today.
3. **Quote and job: loosen, but do not cut.** Keep the link (a job made from a quote copies its items, customer and day, and the invoice follows the quote). Loosen: a job can be made from any *sent* or *accepted* quote; from the card, the quote page or anywhere; a sent quote is recorded as accepted by the same action; deleting a job frees the quote at once. Keep "one live job per quote" and "a quote with a live job cannot be reopened" (without them a quote could be changed under a job that is being made). *Alternative:* allow several jobs on one quote (one big order made in batches): not recommended before a maker asks for it.
   - **What was reported:** "I can't create a job from a quote if I already did, even if it's cancelled." In the code a *cancelled* job does not block (there is a browser test for it), a job that is Not started, Making, Ready or **Done** does. If it was a cancelled job that blocked, I need the steps; deleting the job (decision 1) frees the quote either way.
4. **Home money: Owing, Overdue, Paid this month.** "Paid this month" needs a new total (the payments recorded this calendar month, less reversals), computed on the server like the others; it adds one value to the existing `invoice_owed_totals` (a migration; **human review**, it is money). *Alternative:* no "paid" figure.
5. **The ⋯ menu is a sheet, not a floating menu** (consistent with every other choice on a phone, and a 44 px target without hover). Recommended.
6. **Notes save themselves**; an error shows under the box and keeps what was typed. Recommended.
7. **Create new has Quote, Invoice, Job** (as asked). Product is in the prototype's list; recommended to leave it on the Products screen.

## Data (sketch; needs human review)
- `delete_job`: remove the status check (or widen it to every status). A done job is deleted too, after the question; a job's items and log go with it, as now.
- `move_job_status`: allow any move among the five working statuses (delivery only for Out for delivery); `cancelled` no longer a move target; a cancelled job can still be restored (to Not started) and deleted. Every move stays logged.
- `invoice_owed_totals`: add `paidThisMonthCents`. Money is integer cents, computed on the server.
- `create_job_from_quote`: accept a sent quote by recording the acceptance in the same transaction (as `record_quote_outcome` does today); no other change.
- Row-level security and the restrictive `session_required` policy are unchanged; the functions stay server-only (service role), and each gets its SQL test.

## Slices
1. **The job page, quieter** (no database change): notes save themselves, *Change steps* as a text link, *History* closed, Delete lower down and quiet, the hover fixed on job rows. Usable on its own.
2. **Status dropdown, one way to remove a job** (migration, human review): the dropdown, free moves, Delete for every status, Cancel removed.
3. **Home:** Create new sheet; money cards with Paid this month (migration for the total).
4. **Card menus and Turn into a job from a card** (the quote's recording and job in one action).

## Tests
- SQL: free moves and the moves refused (Out for delivery on a collection job), delete at every status, another business's job not found, the monthly paid total (payments, reversals, other months, other business), a sent quote becoming a job.
- Unit: filters and status lists, the autosave timing, the totals' wording.
- Browser: each slice; accessibility cases for the sheets, the dropdown and the closed History; a phone-width check of the job page and Home.

## Questions for the founder
1. **Drop Cancel and keep only Delete?** (Decision 1.)
2. **Status moves free (as in the prototype), or only the allowed next and previous steps?** (Decision 2.)
3. **Can you tell me what you did when a cancelled job blocked a new one?** (Decision 3.) Which status did the job have, and which quote?
4. **"Paid this month" on Home?** (Decision 4.)

## Not planned yet
Several jobs on one quote; a recent-quotes list on Home; recording a payment from an invoice card; archiving (nothing is archived: deleting and the Cancelled chip cover it).
