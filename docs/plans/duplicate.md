# Plan: duplicate a quote or an invoice from its ⋯ menu

Status: **slice 1 (quotes) built 2026-10-31; slice 2 (invoices) planned.** Founder, 2026-10-31: "Want to be able to duplicate quotes and invoices (via the three dot menu on the list item)."

## Prototype read
No prototype counterpart. A search of `prototype/src/components/Quotes.tsx`, `Invoices.tsx` and `hooks/useAppState.ts` for duplicate, clone and copy found nothing that copies a quote or invoice (the one hit, "A copy of the complete quote has been emailed", is about email). Nothing to keep, change or drop.

## What the maker sees
**Quotes (slice 1).**
- The ⋯ on a quote's card has **Duplicate** for every quote, whatever its status (draft, sent, accepted, declined, withdrawn). The job actions stay first and *Delete draft* stays last.
- Duplicate asks first ("Duplicate this quote?": a new draft with the same customer, items and wording, a new number and today's dates; this quote is left as it is), because it takes a number. *Not now* changes nothing.
- It then opens the new draft, saved, with its own number. The original is untouched.
- What is copied is what the quote says now: for a draft, as it stands; for a sent quote, as it was sent. The customer, items (with their choices and prices), delivery, discount, deposit, terms, how to pay, notes and wording are copied. The dates are today's (valid for the usual number of days), a "needed by" date in the past is dropped, and a balance due on a date that has passed goes back to "at handover". The new quote takes the theme chosen last, as every new quote does.
- This is the same copy "Quote again" makes on a sent quote's page (`quoteAgain`), now also offered for drafts.

**Invoices (slice 2, not built).** The ⋯ on an invoice's card, and on a draft's, with **Duplicate**: a new invoice **draft** (never a numbered invoice) with the same customer and items, today's date and the usual due day, opened for checking before it is sent. An invoice made from a quote starts from its own items, not the quote's. Needs: a ⋯ on the invoice and draft rows (they have none yet); for a draft, its form copied; for a sent invoice, its document turned back into a form. That last step is money: the document's prices include what choices add, so the base price is worked out by taking those off, and a unit test must show that the copy totals exactly what the original did before it is built. **Needs human review.**

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A ⋯ on a card | `RowMenu` and `ActionSheet` (docs/plans/ux-pass-3.md) | As is; one more action |
| A question before something that takes a number | `ConfirmSheet` (as *Create a job?*) | As is, default tone |
| A copy of a quote | `quoteAgain` (`toFormValues`, `datesForCopy`, `saveQuoteDraft`) | The same function, now also for drafts (`duplicateQuote`) |

Inputs by kind: none.

## Data
No database change. A copy is saved the way any new draft is (`save_quote_draft`: checked, priced on the server, numbered).

## Tests
- Unit: which actions each status offers (`row-actions.test.ts`).
- Browser (`e2e/card-menus.spec.ts`): a sent quote asks first; *Not now* changes nothing; Duplicate opens the next number as a draft with the same customer; the original is still sent; a draft can be duplicated too.
