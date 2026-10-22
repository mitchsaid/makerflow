# Plan: costing slice C, easier to price

Status: **planned and built 2026-10-22** (see "Built" at the end), from the founder's list (2026-10-22: "Costing slice C: target margin and price hints"). It is slice C of `costing-and-margin.md`. One migration (**money-adjacent column on the business profile: human review**).

A maker who knows what a product costs to make still has to work out the price. Slice C lets them say the margin they aim for, then shows where an item stands against it and what to charge to reach it. Nothing is ever applied behind their back.

## Where things stand
- Costs on a product, the margin on a draft quote and on a sent quote (frozen), a one-off item's typed cost (`costing-and-margin.md`, slices A and B).
- The Business profile has "What your time is worth" (an hourly rate), its own small form.
- The item sheet already has a "Use R…" link for a product's own price (`product-price-hint`), which is the pattern a price hint follows.

## Prototype read
Read in full on 2026-10-17 for the costing plan (`InternalQuoteFinancials.tsx`, `AdvancedCustomItemModal.tsx`, `Products.tsx`); the two behaviours this slice finishes were listed there as "later".

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A margin **badge** on the quote panel: green at 20% and over, amber below, the 20% fixed in code | **Changed:** the line is compared with **the margin the maker says they aim for** (Business profile), in words ("meets your 40% target", "below your 40% target") as well as colour; with no target set nothing is judged | A hard-coded 20% is not every maker's number; colour alone is not enough |
| **"Apply Cost + 50% Margin"** button in the one-off item dialog (price = cost × 1.5) | **Changed:** "For your 40% target, charge R…" with **Use R…**, worked out as a margin on the price (cost ÷ (1 − margin)), not a mark-up on the cost, rounded up to the cent, in the way the price is entered (with or without VAT) | A 50% mark-up is a 33% margin; the app says "margin" everywhere, so the arithmetic must mean margin |
| The product form's summary shows base cost, price, profit and margin % | **Kept (slice A)**, now with where it stands against the target and the price for the target | |
| No target margin anywhere | **New:** one optional setting | The founder asked for it |
| The product **list** shows nothing about margin | **Later:** the list would need every product's cost lines and the materials on one page; not in this slice | Speed (ADR 0002) |

Missed from the prototype: nothing found.

## What the maker sees
- **Business profile:** a small form **"The margin you aim for"**: a percentage, optional ("Used to show where a product or a quote stands, and to suggest a price. Margin is what is left of the price after costs."). Owners and admins can change it, as for the hourly rate. Empty means no target and none of the below appears.
- **Product form, under "What it costs to make"**: each summary line ends with where it stands, in words: **"Meets your 40% target."** or **"Below your 40% target: for 40%, charge R86,67 without VAT."** (the price without VAT, as the summary already says).
- **Quote, "Only you see this: margin R… · …%"**: after the figure, **"meets your 40% target"** or **"below your 40% target"**; in the breakdown, an item below target says **"For 40%, sell it for R…"** (what the item would sell for, without VAT, for that margin). On a sent quote it is the frozen margin against **the target as it is now**, said in the note.
- **One-off item sheet:** once "What it costs you" is typed and a target is set, under the price: **"For your 40% target, charge R… each."** with **Use R…**. The price is given the way the price is entered (with VAT included when the business enters prices that way), so Use fills the field correctly.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A percentage setting in the profile | `LabourRateForm` (its own small form, saved on its own) | A sibling form of the same shape; the percentage is a `TextField` labelled "(%)" read with `parsePercent`, as `docs/ux-inputs.md` says |
| A price hint with Use | `product-price-hint` in the item sheet (`line-sheet.tsx`) | The same markup and link-button; a second hint beside it |
| The margin panel and the product summary | `MarginPanel`, `CostSummaryView` | As is, with a `target` value |

Inputs by kind: a **percentage** (the target margin) uses the percentage input the app already has; **money** is only shown, and the existing price field is filled by Use.

## Decisions
1. **Margin, not mark-up:** price = cost ÷ (1 − margin), rounded **up** to the cent so the margin is at least the target. *Recommended.*
2. **A target between 1% and 99%**, stored in basis points; empty means none. *Recommended.*
3. **Colour is never the only signal:** words say "meets" or "below".
4. **Nothing is changed for the maker:** a hint is a suggestion, applied only by tapping Use.
5. **A sent quote is judged against today's target**, not a frozen one: the target is a goal, not a record. *Recommended; it is said on the page.*
6. **No product-list margin yet** (see the table).

## Data
One column: `business_profiles.target_margin_bp integer` (null: none; 100 to 9900), updated by owners and admins through the existing profile policy and a column grant, like `labour_rate_cents`. SQL test: it saves, bad values are refused, a member who is not an owner or admin cannot set it. Nothing else is stored; the price for a margin is worked out in the app (`lib/costing/target.ts`), in whole numbers.

## Slices
One: the setting, the arithmetic, the four places.

## Tests
SQL: the column's check and who can change it. Unit: the percentage parsing, the price for a margin (rounding up; exact cases such as cost R60 at 40% is R100; a margin that does not fit; VAT-inclusive entry), where an item stands (at the target, one basis point under, no target, no cost). Browser: set the target, see the product's summary and the quote's panel say where they stand and the hint, use the one-off hint, clear the target and see it all go. Accessibility: the profile form and the hint.

## Questions for the founder
None blocking. Is 40% the sort of number makers use (the examples in the plan use it only as an example, nothing is pre-filled)?

## Not planned yet
Margin on the product list, margin colours on the invoices, a different target for a product or a customer, price breaks suggested from cost.

## Built (2026-10-22; needs human review: migration `20261118100000_target_margin.sql`, one nullable column with a column grant on the business profile)
- **Database:** `business_profiles.target_margin_bp` (null, or 100 to 9900), updated by owners and admins through the existing policy and a column grant. SQL test `target_margin.test.sql`.
- **Library:** `lib/costing/target.ts` (`parseTargetMargin`, `targetStanding`, `priceForMarginCents` rounding up, `priceToEnterCents` adding VAT the way prices are typed), unit-tested including the boundaries and that the price for a margin never falls short.
- **Screens:** the Business profile has **The margin you aim for** (its own small form, like the hourly rate); the product's cost summary says "Meets your 40% target." or "Below your 40% target: for 40%, charge R…" (green or amber text, always with the words); the quote's "Only you see this" line says where it stands and an item below target says what to sell it for (draft, sent quote and invoice, the sent ones against today's target, and said so); a one-off item with a cost typed gets "For your 40% target, charge R… each." with **Use R…**, in the way prices are entered.
- **Not done:** margin on the product list (see the table); the hint on a product's own price field (the summary carries it).
- **Tests:** `target.test.ts`, `target_margin.test.sql`, `e2e/target-margin.spec.ts` (the profile form with an error, the product's note, the one-off hint and Use, the quote's standing and item hint, a lower target met, no target says nothing), an accessibility case.
