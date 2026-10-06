# Plan: quote deposits (and where quote and invoice defaults live)

Status: **plan approved by the founder 2026-10-06 (the three-place split and plainer wording). The split is built first, in its own change; deposits follow.** Money logic and the database are touched, so it needs human review. Builds the "Deposits" part of `docs/plans/quotes.md` (slice 5); inclusions and exclusions are dropped as a separate feature (founder, 2026-10-06: exclusions become a policy example, inclusions are the item lines).

## Decisions so far (founder, 2026-10-06)
1. **Balance due: on collection or delivery, or by a date the maker picks.** No "N days" terms.
2. **Defaults live apart from the business facts.** The founder suggests quote settings separate from business settings, shared with invoices. Proposed below.

## What the maker sees
- **On the quote: a Deposit section** (after Discount). A tick, "Ask for a deposit to start work". When ticked: how it is worked out (a percentage of the total, or a fixed amount), the value, and when the balance is due ("On collection" / "On delivery" / "On collection or delivery", following the quote's own delivery or collection choice; or "By a date" with a date). A live line shows the result: "Deposit R1 250,00 · Balance R1 250,00".
- **On the document (preview, PDF, text version):** under the totals, in the maker's country's words: "Deposit to start work: R1 250,00 (50%)" and "Balance R1 250,00, due on collection" or "due by 14 Nov 2026". VAT-registered quotes say the amounts include VAT. Frozen in the snapshot like everything else.
- **Defaults:** a business can set a default deposit (for example 50%); new quotes start with it ticked, and each quote can change or switch it off. The balance term always starts as "on collection or delivery" (a date cannot be a default).
- **Not asked of anyone who does not want it:** off until a maker ticks it or sets a default.

## Where the defaults live (proposal; needs your yes)
Today everything sits on the Business profile page: business details, what you make, bank details, quote wording, quote numbers, and a link to policies. It is long and will get longer when invoices arrive. Proposal, a third place:
- **Business profile** stays for **facts about the business**: name, contact, address, VAT, what you make, bank details.
- **Quotes and invoices** (new page, `/app/documents`, a second row under More) holds **how documents are numbered, worded and what they start with**: quote numbers, quote wording, the policies library, the default deposit. Invoices get their own sections on the same page later.
- **Settings** stays for the person and the app.
- This moves existing sections (no data changes) and amends the "Business profile vs Settings" rule in `CLAUDE.md` to name the third place. If you would rather not move anything yet, the default deposit goes on the Business profile for now and moves with the rest later.

## Rules (money)
- Money is integer cents and basis points. The deposit uses the existing, tested `calculateDeposit` (`lib/money/document.ts`): a percentage is of the **total including VAT**, rounded to the cent; a fixed amount is capped at the total; **balance = total - deposit**, so they always add up exactly. Computed on the server when the quote is saved or previewed.
- Checks (each with a message that says how to fix it): a percentage is above 0 and up to 100; a fixed amount is above 0 and not more than the total (it is checked again when the quote is sent, because the total can change); a balance date is a real date, not before the quote date.
- A deposit that is a part payment is a **part payment for VAT** (`docs/locales/za/vat-and-documents.md`, answer 3). The quote only states the terms in plain words ("Deposit to start work"); the part-payment fact is left to the invoice (founder, 2026-10-06: plainer wording, things are getting too legalistic); the deposit tax invoice and the final invoice that credits it belong to the invoice slice. A refundable security deposit (for example a cake stand) is a different thing and is not built.
- The wording and the label live in the locale pack, not in screens.

## Data
- `quotes`: `deposit_kind` ('none', 'percent', 'fixed', default 'none'), `deposit_value` (basis points or cents), `balance_due` ('handover' or 'date'), `balance_due_date`. Checks: value is not negative and a percentage is at most 100%; a date is present exactly when the term is 'date'. Column grants as for the other quote columns; `save_quote_draft` carries them (replaced a fourth time, copied from the current version with the new columns added; it stays security invoker).
- `business_profiles`: `default_deposit_kind`, `default_deposit_value` (same checks). Owners and admins change them (the existing profile policy and a new column grant).
- The snapshot carries the deposit terms and the calculated amounts. Old snapshots have none and render as before.
- Sent quotes stay immutable: the deposit is frozen with the version.

## Not built
Staged milestones (30/40/30), refundable security deposits, "N days" terms, recording that a deposit was received and the deposit tax invoice (invoice slice), asking the customer to pay the deposit online.

## Tests
Unit: percentage and fixed deposits, rounding, balance always adds up, caps, the checks and their messages, a changed total on a fixed deposit, the balance wording (collection, delivery, either, date), old snapshots. SQL: the checks, column grants, owners and admins only for the default, `session_required` unchanged, `save_quote_draft` carries the columns and an old payload still saves. Browser: tick a deposit, see the live line, preview and PDF text, switch off, a business default starting new quotes, errors at the fields and in the summary, a sent quote keeping its deposit. Accessibility cases for the section and the default form. `pnpm perf` unchanged.

## Decided (founder, 2026-10-06)
1. The three-place split is approved. "Settings" for quotes and invoices lives on the Quotes and invoices page itself; the separate Settings screen stays for the person and the app only. More will land on that page: invoice numbering and wording, a default design (logo and colours) when designs arrive, and the default quote validity (now fixed at 14 days).
2. Plainer wording: "Deposit to start work". No "part payment of the price" on the quote.
