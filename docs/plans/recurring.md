# Plan: recurring quotes, invoices and jobs

Status: **planned 2026-11-06; founder answered the same day: all recommendations taken (draft for checking, invoices then jobs then quotes, exact copy, Home only for the notice). Slice 1 (engine and invoices) in progress.** Founder, 2026-11-06: "add the concept of recurring quotes, invoices and jobs." Serves makers with repeat work: a monthly retainer or workshop pass, a standing weekly order from a café, a yearly service, a regular cake for the same customer.

## Where things stand
- A quote, an invoice and a job can already be **copied**: Duplicate on a quote or invoice (`docs/plans/duplicate.md`, `quoteAgain`, `invoiceFormFromSnapshot`), and a job can be made with no quote (`lib/jobs/new-job.ts`). Recurring is "make one of those again, on a schedule, without being asked".
- Invoice **drafts** exist (`invoice_drafts`: the form kept as JSON, checked and worked out again by the server when issued). Issuing is the only step that takes a number; issued invoices are immutable and gapless (CLAUDE.md).
- Dates are in the business's own time zone (`locale.timeZone`, `todayIn`); there is a scheduler (Vercel cron, `vercel.json`, `CRON_SECRET`) that today only cleans up demos.
- Sending from MakerFlow by email is not built ("coming soon"), so "send automatically" has nothing to send with yet.

## Prototype read
No prototype counterpart. Searched `prototype/src` and `index.html` for recurring, repeat, standing, retainer, monthly and weekly (2026-11-06): no feature, no field and no state function. The only hit is a line of sample data ("Monthly weekend youth bookbinding workshop passes", `data/defaultData.ts`), which is a note on a customer and does nothing. Nothing to keep, change or drop.

## What the maker sees
**One idea, three kinds.** A **repeat** is "make a new one of these, on this schedule". It never changes the one it came from.

- **Start one from what exists.** The ⋯ on a quote, an invoice (and an invoice draft) and a job gets **Repeat…**, and so does the document's own page. A sheet asks: *How often* (every week, every 2 weeks, every month, every 3 months, every year), *On which day* (a weekday, or a day of the month, with "last day of the month" as one choice), *Starting* (a date, default the next one), and *Until* (no end, a date, or after a number of times). *Start repeating* saves it.
- **What it makes, on the day.**
  - **Invoice:** a new invoice **draft** for the same customer and items, dated that day, with the usual due days. It is never issued by itself: issuing takes a legal number and a copy cannot be taken back, so the maker checks it and issues it (today's flow).
  - **Quote:** a new **draft** quote the same way (new number, today's dates).
  - **Job:** a new job, **not started**, for the same customer and items, needed by the date it falls due.
- **Told, not surprised.** Home shows "3 repeats are ready to check" (one line, opens a list of the new drafts and jobs). A repeat made today is marked "Repeat" on its card with a line saying which schedule made it.
- **Seeing and changing them.** Each of the three lists gets a **Repeating** filter, beside its other filters, showing the schedules as cards: what it repeats, how often, **next on** a date, and the last one made. A card's ⋯ has *Pause* / *Resume*, *Change schedule*, *Edit what it repeats* and *Stop repeating*. Stopping never touches anything already made.
- **Edit what it repeats** opens the same form the item is made with (the quote, invoice or job form), so a price rise or a changed item is one edit, and the next one made uses it.
- If a repeat can't make its next one (an item is no longer valid, the business already has 100 invoice drafts) it **pauses itself and says why** on its card and on Home, instead of failing quietly. (Deleting a customer deletes that customer's repeats, as it does their drafts.)

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| A ⋯ on a card | `RowMenu` and `ActionSheet` | As is; one more action |
| A question that takes a form | `Sheet` with the form-errors pattern (`docs/adr/0005-form-errors.md`) | As is |
| Choose one of a few (how often, until) | `ChoiceCards`, `NativeSelect` per `docs/ux-inputs.md` | As is |
| A date (starting, until) | The date field the quote uses (`valid until`, "needed by") | As is |
| A number of times | `QuantityField` is for quantities of things; a count of repeats is a whole number | **Needs a decision**: reuse `QuantityField` with whole numbers only, or a small whole-number field. Recommend `QuantityField` (no new input kind) |
| Filter a list | The status filter pills on each list | One more pill |
| What it repeats | The quote, invoice and job forms | As is, opened on the repeat's stored form |
| Add a repeat | Not a list "add" action: it starts from an item | No `AddButton`; the action is in the ⋯ (ADR 0008 applies to adding new things; this makes one from an existing one) |
| Home nudge | The Home cards and the one-line prompts | As is |

Inputs by kind: how often (choice), day (choice), start and end (dates), number of times (whole number). No address, price or percentage on the sheet.

## Decisions (with a recommendation)
1. **A repeat makes a draft (or a not-started job) for the maker to check; it never issues or sends by itself.** Invoices are legal documents with gapless numbers, a wrong auto-issued one can only be fixed with a credit note, and sending by email isn't built. Later, an opt-in "issue and send automatically" can be added once email exists and a maker has seen drafts come out right for a few months. *Recommended.*
2. **A repeat keeps its own copy of the form**, made when it is started from an item, like an invoice draft keeps its form. Changing the original later does not change the repeat, and deleting the original does not break it. The alternative (a live link to the original) surprises people: editing last month's quote would change next month's invoice. *Recommended.*
3. **Invoices first**, then jobs, then quotes, on one shared engine, because repeat invoices are the clearest need (retainers, workshop passes, standing orders). Quotes repeat least, so last. *Recommended.*
4. **Catch-up:** if a repeat was due while nothing ran (an outage, or a repeat resumed after a long pause), make **one**, dated today, not one for every missed date. The card says "skipped 2 earlier dates". *Recommended.*
5. **Day-of-month rule:** "the 31st" in a month with 30 days falls on the last day; a choice for "last day of the month" is offered. Weekly and fortnightly repeats keep the weekday.
6. **Time zone:** due dates are days in the business's own time zone (`locale.timeZone`), not UTC, so an evening in Johannesburg is not a day early.
7. **Daily run at about 02:00 South African time** by the existing scheduler. A repeat due today is made in the early morning, so it is waiting when the maker opens the app. Hobby-plan cron runs once a day, which is enough.
8. **Prices:** copied as they are; no automatic increase. (A "raise prices by X% each year" setting is a natural later layer.)
9. **A cap:** at most 25 active repeats a business, and a repeat that has made 100 stops, so a mistake cannot fill the account.

## Data (sketch)
- New table `recurrences`: `organisation_id`, `kind` (`quote`, `invoice`, `job`), `customer_id` (same-organisation foreign key, like invoice drafts), `form` (jsonb, size-checked, the kind's form values), `frequency` (`week`, `month`, `year`) and `every` (1 to 12), `day_rule` (weekday 0 to 6, day of month 1 to 31, or "last"), `starts_on`, `ends_on` (nullable), `max_runs` (nullable), `next_run_on`, `paused_at` and `paused_reason` (nullable), `run_count`, `last_run_on`, `created_by`, timestamps. Row-level security through memberships and roles, the restrictive `session_required` policy, a test in `app/supabase/tests/`.
- Which documents a repeat made: a nullable `recurrence_id` on `quotes`, `invoice_drafts` and `jobs` (set null on delete of the repeat), so a card can say "made by a repeat" and the repeat can show what it made. An invoice issued from such a draft keeps no link (the issued invoice is immutable and has no extra fields).
- The daily run is **server-only**: a service-role function (like `issue_invoice_from_draft`) that, in one transaction per repeat, locks the repeat, checks `next_run_on <= today in the business's zone`, creates the draft or job with the same checks and numbering as a maker's own save, moves `next_run_on` forward, and bumps `run_count`. Running it twice on one day makes one (the lock and the date check). **A migration, RLS and a security-definer function that writes documents: needs human review.**
- No money is stored on a repeat: totals are worked out again by the server when the draft is saved and when the invoice is issued. Money is never a float.
- Deleting a customer or organisation deletes its repeats (private working state), as for invoice drafts; `delete_account` removes them explicitly.

## Slices
1. **Engine and invoices:** the table, the schedule maths (a pure, tested module), the daily run, **Repeat…** on an invoice and on an invoice draft, the Repeating filter on Invoices, Home's "ready to check" line. Done when a repeat started today makes a draft tomorrow.
2. **Jobs:** the same for jobs (a job form), with the Repeating filter on Jobs.
3. **Quotes:** the same for quotes.
4. **Later:** pause/resume polish, "raise prices each year", opt-in automatic issuing and sending (needs email).

## Tests
- SQL (`app/supabase/tests/recurrences.test.sql`): row-level security (another business sees nothing, a non-member cannot write), the `session_required` policy, constraints (the caps, a customer from another business refused), the run creates one draft and not two when run twice, never issues an invoice, never creates a gap in numbering.
- Unit: the schedule maths (every week, fortnight, month, quarter, year; the 29th to 31st in short months; last day of the month; leap years; time-zone edges; catch-up gives one), the form checks.
- Browser (phone): start a repeat from an invoice, see it in the Repeating filter with its next date, pause and resume, stop; the daily run is called with the secret and makes a draft that appears on Home and in Drafts; a stopped repeat makes nothing. Accessibility case for the sheet and the filter.
- Every screen walked on a phone viewport before its pull request.

## Questions for the founder (answered 2026-11-06)
All four: the recommendation. Home only for the notice (no email or push).

(Original questions, for the record.)
1. **Draft for checking (recommended), or send automatically?** Automatic issuing and sending waits for email.
2. **Which first?** Recommended: invoices, then jobs, then quotes.
3. **Should a repeat be an exact copy, or should some things change each time?** The most common is a date in the wording ("March workshop pass"). Recommended for now: an exact copy, with the item's wording edited on the repeat when it matters; a small "{month}" fill-in could follow.
4. **Do you want a maker to be told by email or push when drafts are made, or is Home enough?** Recommended: Home is enough for now.

## Not planned yet
Automatic price rises; automatic issuing and sending; reminders for repeat invoices that are overdue (belongs with payment reminders); repeating a **customer's whole statement**; repeats for credit notes (never); calendar view of upcoming repeats.

## Missed from the prototype
(none; no counterpart)

## Built in slice 1 (notes, 2026-11-06)
- **Schedule maths** (`lib/recurrence/schedule.ts`): the weekly, monthly and yearly occurrences are always counted from the starting date (never from the last one), so "the 31st" goes 31, 28 (or 29), 31, 30 and never drifts. Monthly has "last day of the month" as a choice.
- **The day of a weekly repeat is the weekday of its starting date**; the sheet says so ("every Tuesday") rather than asking twice.
- **Dates on what is made:** invoice date is the day it is made; the due date keeps the gap the stored form has.
- **Finished** is a repeat with no next date (its end date passed or it made its last one); it stays listed as "Finished" until the maker stops it, so its history is not lost.
