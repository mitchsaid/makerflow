# Plan: "Turn into a job" after Mark as sent

Status: **planned and built 2026-10-22**, from the founder's list (2026-10-22: "'Turn into a job' after Mark as sent"), answering the question left open since 2026-10-15 ("should 'turn into a job' be offered right after Mark as sent?"). One small slice, **no database change**.

## Where things stand
- Mark as sent locks a quote and shows a banner ("QT-0001 is marked as sent and locked."). The customer's answer is recorded later (They accepted, with the day and how they told you), and a "Create a job?" card follows an acceptance. Only an accepted quote can become a job.
- Many makers start work on a "yes" that came before they marked the quote as sent, or in the same breath.

## Prototype read
| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Accepting a quote creates its job and invoice at once, with no question asked (`recordQuoteAccepted`) | **Changed:** nothing automatic. Right after Mark as sent the banner asks "Already a yes?" and offers **Turn into a job**, which records the acceptance (the day and how they told you) and makes the job in one go | A job and an acceptance are the maker's decisions; the acceptance is still recorded the same way, with the same fields |

Read in full 2026-10-17 and 2026-10-18 (`useAppState.ts`; see `invoices-and-payments.md` and `jobs-and-invoices.md`).

## What the maker sees
Right after **Mark as sent**, under the "marked as sent and locked" banner: **"Already a yes? Record it and start the job."** with a **Turn into a job** button. It opens the same sheet as **They accepted** (day, how they told you, an optional note), titled "Turn into a job", with **Save answer and create job**. Saving records the acceptance and opens the new job. The quote's normal "Has your customer answered?" card stays below for everything else; the offer is only on the page right after marking, and is not offered to someone who said "Don't ask me again" to job prompts.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Recording an acceptance (day, how, note) | The They accepted sheet (`OutcomeForm` in `quotes/quote-outcome.tsx`) | A `thenCreateJob` mode: the same fields and checks; after saving it also makes the job |
| Making the job | `createJob` (`jobs/actions.ts`) | As is |
| A friendly offer inside the banner | The banner and `Alert` | As is |

Inputs by kind: the same as the They accepted sheet (a date, a choice, a note).

## Decisions
1. **It is the existing acceptance, not a shortcut around it:** the same sheet, so the record (day, how, note) is never skipped. *Recommended.*
2. **Only on the page right after Mark as sent**, not later: later the quote has its own answer card and job button.
3. **Respects "Don't ask me again"** for job prompts (`create-job`).

## Data
None. It calls the two actions that already exist (`recordOutcome`, then `createJob`).

## Tests
Browser: mark a quote as sent, Turn into a job, fill the sheet, the job opens; the quote now says accepted and has the job; the offer is not there on a reload. Accessibility: the banner with the offer.

## Not planned yet
Offering it from the Quotes list.
