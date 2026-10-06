# Plan: quote outcomes (slice 6)

Status: **built 2026-10-06** under the founder's "full steam ahead, only pause for major decisions". The migration needs human review (RLS-adjacent, a new service-role function) and a yes before it is deployed.

## Goal
After a quote is sent, the maker can write down what happened to it, in a few taps and plain words, and can start a new quote from an old one. Nothing is sent to the customer: this is the maker's own record, until emailing and online accepting exist.

## What the maker can do
- **They accepted / They declined** (on a sent quote): pick the day (today by default), how they told you (WhatsApp, Email, In person, Phone call, Other), and an optional note. The quote's label becomes Accepted or Declined and a line appears in the activity log.
- **Change the answer** (on an accepted or declined quote): puts the quote back to Sent so a different answer can be recorded. The earlier answer stays in the activity log.
- **Withdraw this quote** (on a sent quote): an optional note, then it is marked Withdrawn. It stays on record. Withdrawing is final; **Quote again** covers a mistake.
- **Quote again** (on the latest sent version of a quote, in any status but draft): a new draft for the same customer with the same items, wording, policies and deposit. It gets a new number and fresh dates (dates that have already passed, such as a needed-by date or a balance due by a date, are dropped). The old quote is untouched.
- **Revise** stays what it was: only on a Sent quote. An accepted quote is changed by first choosing "Change the answer".

Not built, still shown as "coming soon": **Create a job** (on an accepted quote), emailing the quote, the online accept link. Not built, not shown: discarding a revision (it needs a draft rebuilt from a frozen version; the founder can ask for it).

## Design decisions
1. **The answer lives in the activity log, not on the quote.** Each answer is an event (`accepted`, `declined`, `withdrawn`, `reopened`) carrying the day, how, and the note. The quote only has its status. What the banner shows is the latest event, so there is one source of truth and nothing to keep in step.
2. **Only the server changes the status.** `record_quote_outcome` is a security-definer function that only the server's key can run, the same pattern as `send_quote` and `revise_quote`. The person's own session proves the quote is theirs first.
3. **Allowed moves:** sent to accepted, declined or withdrawn; accepted or declined back to sent (`reopened`). Everything else is refused (`P0002`).
4. **An expired quote can still be answered.** "Expired" is only a label on a Sent quote; customers do accept late.
5. **The answer's day can't be in the future** and is checked by the server (the business's own "today"). The database checks the shape.
6. **Quote again goes through the normal save**, so the new draft is checked, priced and numbered exactly like any other. No new database function.

## Database (migration `20261011100000_quote_outcomes.sql`)
- `quote_events.kind` also allows `accepted`, `declined`, `withdrawn`, `reopened`.
- New nullable columns on `quote_events`: `on_date date`, `how text` (`whatsapp`, `email`, `in_person`, `phone`, `other`), `note text` (up to 500 characters).
- Checks: `on_date` and `how` are present for accepted and declined and absent otherwise; a note only goes with accepted, declined or withdrawn.
- `record_quote_outcome(p_org, p_quote_id, p_actor, p_outcome, p_on, p_how, p_note)`: service role only; locks the quote; moves the status; logs the event.
- Tests in `app/supabase/tests/quote_outcomes.test.sql`: signed-in users cannot call it; each allowed and refused move; the checks; another business's quote is not found; events stay members-only to read.

## App
- `lib/quotes/outcome.ts`: the ways of telling (labels), validation of the form, wording for the log and the banner.
- `app/quotes/outcome-actions.ts`: `recordOutcome`, `reopenQuote` (admin-client pattern), and `quoteAgain` in `actions.ts` (reuses the draft save).
- `app/quotes/quote-outcome.tsx` (the accepted, declined and withdrawn sheet, Change the answer, Quote again) on the sent quote page, shown only on the latest sent version; an outcome banner; log wording; Quotes list filters for Accepted, Declined and Withdrawn.

## Tests
Unit (outcome validation and wording), SQL (above), browser (accept, decline with a note, change the answer, withdraw, quote again, the log), accessibility cases for the sheets and the banner.
