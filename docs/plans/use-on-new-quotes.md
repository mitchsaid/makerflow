# "Use this … on new quotes": keeping what is on a quote for every new quote

## Status
Built 2026-10-26. Founder: "come up with a good option to allow a maker to indicate after adding a discount that they want this to be saved as a default with new quote; same for terms; same for delivery or collection choice; you can suggest other places it should apply."

## Where things stand
- The quote form had "Save as my usual …" and "Use my usual …" buttons (`usual-buttons.tsx`, docs/plans/quote-form-feedback.md) for the intro, the discount, the deposit, the sign-off message and the other ways to pay. The save button showed only once something differed from the usual, and nothing said what the usual was, so the founder did not find it.
- Delivery or collection and the terms could only be set for new quotes in Quote settings (the usual hand-over; a term's "Include on new quotes").

## Prototype read
No prototype counterpart.

## What the maker sees
At the end of each section that new quotes can start with, one tick that says what it does:
- *Use this intro on new quotes* (About this quote)
- *Start new quotes with delivery* / *… with collection* (Delivery or collection; the choice, not the fee or the address)
- *Use this discount on new quotes*, *Use this deposit on new quotes*
- *Add “Lead time” to new quotes*, on each saved term on the quote
- *Use these ways to pay on new quotes* (How to pay)
- *Use this sign-off on new quotes* (the message and who signs, with the name typed for "Another name")

The deposit tick shows also when the business decides the deposit on every quote ("I decide on each quote"): ticking then makes this deposit the usual instead. The intro and sign-off ticks show whenever there is a message, the country's generic one included (founder, 2026-10-26: "I don't see the option for requiring a deposit on new quotes").

The tick is **ticked when the quote already matches** what new quotes start with, so it also shows the usual. Ticking saves what is on the quote at once ("New quotes now start with this discount."); unticking stops it ("… no longer start with this discount": no discount, no deposit, nothing chosen, the generic intro and sign-off, the term left off). Quotes that exist never change. It shows only when there is something to keep (an amount, the maker's own words, a choice), and only to owners and admins. *Use my usual …* stays, for putting the usual back on a quote that differs. Quote settings still shows and changes all of it.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Say "keep this for new quotes" | `UsualButtons` (a Save button) | **New**: `UseOnNewQuotes`, a `Checkbox` with its label (as "Include on new quotes" on a term), replacing the buttons: one control that both shows and changes the usual. *Use my usual* moves into it unchanged |
| Save the usuals | Quote settings' actions (`saveDiscountDefault`, `saveDepositDefault`, `saveHandoverDefault`) and the usual actions | As is; one new action for the sign-off as a whole, one for a term's place on new quotes |

Inputs by kind: one tick per section (a yes/no choice). No new address, quantity, date or money input.

## Decisions
1. **Saved at once, not with the quote.** A usual is about the business, not the quote: cancelling the quote should not undo it, and the tick shows the truth at every moment. (The alternative, saving it with *Save draft*, leaves a tick whose meaning changes after saving.)
2. **Unticking clears the usual** rather than doing nothing, so the tick always means "new quotes start with this".
3. **Delivery keeps the choice only.** The fee and the address differ by quote; a usual fee is a suggestion below.

## Data
No migration. The same columns as Quote settings: `default_description`, `default_discount_*`, `default_deposit_*`, `usual_fulfilment`, `payment_instructions`, `default_sign_off`, `sign_off_as`, `sign_off_other`; and `policies.include_by_default`. Owners and admins only (the database checks too).

## Tests
- Browser (`e2e/quote-usuals.spec.ts`): each tick keeps its section for new quotes, shows ticked when matching, unticks when changed, *Use my usual* puts it back, unticking stops it; delivery or collection and a term with their ticks. The accessibility case checks the tick.
- Unit: the usuals carry delivery or collection and who signs.

## Suggested next places (not built)
1. **Valid for** (7, 14, 30, 60 days): a usual for how long a quote is valid (needs a column).
2. **The delivery fee**, with *Start new quotes with delivery* (needs a column).
3. **Show my bank details** and **Show product photos**: the two switches on a quote.
4. ~~The quote theme~~: not needed. A new quote already starts with the theme picked last (docs/plans/quote-themes.md), which the founder confirmed is what they want (2026-10-26).
5. **Invoices**, once invoice wording lives under Invoices: due in N days, the note.
6. **A product's price on a quote**: "Save as the product's price" when a price is changed on an item (a different kind of default; worth asking first).

## Missed from the prototype
Nothing found.
