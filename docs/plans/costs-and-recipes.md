# Plan: costs, recipes and stock for one product with variations

Status: **proposal, 2026-10-11** (from the founder's question: variations may have different inputs, stock and processes; every variation as its own product is cleaner but messy). Nothing is built. Needs the founder's answers to the open questions at the end before slice 1. **Money, migrations and new tables: human review.**

Builds on `docs/plans/product-choices.md` and `docs/plans/product-extras.md` (variations, further variations, extras), and replaces the "Costs and margin", "Production steps" and "Stock" placeholders in the product form. Delivery layers 6 and 8 in `docs/product-brief.md`; what the prototype did and got wrong is in `docs/prototype-discovery.md` (section 3, and items 4, 6 and 9 of section 5).

## The question
A Large cake uses more flour than a Small one, a Red velvet needs cocoa the Vanilla does not, a gift box uses a box. Each can differ in what goes in, how long it takes and what is on the shelf. How does the maker keep "one product, with variations" and still get honest cost, process and stock?

## The answer in one sentence
**One product, one recipe; every choice (a variation's choices, the choices of further variations, an extra) can add to or change the recipe where it differs; stock is counted separately for materials and for finished goods.**

Three separate things, each with its own owner:

| Thing | Question it answers | Belongs to |
|---|---|---|
| **What is sold** | price, photo, what a quote picks | the product and its variations (built) |
| **What goes in and how it is made** | materials, time, other costs, steps | the product's **recipe**, with lines that apply to choices |
| **What is on the shelf** | how many of what | **materials** (the business), **finished goods** (each variation) |

Why not one product per variation: everything shared is repeated, quoting becomes a long list, and fixing a recipe means editing every copy. Why not one recipe with no variation changes: it cannot say that Large uses more. This is the standard "one bill of materials with lines that apply to certain variants" pattern, and it fits what is already built: the choices that change **price** are the same choices that change **cost** and **stock**.

## Decisions proposed (to confirm)
1. **One recipe per product.** A recipe is a list of **lines**: a material and an amount, some of the maker's time, or another cost (a fixed amount, like a delivery box). It says **how many it makes** (a batch of 12 cupcakes; default 1), so a quote for 30 works out as 2.5 batches' worth.
2. **Each line says who it applies to:** *always*, or *only when this choice is chosen* (a variation choice, a choice of a further variation, or an extra).
3. **Size scaling is a number on the variation, not a copy of the recipe.** Each variation choice has "uses this much of the recipe", 100% by default (Large: 150%). Lines marked "scales with size" use it; the rest (a box, an hour of decorating) do not. A choice that is truly a different make can later have "don't start from the product's recipe" (only the lines that apply to it); not in the first slices.
4. **Extras carry their own recipe lines** (Gift wrap uses 1 box), kept on the extra, so a shared extra has the same cost on every product, like its price. Their count on the item multiplies them (the same "how many" as on the quote).
5. **A quote item's cost is worked out, never typed:** the product's lines that apply (always, plus the chosen choices), scaled by size and by quantity, plus its extras' lines. It is computed **on the server**, shown only to the maker (an internal panel on the quote, never on the customer's document), and **frozen into the version when it is sent**, as the prices are, so margin stays true after a material's cost changes. Quotes made before costs existed simply have none.
6. **Stock is a ledger of movements, not a count that is overwritten** (prototype lesson, item 9): purchases in, jobs out, adjustments, returns. The count is the sum. Everything that moves stock happens on the server, in a transaction.
7. **Materials stock matters most; finished goods stock is optional.** Most makers make to order. Finished goods stock is a switch per product ("I keep some ready-made") and counts **per variation** (Small vanilla is the thing on the shelf).
8. **A job gets its own frozen copy of the resolved recipe** when it is made from an accepted quote, so editing the recipe later never changes work in progress.
9. **Where it lives in the screens:** a **Materials** list (a third switch beside Products and Services); in the product form, **What goes in** (materials and other costs, replacing the "Costs and margin" placeholder) and **How it's made** (steps, replacing "Production steps"), matching the three tabs idea in `docs/plans/products.md`; each recipe line has an "Applies to" choice, "Always" by default. The labour rate is a fact about the business and lives in the **Business profile**, not in Settings.
10. **Plain words and layers:** none of this is shown until the maker opens it ("Work out what it costs"); a product can stay a name and a price forever.

## How the numbers work (money, so exact)
- **Quantities are whole numbers in thousandths** of a unit (`quantity_milli`), as on quote items; **money is integer cents**; no floats.
- **A material is bought in a quantity at a price** (flour: 12.5 kg for R187,50). Its cost per unit is **derived, never stored as a rounded cent**: a line's cost is `round(amount_needed × price_paid ÷ quantity_bought)` in cents, done with exact integer (bigint) arithmetic and **rounded once, at the end of the line**, so a few grams of something cheap never rounds to nothing or to a wrong total.
- **Units have a dimension** (mass, volume, length, count) and an exact conversion factor in one place (`lib/materials/units`), with tests. A recipe amount in grams against a material bought in kilograms converts; two different dimensions (litres of a thing bought by the kilo) is refused with a message, never silently 1:1 (prototype item 6).
- **Labour:** minutes × the business's hourly rate ÷ 60, rounded once per line.
- **Margin** = the item's price (excluding VAT) minus its cost, per item and for the quote. Whether costs are entered with or without VAT is an open question below.
- Order of work for an item: start from the lines that apply → scale by size → multiply by quantity ÷ batch size → add extras' lines (× their count) → round per line → add up. Written down once in `docs/plans/product-choices.md` terms and tested like the price calculation.

## Data (sketch, finalised per slice)
Every table: `organisation_id`, same-business composite keys, row-level security for members, the restrictive `session_required` policy, SQL tests (as for every table).
- `materials` (name, unit, bought quantity, price paid, supplier note, archived). Never deleted once used.
- `recipe_lines` (owned by a **product** or an **extra**, exactly one; kind `material | time | other`; material, amount or minutes or fixed cents; `scales_with_size`; **applies to** none, or exactly one of a variation, a choice of a further variation, or an extra; sort order).
- `products.recipe_makes_milli` (how many a recipe makes, default 1000) and `product_variations.recipe_scale_milli` (default 1000).
- Later: `product_steps` (ordered, minutes, optional "applies to" like a line), `stock_movements` (material or variation, quantity, reason, job or purchase), `jobs` get `job_recipe_lines` (the frozen copy).
- Quote versions: the sent snapshot gains an internal `costing` section per item (cost cents, and the lines it was made of); never printed.

## Slices (each usable on its own, each with tests)
1. **Materials.** List, add, edit, archive; unit and cost derived; units and conversions with tests. No recipes. *Migration: `materials`.*
2. **The recipe, and margin.** "What goes in" on the product: material, time and other-cost lines, "makes N", "Applies to" per line, size scaling on variations, extras' lines; business hourly rate; cost and margin on the product, on the item sheet, and on the quote's internal panel; the cost frozen into a sent version. *Migrations: `recipe_lines`, the two columns, the business labour rate.* This is where the money logic lives: unit and SQL tests for rounding, scaling, choices, extras, quantities, batch size, old snapshots without costs.
3. **How it's made.** Steps with time (feeding labour cost) and "applies to" for steps that only some choices need.
4. **Jobs** (own plan): a job is made from an accepted quote and carries the frozen resolved recipe.
5. **Materials stock:** the ledger, purchases in, jobs out, adjustments, low-stock warning, "can I make this?" on a quote.
6. **Finished goods stock per variation:** the switch per product, make-to-stock jobs, selling from the shelf.

Slices 1 and 2 give the maker the thing the brief calls the differentiator (margin on every quote) without needing jobs or stock.

## Tests (overall)
Unit: unit conversion and refusal of mixed dimensions; the cost of an item for each combination (always lines, choice lines, size scaling, batch size, quantity, extras with fixed counts, rounding once). SQL: isolation, session required, same-business keys, "applies to" is none or exactly one, a used material cannot be deleted, the frozen costing in a sent version cannot change. Browser: set up materials, build a recipe with a Large that scales and a flavour that adds, see the margin change as choices change on a quote; the customer's document and PDF never show cost. Accessibility: each new screen.

## Open questions for the founder
1. **VAT on costs.** For a VAT-registered business, are material prices entered with VAT (what the shop charged) or without? Margin should be on prices excluding VAT, so either the maker enters ex-VAT amounts, or the app strips the VAT using the business's rate. Recommendation: enter what you paid (with VAT if you paid it) and say which, once, in the Business profile; the app works out the ex-VAT cost. Needs a check with an adviser for input-VAT claims.
2. **A different make per variation.** Is "this variation doesn't start from the product's recipe" needed in the first version? Recommendation: no; size scaling plus "applies to" covers the examples so far. Add it when a real case needs it.
3. **Waste and yield.** Does a material line need a "plus waste" percentage (offcuts, trimming) from the start? Recommendation: later; "makes N" covers batches, and the maker can put waste into the amount.
4. **Extras that use materials from day one.** Recommended yes (decision 4): the same screen, and Gift wrap needs it.
5. **Order.** Recommended: slices 1 and 2 first, then jobs, then stock (stock is mostly used up by jobs).

## Not planned yet
Suppliers and purchase orders, price history of materials, supplier-specific costs, per-unit serial tracking, production scheduling, a bill of materials that contains other products (a cake made of a sponge product).
