# Plan: what it costs to make, and the margin on a quote

Status: **planned 2026-10-17** from the founder's order of work: *costing and margin first, to demo it on a quote, then thin invoices.* Three slices; every one changes the database (**money, migrations and new tables: human review**). Nothing is built yet.

It finishes `docs/plans/costs-and-recipes.md` (materials are slice 1 there and are built). That plan was written before steps, conditions and quantity prices existed, so this one reconciles it: costs use the **same "only for some items" conditions** as steps (`docs/plans/quantity-prices-and-steps.md`, slice 4), and the cost is worked out on the **quote**, not only on the product. Where the two plans differ, this one wins; the older plan's reasons (VAT on costs, exact arithmetic, stock as a ledger) still stand and are not repeated.

## Where things stand
- **Materials** are built (`/app/products/materials`; `lib/materials`): a unit, how much was bought, what was paid, what the price includes for VAT-registered businesses; `materialCostCents` works out what an amount costs, exactly and rounded once, without VAT. Nothing uses a material yet.
- **Products** have variations (each with a price), lists, extras, quantity prices, and steps with conditions. The product form still shows **"Costs and margin"** as a "coming soon" card.
- **Conditions** (`product_step_conditions`, `lib/products/steps.ts`, `steps-section.tsx`): a variation, a list choice, an extra or a quantity; chosen/not chosen; all/any. They are checked in the database (`product_step_applies`) when a job item copies its steps.
- **A quote line** keeps its own typed price, its variation and its options (with the ids of what was chosen, `chosenIds`). The quote's totals are worked out in `lib/quotes` and `lib/money` (VAT-aware, net per line). A sent version is a frozen snapshot.
- **The business profile** has no hourly rate.

## Prototype read
Read in full this round (2026-10-17): `prototype/src/lib/costUtils.ts` (the whole file: units, material and labour cost, base and choice-specific inputs, `calculateLineItemUnitCost`, `calculateOrderFinancialSummary`, the material requirement and stock breakdown, the stage-condition helpers); `prototype/src/components/InternalQuoteFinancials.tsx` (the whole panel); `prototype/src/components/Products.tsx` (the Inputs & Costs tab, 2871 to 3135, including the summary footer and the variation previewer; `VariationScopeSelector` 35 to 140; the input state and handlers 402 to 417 and 573 to 700; the add-input dialog 3503 to 3720); `prototype/src/components/AdvancedCustomItemModal.tsx` (the cost parts: 380 to 396, 840 to 880); `prototype/src/types.ts` (`Material`, `ProductInput`, the `unitCost` fields); `components/Quotes.tsx` (the panel's call site 1795 to 1830 and the `unitCost` handling for a custom item, 522 and 4083 to 4097). **Skipped:** `Materials.tsx` (the materials list: built already in slice 1 of the older plan, read then), the stock fields and low-stock warnings (stock is a later layer), the job and invoice copies of the panel (`Invoices.tsx` 1870 and 2148; the same component).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A product has **inputs** for one unit: a *material* (amount of a material in a unit), *labour* (time at an hourly rate typed on the input, default 120) or a *direct* cost (a name and an amount) | **Kept, changed:** three kinds of cost line: **Material**, **Your time**, **Other cost**. The hourly rate is **one rate in the Business profile**, not typed on each line | A rate typed on every line goes stale and is inconsistent; one number a maker knows |
| An input's cost is **stored** on the input (`cost`, rounded to 2 decimals) next to the amount, so a changed material price does not change it | **Dropped:** a line stores what it is (material, amount) and the cost is worked out each time, in integer cents, rounded once | Stored rounded costs drift and silently disagree with the material's price |
| Inputs are **per unit** of the product | **Changed:** the product says how many one batch **makes** (default 1), and lines are for the batch | A baker lists a batch of 12 cupcakes, not a twelfth of an egg |
| An input applies to **"Base (all variations)"** or to a **chosen set of option values** (`applicableValueKeys`, "Size:::500ml") | **Changed:** each line applies **always** or **only for some items**, with the same conditions as steps (a variation, a list choice, an extra, a quantity; chosen or not; all or any) | One condition model for steps and costs; matches by id, not by a name string |
| A product's cost with choices = base inputs + the inputs of each **selected** value; **the first match per option name** | **Kept:** the cost of an item is the lines that apply to it | |
| Inputs can also hang on an option value (`option.values[].inputs`) | **Dropped:** one place (the product's lines) | Two places to put the same thing |
| An extra's cost: only as inputs scoped to an extra's value | **Changed:** an extra carries its own cost lines (a gift box uses a box, 5 minutes), counted by how many are on the item | The same extra costs the same on every product, like its price |
| Unit conversion hard-coded in two places, with a **fall-through to 1:1** on unknown pairs and a missing litre/ml case (`prototype-discovery.md` item 6) | **Dropped:** one conversion table (`lib/materials/units`); different kinds of unit are refused with a message | Silent wrong costs |
| Material cost per unit = `bulkCost / bulkQuantity` in floating point | **Kept as an idea, changed in arithmetic:** exact integers (done in `materialCostCents`) | Money is never a float |
| Line cost = unit cost × quantity; **quote margin = revenue − Σ cost**, margin % = profit ÷ revenue | **Kept:** revenue is the line's **net** (without VAT) total after discounts; cost is without VAT; both stated on screen | The prototype divided a VAT-mixed revenue by a net cost |
| **Internal panel** on the quote: "Only visible to you", four numbers (revenue, est. cost, est. profit, margin %), a margin badge (green at 20%+, amber below), an item breakdown table; hidden when printing | **Kept, changed:** the panel is on the quote form and the sent quote, never on the customer's document; one summary line collapsed ("Margin R1 240 · 38%"), a breakdown on tap; the 20% threshold is **not hard-coded** (a margin colour needs a target the maker sets, later) | Nothing invented for the maker |
| With **no costs** on any item the panel shows a prompt "Track your internal costs & profit margin" with a link to Products | **Kept:** the same prompt, once, with a link to the product's costs | |
| With **some items costed**, the totals count only those, and a link says "Add costs for remaining products" | **Kept:** the summary says "Costed items only (2 of 3)" and names the others in the breakdown | An honest partial number |
| Line to product matching falls back to **fuzzy name matching** (`includes`), which can attach the wrong product's costs | **Dropped:** by the product id the line carries (a one-off item has no product) | `prototype-discovery.md` item 6 |
| A custom (one-off) item has a typed `unitCost` | **Kept:** a one-off item may have a typed cost each, so its margin shows | |
| A line's `unitCost` **overrides** the computed cost when greater than 0 | **Dropped for product items** (the cost is computed from the product's lines); kept only for one-off items | An override that hides a changed material price |
| Product form **summary box**: base cost, base price, base profit with margin %, and a **variation/extra previewer** (pick a combination, see its cost, price, profit) | **Kept:** the product shows cost, price, margin for the product or for each variation, with the options and extras to try | |
| **"Apply Cost + 50% Margin"** price suggestion in the one-off item dialog | **Later:** a "price for a margin of X%" hint once a target margin exists | Not needed to demo margin |
| Costs not carried to the **invoice** when a quote converts (`convertQuoteToInvoice` drops `unitCost`) | **Fixed by design:** the sent quote's frozen costing goes to the job and the invoice | `prototype-discovery.md` item 4 |
| Cost is recomputed from the **current** product and material prices whenever it is shown | **Changed:** a draft shows the current numbers; a **sent version freezes** its costing | Margin must not change after a material's price does |
| Material requirements per job item (amounts of each material, with stock checks) | **Later:** with stock (`costs-and-recipes.md` slices 4 and 5) | |
| Stage conditions (`option_match`, `option_selected`, `quantity_threshold`, AND/OR) | **Already built** for steps; costs reuse the model | |

## What the maker sees
- **The Business profile** gets "What is an hour of your time worth?" (a price per hour, optional), asked in the profile and when a first "Your time" line needs it.
- **The product form**: the "Costs and margin" card becomes **"What it costs to make"** (services: "What it costs"). It opens with "Add a cost" and a line of help. Each **cost line** is: a **Material** (pick from your materials, an amount and a unit of the same kind), **Your time** (minutes or hours), or **Other cost** (a name and an amount). Each has **Only for some items** (the steps' conditions, same control). A product that makes more than one at a time says **"Makes"** (a quantity, default 1). Underneath, a plain summary: "Costs R38,50 to make one. Price R60,00 (without VAT R52,17). Margin 26%." With variations, one line each: "Large: costs R57,80, margin 34%". Costs are without VAT, and the note beside every margin says so.
- **The quote form**: a quiet line under the totals, "Only you see this: margin R1 240 · 38%", that opens a breakdown per item (revenue, cost, margin; "no costs yet" with a link where there are none). It never appears on the customer's document, the PDF, or the text of the quote.
- **A one-off item** has an optional "What it costs you" (each).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Add a line to a list in the product form | Variations, extras, quantity prices, steps (`AddButton` + rows) | As is; "Add a cost" opens a choice of the three kinds (a `ChoiceCards` of three) |
| "Only for some items" on a line | The steps' conditions (`steps-section.tsx`: `Conditions`, `lib/products/steps.ts`) | **Lift out and reuse** (a shared `conditions` component and parser) rather than copy; steps and costs both use it |
| Pick a material | `SelectField` over the business's materials | As is; an empty list says "Add a material first" with a link |
| An amount of a material | `QuantityField` (`unit` after the box) and a `SelectField` for the unit, limited to the material's kind | As is; **new only in how the two sit together**, kept next to each other |
| Time | `QuantityField` and a `SelectField` of minutes or hours | As is. Stored as whole minutes; a fraction of a minute is refused with how to fix it |
| Money (other cost, hourly rate, a one-off item's cost) | `TextField` with `startText`, `parseMoney` | As is |
| Makes N | `QuantityField` | As is |
| Pick the combination to try (variation, options, extras) | The item sheet's choosers (`variation-choice`, `option-choices`) | As is, inside the product's summary |
| The "only you see this" panel | None | **New**, small: a collapsed summary with a breakdown. Reason: nothing else in the app shows private figures beside a public document |
| Cost per variation, margin | `AddedPrice`-style small text (`docs/ux-inputs.md`) | The same pattern: the figure beside the thing it is about |

## Decisions (recommendations in bold)
1. **Three kinds of cost line: Material, Your time, Other cost.** *Recommended.* Steps stay for tracking work on a job; a step does not carry minutes yet (a later slice can let a step's time feed the cost). This is how the prototype did it (labour was an input, separate from stages).
2. **One hourly rate in the Business profile.** *Recommended.* Alternative: a rate on each line (the prototype). The business rate is used when the cost is worked out, so changing it changes drafts and not sent quotes.
3. **Costs and margins are without VAT** (decided 2026-10-11): material costs have the VAT taken out where the business is VAT-registered and the price paid includes it; the revenue used is the item's net total. Said once, beside every margin.
4. **Lines are for a batch; "Makes N"** (default 1). The cost of an item is the batch cost × quantity ÷ makes, rounded once per line. *Agreed 2026-10-11.*
5. **Size scaling is not built now.** A Large that uses more flour is a second line "only for Large" with the extra amount. *Recommended.* The older plan's "uses 150% of the process" number is a convenience that can follow if makers ask; it is a number on the variation, so nothing built now blocks it.
6. **Extras carry their own cost lines** (slice B), counted by how many are on the item. *Recommended; older plan decision 4.*
7. **A draft quote shows the current costing; a sent version freezes it** into the snapshot as a private section that documents never read. *Recommended; older plan decision 5.* A sent version made before costs existed has none.
8. **A one-off item can have a typed cost each.** *Recommended.*
9. **Partial costing is shown honestly:** totals count the items that have costs and say how many.
10. **No margin target or price suggestion yet.** The panel shows the figure; colours and "price for 40%" wait for a target margin the maker sets.
11. **Waste** (a plus-percentage on a material line) is **not built now**; the maker can put waste in the amount. *As in the older plan.*

## Data (sketch)
Every table: `organisation_id`, same-business composite keys, row-level security for members, the restrictive `session_required` policy, SQL tests.
- `business_profiles.labour_rate_cents` (per hour, null when not set).
- `products.makes_milli` (default 1000).
- `product_cost_lines` (product, sort order, kind `material | time | other`, name (other), material id and amount in thousandths of a unit and the unit (material), minutes (time), cents (other), condition logic `all | any`); a check per kind; a material cannot be deleted while a line uses it (materials are archived, never deleted).
- `product_cost_line_conditions` (the same shape as `product_step_conditions`; **one shared database function** decides whether a line applies, so steps and costs cannot disagree), at most 10 per line, at most 40 lines per product.
- Slice B: `extra_cost_lines` (the same kinds, no conditions), and the sent snapshot's private `costing` section per item (lines with their cost in cents, the total, the rate and the VAT rate used).
- `quote_lines.cost_cents` is **not** stored for drafts (worked out on view); a one-off item's typed cost is stored on its quote line (`unit_cost_cents`, nullable).
- `save_product_layers` carries the cost lines (replaced again, same signature), resolved by position like steps.

## Slices (each usable, each with tests)
**A. Costs on a product, margin on a draft quote (the demo).** Migration: the profile rate, `makes_milli`, the cost lines and conditions, the quote line's typed cost; `lib/costing` (the one function that works out an item's cost and a quote's margin, pure, exact: lines that apply, scaling by quantity ÷ makes, rounding once, VAT-excluded materials, the rate, one-off costs); the shared conditions component lifted out of steps; the product form section and summary; the profile field; the quote form's private summary and breakdown. Draft quotes only.
**B. Freeze it, and extras.** The sent version's private costing; the sent quote page shows the frozen margin; extras' cost lines; the job and (later) invoice carry the frozen figure.
**C. Easier to price.** Target margin in the profile, "price for X%" hints, margin colour; the product list shows the margin.

## Tests
Unit: every case of the cost function (always and conditional lines, a choice, an extra, quantity condition, makes N, rounding once, a rate of 0 and unset, time in hours, a material of another kind refused, VAT-registered and not, an amount too large); the margin (net of discount, partial costing, no costs, negative margin, zero revenue). SQL: isolation, session required, same-business keys, a material in use cannot be deleted, the condition limits, the lines' shapes, `save_product_layers` null leaves them / a list replaces them. Browser: set the rate, add materials, build a product with a Large that uses more and an extra, see the product's margin per variation, build a quote and watch the private margin follow the choices and the quantity, and check the customer's document, the PDF and the text of the quote do not contain it. Accessibility: the new section and the panel.

## Questions for the founder
1. **Time as a cost line, separate from steps** (decision 1). OK for now?
2. **No size scaling yet** (decision 5): a second "only for Large" line instead. OK?
3. **Draft shows live numbers, sent freezes** (decision 7), with the frozen figures only in slice B. For the demo, slice A shows margin on draft quotes only. OK?
4. **The tax adviser check** (`vat-on-costs-adviser-questions.md`) is still unanswered; the wording on the margin note is provisional until it is.

## Not planned yet
A step's own minutes feeding the cost, size scaling, waste, price history of materials and suppliers, stock and "can I make this?" (`costs-and-recipes.md` slices 4 to 6), margin on invoices (follows the invoice plan, which will carry the frozen figure), margin reports across quotes.
