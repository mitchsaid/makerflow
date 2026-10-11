# Questions for a South African tax adviser: VAT on costs and margins

Status: draft for the founder to send, 2026-10-11. It goes with `docs/plans/costs-and-recipes.md` (decision 11, "VAT on costs"). Building does not wait for the answers; the VAT wording on the materials form and the margin note should not be treated as final until they are in. **This is not tax advice.**

## What MakerFlow does (so the adviser can judge it)
- A maker records what they buy to make things (a "material"): a quantity, and the **price paid** for it.
- For a business that is **not VAT-registered**, the price paid is the cost. Nothing about VAT is asked.
- For a **VAT-registered** business, each material says what the price paid **includes**: "Includes VAT" (the default, what a shop till shows), "Excludes VAT", or "No VAT charged" (the supplier is not a VAT vendor).
- The app works out the cost **without VAT** (for "Includes VAT" it divides by 1 + the standard rate, 15% today, read from one place in the app) and uses that for **margin**: the item's price without VAT minus that cost.
- The app does **not** compute VAT payable, input VAT, or what can be claimed. It tells the maker so, on the form: "Costs and margins are worked out without VAT, so VAT you claim back is not counted as a cost. We don't work out what you can claim: that is for you and your adviser."
- Margins are a management figure for the maker. Nothing is filed or reported to SARS.

## Questions
1. **Approach.** Is working out cost and margin **without VAT for a VAT vendor**, and with the full price paid for a non-vendor, the right treatment for a management margin? Is there a case where a VAT vendor should treat part of the VAT as a cost (for example, VAT on purchases that cannot be claimed)?
2. **Wording.** Is the note above clear and safe? Could "VAT you claim back is not counted as a cost" lead someone to assume they can claim VAT they cannot? What would you change?
3. **"No VAT charged".** For purchases from suppliers who are not VAT vendors (a market stall, a private seller), is "the whole price is the cost, and nothing is claimed" correct for a vendor? Anything to warn about (for example, the deemed input tax rules on second-hand goods)?
4. **Not every purchase is claimable.** Beyond a valid tax invoice (full over R5 000, abridged up to R5 000, none needed for R50 or less), which common maker purchases are **not** claimable or only partly (entertainment, motor vehicles, goods used for exempt supplies, a business that makes both taxable and exempt supplies)? Should the app only add a general warning, or ask per material?
5. **Voluntary and small businesses.** Anything different for a business registered voluntarily, or on turnover tax (for example whether turnover-tax businesses should be treated as "not VAT-registered" here)? Is it correct to treat them that way?
6. **Rate changes.** If the standard rate changes, should costs already recorded as "Includes VAT" be worked out at the new rate or the rate that applied when they were bought? (Today the app uses the current rate; the plan is to keep the rate on each purchase once purchases are recorded.)
7. **Registration date.** A business that registers for VAT after buying stock: what should happen to materials it recorded before registering (today they stay "No VAT charged": the price paid is the cost)?
8. **Records.** Does the app, by showing costs without VAT, risk being mistaken for a record that SARS expects (tax invoices, VAT 201 workings)? What should it say so it is never taken as one?

## What we would do with the answers
Reword the form note and the margin note, add any warning the adviser wants, decide whether "includes VAT" needs a rate-per-purchase, and record the outcome in `docs/plans/costs-and-recipes.md`.
