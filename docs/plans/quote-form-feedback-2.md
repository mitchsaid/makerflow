# Plan: the quote flow, round two (founder feedback, 2026-10-16)

Status: **planned 2026-10-16; five slices, one pull request each, the first in the "rough lane"** (`docs/runbooks/ci-tiers.md`). Slices 2 and 4 change the database (migrations, human review). Follows `docs/plans/quote-form-feedback.md`.

The founder walked the quote flow from the top and sent fourteen observations. Read together they are not fourteen fixes:

1. **The form hands the maker blank fields where a start would do.** The description and the sign-off are empty until a "usual" is saved, so a new maker faces a blank box. (Round one made them empty on purpose, "nothing is invented for them". The founder now says a generic start teaches how the field is used. A starting text is a suggestion that is theirs to change, and a saved usual replaces it.)
2. **A choice that was just made is undone by the next control.** Pressing "Add a discount" opens a box that says "No discount"; the item list leaves an empty square where a photo would go.
3. **Defaults are offered inconsistently.** The deposit already has "Save as my usual" (it looked like plain text, which is why it was missed: fixed in the UI pass), the discount has none, and "how to pay" mixes bank details, a note, and other ways to pay in a way the maker cannot tell apart.
4. **The flow has dead moments.** A generic list skeleton flashes while the preview opens (the "flicker"), the preview has no loading state of its own, "Mark as sent" opens a full-screen sheet that only asks a second button press, and what to do after sending sits below the PDF, the theme and everything else.
5. **Two data gaps.** Customers have one free-text delivery address; a quote's number is never shown to the maker before it is assigned.

## Prototype read

Read in full this round: `prototype/src/components/Customers.tsx` (the add and edit form, lines 85 to 560: state, parse and format of addresses, save, the customer type chooser, the structured billing address, "Use same address for shipping" and the structured shipping address, internal notes; and the list and detail views, 560 to 1057, for what they show and call). Also re-read for this round, from `Quotes.tsx`: the quote number (lines 270 to 280, 421 to 436, 808), the notes and sign-off pre-fills (283), and the step 2 buttons (1870 to 2085). The rest of the creation screen was read in full for round one (see `docs/plans/quote-form-feedback.md`).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Customer form: a "Use same address for shipping" checkbox, **ticked by default**; unticked shows a structured shipping address (street, city, province, postal code, country) | **Kept** (this is what the founder describes). Structured fields come from the locale pack (street, suburb, city, province from the country's list, postal code), the same fields as the main address | The founder: default same as above, otherwise structured |
| The address is stored as one formatted string and parsed back into parts on edit (`parseAddress`, `formatAddress`) | **Changed**: stored as separate columns, never parsed | A parsed string loses data and guesses |
| Country is a free text box on each address | **Changed**: the business's country decides the address shape (locale pack); no country box | Locale packs (ADR 0004) |
| Customer detail view shows "Same as billing address" when there is no separate shipping address | **Kept**: the customer page and the quote's delivery choices say "Same as the address above" | |
| Quote number: editable, with an automatic one filled in (`QT-year-index`); the maker may overwrite it | **Changed**: shown (read-only) before it is assigned, with a gear-style way to change the numbering (prefix, next number); never overwritten per quote | Gapless numbering is a rule (CLAUDE.md); the founder points to how Zoho does it: the number sits on the form with a settings control beside it |
| Notes pre-filled with a fixed sentence about a 50% deposit and delivery; sign-off pre-filled with "Thank you so much for your business!" | **Changed again**: description and sign-off start from a **generic, polite wording from the locale pack** when the business has not saved its own; notes stay empty (the prototype's sentence made promises about deposits and couriers) | The founder (reverses round one for these two fields) |
| Step 2 "Mark as Sent" is one button that marks the quote | **Changed**: one tap opens a small confirmation that says what locking does, with Mark as sent and Cancel | The founder: a short confirmation, not a second full screen |
| After sending, the quote's actions are a row of buttons at the top of its detail | **Kept in spirit**: "What you can do next" moves to the top of the sent quote | The founder |
| Discount: quote-level toggle revealing a value row | **Kept**; the kind starts as a percentage | The founder |
| Deposit (structured), balance due, bank details switch, per-item discount "usual" | **No prototype counterpart** (the prototype used free text in notes) | MakerFlow additions |

## Where things stand
- `customers.delivery_address` is one text column (up to 400 characters). `quotes.delivery_address` is text too (a snapshot): the quote's "different address" is typed free.
- Quote numbering lives under Quotes and invoices (`quote-numbering-form.tsx`, `numbering-actions.ts`); a number is assigned at first save.
- The deposit has "Save as my usual" (round one) but not for the discount; the discount is a quote-level kind and value only.
- The balance is due "on collection or delivery" or "by a date"; nothing else.

## What the maker sees

### Slice 1: small changes, no database (rough lane: UI only, straight to dev)
1. **"Using your usual …"** instead of "Back to your usual …" (it read as an instruction).
2. **Item list: a photo only when there is one.** No empty square (this reverses a detail of last round's photos: the founder prefers the plain title to a grey box).
3. **Discount starts as a percentage.** Pressing "Add a discount" opens it with "A percentage" chosen and the box ready; "No discount" stays in the list to undo it.
4. **A generic start for the description and the sign-off** when the business has no usual: *"Thank you for your interest. Below is what I would prepare for you."* and *"Thank you for the opportunity to quote. Please get in touch with any questions."* (final wording in the locale pack, so another country can word its own). A saved usual replaces it. Existing quotes are not touched; clearing the box leaves it clear on that quote.
5. **Mark as sent is one small confirmation**: tapping it opens a short bottom sheet ("Mark this quote as sent?", what locking means, **Mark as sent** and **Cancel**). Problems that stop sending (no customer, no items, no contact details) show in the same sheet, as now.
6. **Loading states that match the page.** The preview, the quote and the new quote each get a skeleton shaped like themselves (today the Quotes list skeleton flashes in between, which is the flicker). The action bars are lifted onto their own layer so they do not repaint with the page. (The device flicker could not be reproduced here; the founder retests on the phone.)
7. **After sending, "What you can do next" is at the top** of the sent quote, under the Download and Revise buttons and above the PDF. The "coming soon" cards (email, accept online) go below the PDF. A sentence under "Has your customer answered?" says that once they accept, the quote can become a job.

### Slice 2: delivery address on customers (migration)
- A customer has a "Delivery address" part: **"Same as the address above" ticked by default**. Unticked, it shows the same structured fields as the address (street, suburb or building, city, province, postal code). The quote's delivery choices and the print use it.
- New columns `delivery_same_as_main boolean default true`, `delivery_address_line1`, `delivery_address_line2`, `delivery_city`, `delivery_region`, `delivery_postal_code`, via the same grants and functions as the main address. Existing free-text delivery addresses are carried over into the line-1 column with "same as above" off, so nothing is lost; the old column stays as a backup, no longer written.
- The quote's own "a different address" box **stays a text box** for now: the quote stores the printed text as a snapshot, so structured parts there would need columns on quotes and a replaced `save_quote_draft` as well. The founder's request was about the customer form; say if the quote's box should follow.

**Built (slice 2, 2026-10-16; needs human review: migration `20261103100000_customer_delivery_address.sql`):** `customers.delivery_same_as_main` (default true) and five structured delivery columns, a check that "same as above" carries no separate parts, existing free-text addresses carried into the first line with "same as above" off, and column grants. The old `delivery_address` column is kept and no longer read or written. The customer form's **Delivery** section is a "Same as the address above" tick (on by default); unticked it shows the same fields as the address (a shared `AddressFields` component, shaped by the country), and leaving them empty says how to fix it. The quote's "deliver to" choices read the structured address. The Business profile's own address now uses the same `AddressFields` (with the phone's autofill hints and the four-digit postal code limit passed in), so there is one structured-address interaction. A carried-over address can be longer than the form's 120 characters: editing such a customer asks for it to be shortened before saving. A draft quote that holds a customer's old multi-line address still follows it, because addresses are compared ignoring commas.

### Slice 3: the quote number, shown (no migration)
- "About this quote" shows **Quote number QT-0004** ("given when you save"), with a **Change numbering** button that opens a sheet holding the same prefix and next-number form that lives under Quotes and invoices (reused with a mode, not copied). The number is never typed onto a single quote, so numbering stays gapless.

**Built (slice 3, 2026-10-16; no database change):** "About this quote" on a **new** quote starts with **Quote number QT-0004** ("Given when you first save it."), read from the business's numbering (one more parallel read on the new-quote page, like its other lists). Owners and admins get a **Change** button that opens a sheet with the same prefix and next-number form as Quotes and invoices (`QuoteNumberingForm` gained an `embedded` mode, as the term, logo and customer forms did); saving there changes the numbering for all quotes and the number on the quote follows, with everything typed on the quote kept. A saved quote shows its number in its heading, as before, and no longer needs the row.

### Slice 4: discount and balance (migration)
- **Discount: "Save as my usual"** (the same button as the others; the founder suggested a checkbox, but the app has one way of saving a usual and a second would be a second thing to learn; tell the founder), saved as `default_discount_kind`/`default_discount_value` on the business, with a new quote starting with it open.
- **Deposit's "Save as my usual"** shows as a button now (it was there, as plain text).
- **Balance due: "Other"**: a third choice with a short text box ("14 days after delivery"), kept on the quote, in the snapshot, printed in place of the date.

**Built (slice 4, 2026-10-16; needs human review: migration `20261104100000_discount_usual_and_balance_other.sql`, a replaced `save_quote_draft`):** `business_profiles.default_discount_kind` and `default_discount_value` (none, a percentage in basis points 1 to 10000, or an amount in cents of 1 or more, the same shape as a quote's own discount); `quotes.balance_due` may be `'other'` with `quotes.balance_due_text` (1 to 120 characters, required exactly when it is `'other'`), carried by `save_quote_draft` (a payload without the balance keys keeps what the draft has). On the quote: the discount section has "Save as my usual" / "Use my usual" (the same buttons as the other usuals), and a new quote starts with the usual discount already open; **Quotes and invoices gets a Discount section** (set, change or remove it) beside Deposit; the deposit's "Balance due" has a third choice, **Other: I'll say when**, with a text box ("For example: within 14 days of delivery"), printed after "Balance, due" (the locale pack's `dueOther`); a leading "due" the maker types is dropped so it is not said twice. The deposit's usual buttons were already there; since the UI pass they look like buttons.

### Slice 5: how to pay (no migration likely)
- Reword and split the section so it says what each part is: **Bank details** (show on this quote: yes or no, with the summary), then **Notes about paying** (the existing text, relabelled, with "SnapScan, PayShap, or pay on collection" as its example), printed under the bank details. Founder to confirm the wording on dev; may need a per-quote note column.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Structured address on a customer's delivery part and on a quote | The customer form's address fields | **Reused**: pulled out into one shared `AddressFields` component (a mode for "different from above") |
| Change numbering from the quote | `quote-numbering-form.tsx` under Quotes and invoices | **Reused** in a sheet (embedded mode, as the term, logo and customer forms are) |
| Save a default from where it is used | `UsualButtons` | **Reused** for the discount |
| Set a default deposit or discount under Quotes and invoices | `DepositDefaultForm` | **Shared**: one `DefaultAmountForm` with a mode (the choices, the words, the action); the deposit and discount forms are thin wrappers |
| Confirm locking | `SendQuoteSheet` | **Changed**: a compact bottom sheet |
| Loading while a page opens | `quotes/loading.tsx` skeletons | New skeletons per page (the list one was the wrong shape) |

## Decisions
- Reverses two round-one details at the founder's request: a generic start for description and sign-off; no empty thumbnail.
- Discount usual is a button, not a checkbox: for the founder to overrule.
- "Create a job" stays after acceptance (a job is made from an accepted quote); "What you can do next" moves up so it is found.

## Data
Slice 2: seven columns on `customers` (and the functions that read and write a customer); slice 4: two columns on `business_profiles`, a balance-due text on `quotes`, and the replaced `save_quote_draft`. All human review.

## Tests
Slice 1: browser (discount starts as a percentage; description and sign-off start generic and a usual replaces them; Mark as sent opens one small confirmation and Cancel closes it; the item list shows no empty square; "What you can do next" comes before the PDF), unit (wording from the locale pack), accessibility cases. Slices 2 to 5 as built.

## Not planned yet
Online accept link and email (need a sending domain); the wall of terms (the founder will say more).
