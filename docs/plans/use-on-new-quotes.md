# "Use this … on new quotes": keeping what is on a quote for every new quote

## Status
Built 2026-10-26. Founder: "come up with a good option to allow a maker to indicate after adding a discount that they want this to be saved as a default with new quote; same for terms; same for delivery or collection choice; you can suggest other places it should apply."

## Where things stand
- The quote form had "Save as my usual …" and "Use my usual …" buttons (`usual-buttons.tsx`, docs/plans/quote-form-feedback.md) for the intro, the discount, the deposit, the sign-off message and the other ways to pay. The save button showed only once something differed from the usual, and nothing said what the usual was, so the founder did not find it.
- Delivery or collection and the terms could only be set for new quotes in Quote settings (the usual hand-over; a term's "Include on new quotes").

## Prototype read
No prototype counterpart.

## What the maker sees
A quiet text link under each section that new quotes can start with, only while there is something worth keeping that is not the usual yet:
- *Use this intro on new quotes* (the intro, once it is the maker's own words: the country's generic start is what new quotes begin with anyway)
- *Start new quotes with delivery* / *… with collection* (the choice, not the fee or the address)
- *Use this discount on new quotes*, *Use this deposit on new quotes* (also when the business decides the deposit on every quote)
- *Add “Lead time” to new quotes*, on each saved term that is not on new quotes yet
- *Use these ways to pay on new quotes*
- *Use this sign-off on new quotes* (the message and who signs, with the name typed for "Another name")

Pressing it saves at once; the link goes, and a line says so ("New quotes now start with this discount. You can change it in Quote settings."). It is not there on a quote that already matches the usual, so a maker who has set things once never sees it again, unless a quote differs. Quotes that exist never change. Only owners and admins see it. *Use my usual …* stays, for putting the usual back on a quote that differs from it. **Changing or stopping a usual is done in Quote settings** (and the Terms library for a term), where all of them already live; the quote form does not carry controls for it.

*History:* the first version (2026-10-26) was a tick on every section, ticked when the quote matched. The founder found a tick on every new quote too much for something done once and rarely changed ("maybe more subtle, or a small setting?"), so it became this link.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Say "keep this for new quotes" | `UsualButtons` (a Save button) | **New**: `UseOnNewQuotes`, a `link`-variant button that appears only when there is something new to keep, replacing the buttons: one quiet control that makes the usual and then goes. *Use my usual* moves into it unchanged |
| Save the usuals | Quote settings' actions (`saveDiscountDefault`, `saveDepositDefault`, `saveHandoverDefault`) and the usual actions | As is; one new action for the sign-off as a whole, one for a term's place on new quotes |

Inputs by kind: one action per section. No new address, quantity, date or money input.

## Decisions
1. **Saved at once, not with the quote.** A usual is about the business, not the quote: cancelling the quote should not undo it, and the note says what happened. (The alternative, saving it with *Save draft*, leaves a link whose meaning changes after saving.)
2. **Stopping it lives in Quote settings.** It is rare, and one place for it is clearer than a control on every quote.
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
