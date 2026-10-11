# Plan: costs, process and stock for one product with variations

**Paused after slice 1 (founder, 2026-10-11): quotes, invoices and job tracking come first** (`docs/plans/jobs-and-invoices.md`); this plan resumes after them.

Status: **proposal, updated 2026-10-11** after the founder's answers (VAT researched, batch size agreed, steps can depend on a choice, "recipe" becomes **process**). Nothing is built. Two small questions remain (end of this file). **Money, migrations and new tables: human review.** (The file keeps its first name, `costs-and-recipes`, so links keep working.)

Builds on `docs/plans/product-choices.md` and `docs/plans/product-extras.md` (variations, further variations, extras), and replaces the "Costs and margin", "Production steps" and "Stock" placeholders in the product form. Delivery layers 6 and 8 in `docs/product-brief.md`; what the prototype did and got wrong is in `docs/prototype-discovery.md` (section 3, and items 4, 6 and 9 of section 5).

## The question
A Large cake uses more flour than a Small one, a Red velvet needs cocoa the Vanilla does not, a gift box uses a box, a tiered cake has a step the single-tier one does not. Each can differ in what goes in, what is done, how long it takes and what is on the shelf. How does the maker keep "one product, with variations" and still get honest cost, process and stock?

## The answer in one sentence
**One product, one process; every choice (a variation's choices, the choices of further variations, an extra) can add to or change the process where it differs; stock is counted separately for materials and for finished goods.**

"Process" is the word for everything that goes into making it (the founder generalised "recipe": a baker's recipe, a jeweller's method, a printer's job). It has two kinds of line, both of which can depend on a choice:
- **Inputs:** materials with amounts, and other costs (a fixed amount, like a box or a printing fee).
- **Steps:** things done, each with how long it takes (the maker's time is the labour cost), later with notes and stages for jobs.

| Thing | Question it answers | Belongs to |
|---|---|---|
| **What is sold** | price, photo, what a quote picks | the product and its variations (built) |
| **The process** | what goes in, what is done, how long | the product's **process**, with lines and steps that apply to choices |
| **What is on the shelf** | how many of what | **materials** (the business), **finished goods** (each variation) |

Why not one product per variation: everything shared is repeated, quoting becomes a long list, and fixing the process means editing every copy. Why not one process with no variation changes: it cannot say that Large uses more or that Tiered has an extra step. This is the standard "one bill of materials, with lines that apply to certain variants" pattern, and it fits what is already built: the choices that change **price** are the same choices that change **cost**, **steps** and **stock**.

## Decisions
1. **One process per product.** It says **how many it makes** (a batch of 12 cupcakes; default 1), so a quote for 30 works out as 2.5 batches' worth. *(Agreed 2026-10-11.)*
2. **Each input and each step says who it applies to:** *always*, or *only when this choice is chosen* (a variation choice, a choice of a further variation, or an extra). *(Founder, 2026-10-11: steps can depend on a variation value.)* The same control for both: "Applies to: Always / Size: Large / Flavour: Red velvet…".
3. **Size scaling is a number on the variation choice, not a copy of the process.** "Uses this much of the process", 100% by default (Large: 150%). Inputs marked "scales with size" use it; a box, a fixed fee, a step that takes the same time whatever the size do not. Steps can also be marked "scales with size" (decorating a bigger cake takes longer). A choice that is a truly different make is covered by "applies to": inputs and steps that exist only for it. "Don't start from the product's process" is not needed (the founder's reading of this, 2026-10-11, is that conditional steps cover it).
4. **Extras carry their own inputs and steps** (Gift wrap uses 1 box and takes 5 minutes), kept on the extra, so a shared extra has the same cost on every product, like its price. Their count on the item multiplies them (the same "how many" as on the quote). *(Recommended and assumed; not yet answered.)*
5. **A quote item's cost is worked out, never typed:** the product's lines and steps that apply (always, plus the chosen choices), scaled by size and by quantity, plus its extras'. It is computed **on the server**, shown only to the maker (an internal panel on the quote, never on the customer's document), and **frozen into the version when it is sent**, as the prices are, so margin stays true after a material's cost changes. Quotes made before costs existed have none.
6. **Stock is a ledger of movements, not a count that is overwritten** (prototype lesson, item 9): purchases in, jobs out, adjustments, returns. The count is the sum. Everything that moves stock happens on the server, in a transaction.
7. **Materials stock matters most; finished goods stock is optional.** Most makers make to order. Finished goods stock is a switch per product ("I keep some ready-made") and counts **per variation**.
8. **A job gets its own frozen copy of the resolved process** (inputs and steps) when it is made from an accepted quote, so editing the process later never changes work in progress.
9. **Where it lives in the screens:** a **Materials** list (a third switch beside Products and Services); in the product form, **Process** with **What goes in** (inputs, replacing the "Costs and margin" placeholder) and **How it's made** (steps, replacing "Production steps"), matching the "what goes in / how it's made" idea in `docs/plans/products.md`. The labour rate is a fact about the business and lives in the **Business profile**, not in Settings.
10. **Plain words and layers:** none of this is shown until the maker opens it ("Work out what it costs"); a product can stay a name and a price forever.
11. **VAT on costs** (researched, below): costs are kept **without VAT when the VAT can be claimed back**, as what the business really pays. The question only appears for VAT-registered businesses.

## VAT on costs: what others do, and what we do
**What competitors and guidance do** (searched 2026-10-11; mostly help pages and community posts, so treat as indicative):
- **Craftybase / Stocksmith** (software for makers): material costs are always **ex-tax**; their help page says tax on a purchase is not part of the cost ("all Actual Unit Costs are ex-tax") because it is normally claimed back. No setting. Their own articles are not fully consistent, and one calculator article tells makers to include tax. [Craftybase help: material costs](https://help.stocksmith.io/article/82-what-is-a-recipe)
- **Katana** (manufacturing): a material's purchase price is **ex-tax**, with the tax rate picked separately on each purchase line. [Katana: creating a purchase order](https://support.katanamrp.com/en/articles/119-creating-a-new-purchase-order)
- **Odoo:** cost without tax, with supplier taxes set separately; the cost on the product page is net.
- **Sage Accounting** (South Africa): an item has a **cost price** and a separate **purchase tax rate**. [Sage developer reference](https://developer.sage.com/accounting/zapier/products-and-services)
- **Shopify:** "cost per item" is a bare number, and merchants in VAT countries complain that margins mix a net cost with a VAT-inclusive price; profit apps added an explicit "exclude tax" option. [Shopify community thread](https://community.shopify.com/t/how-much-does-each-product-cost-on-average/1607)
- **Accounting practice** (UK help article, same principle in SA): a VAT-registered business enters costs **net** (the VAT is reclaimed on its return, so it is not a cost); a business that is **not** registered enters the **gross** amount (the VAT is a real cost). [Link My Books](https://help.linkmybooks.com/en/articles/7185638-should-i-enter-product-costs-with-or-without-vat)
- **South Africa:** a VAT vendor can claim input tax only with a **valid tax invoice** (SARS: a full tax invoice over R5 000, an abridged one up to R5 000, none needed for R50 or less), and not every purchase qualifies. [SARS: tax invoices](https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/)
- Not found: how Xero treats an item's cost in margin reports (only that it keeps a purchase price and a purchase tax type per item).

**What MakerFlow does**
- **Not VAT-registered:** nothing to ask. The price paid is the cost.
- **VAT-registered:** each material says what the price paid **includes**: *includes VAT* (what a shop till shows; the default), *excludes VAT*, or *no VAT charged* (a supplier who is not a VAT vendor, like a market stall). The app works out the **cost without VAT** from the first two using the rate in the **locale pack** (never a number written elsewhere) and uses the price as it is for the third. Margin is always against the item's price **without VAT**.
- **Scope:** this is the maker's margin, a management figure. The app does **not** work out what VAT can be claimed or file anything; whether a purchase is claimable (a valid tax invoice, the kind of purchase) is the business's and its adviser's call. This is said once, plainly, where the question is asked. A check with a South African tax adviser is still wanted before this ships (already on the list for the VAT work).

## How the numbers work (money, so exact)
- **Quantities are whole numbers in thousandths** of a unit (`quantity_milli`), as on quote items; **money is integer cents**; no floats.
- **A material is bought in a quantity at a price** (flour: 12.5 kg for R187,50). Its cost per unit is **derived, never stored as a rounded cent**: an input's cost is `round(amount needed × price paid (without VAT where it applies) ÷ quantity bought)` in cents, done with exact integer (bigint) arithmetic and **rounded once, at the end of the line**, so a few grams of something cheap never rounds to nothing or to a wrong total.
- **Units have a dimension** (mass, volume, length, count) and an exact conversion factor in one place (`lib/materials/units`), with tests. A process amount in grams against a material bought in kilograms converts; two different dimensions (litres of a thing bought by the kilo) is refused with a message, never silently 1:1 (prototype item 6).
- **Labour:** minutes × the business's hourly rate ÷ 60, rounded once per step.
- **Margin** = the item's price without VAT minus its cost, per item and for the quote.
- Order of work for an item: start from the inputs and steps that apply → scale by size where marked → multiply by quantity ÷ batch size → add extras' lines (× their count) → round per line → add up. Written down once and tested like the price calculation.

## Data (sketch, finalised per slice)
Every table: `organisation_id`, same-business composite keys, row-level security for members, the restrictive `session_required` policy, SQL tests (as for every table).
- `materials` (name, unit, bought quantity, price paid, what the price includes for VAT-registered businesses, supplier note, archived). Never deleted once used.
- `process_inputs` (owned by a **product** or an **extra**, exactly one; kind `material | other`; material and amount, or fixed cents; `scales_with_size`; **applies to** none, or exactly one of a variation, a choice of a further variation, or an extra; sort order).
- `process_steps` (same owner and **applies to** rules; name, minutes, `scales_with_size`; sort order; later notes and the stage a job tracks).
- `products.process_makes_milli` (how many a process makes, default 1000) and `product_variations.process_scale_milli` (default 1000).
- Business profile: the hourly rate (and, for VAT-registered businesses, nothing else new: the rate comes from the locale pack).
- Later: `stock_movements` (material or variation, quantity, reason, job or purchase); jobs get `job_inputs` and `job_steps` (the frozen copies).
- Quote versions: the sent snapshot gains an internal `costing` section per item (cost cents and what it was made of); never printed.

## Slices (each usable on its own, each with tests)
1. **Materials.** List, add, edit, archive; unit; price paid and what it includes (VAT-registered only); cost without VAT derived; units and conversions with tests. No process yet. *Migration: `materials`.*
2. **The process, and margin.** On the product: inputs and steps (name and minutes, "your time" is just a step), "makes N", "Applies to" on every line and step, size scaling on variation choices, extras' lines and steps; the business hourly rate; cost and margin on the product, on the item sheet and on the quote's internal panel; the cost frozen into a sent version. *Migrations: `process_inputs`, `process_steps`, the two columns, the labour rate.* This is where the money logic lives: unit and SQL tests for rounding, scaling, choices, extras, quantities, batch size, VAT-excluded costs, old snapshots without costs.
3. **Richer steps.** Notes and stages on steps (what a job will track), ordering by drag or arrows.
4. **Jobs** (own plan): a job is made from an accepted quote and carries the frozen resolved process.
5. **Materials stock:** the ledger, purchases in, jobs out, adjustments, low-stock warning, "can I make this?" on a quote.
6. **Finished goods stock per variation:** the switch per product, make-to-stock jobs, selling from the shelf.

Slices 1 and 2 give the maker the thing the brief calls the differentiator (margin on every quote) without needing jobs or stock.

## Built (notes)
**Slice 1, Materials (2026-10-11)** (needs human review: migration `20261027100000_materials.sql`, a new table with row-level security).
- **Where:** a third switch on the Products tab, **Materials** (`/app/products/materials`, `/new`, `/[id]`), beside Products and Services. List with search and "Show archived"; add and edit with the error standard (summary, messages at the fields, nothing typed lost); archive and restore, never delete.
- **A material:** name (unique per business among those not archived, ignoring case and spaces), supplier (optional), a unit from a fixed list (weight: mg, g, kg; liquid: ml, l; length: mm, cm, m; count: each, dozen), **how much was bought** (thousandths, up to 3 decimals) and **what was paid** (cents). Up to 2000 that are not archived per business (archiving frees a slot).
- **VAT (founder, 2026-10-11: margins are worked out without VAT, with a note):** a business that is not VAT-registered is never asked: the price paid is the cost. A VAT-registered business chooses **Includes VAT** (the default), **Excludes VAT** or **No VAT charged**; the app works out the cost without VAT using the locale pack's rate, taking the VAT out of the exact amount and rounding once. **The note** is on the form, where the question is asked, and on the list ("(without VAT)"): "Costs and margins are worked out without VAT, so VAT you claim back is not counted as a cost. We don't work out what you can claim: that is for you and your adviser." The same note will sit beside every margin in slice 2 ("Margin is worked out without VAT"). The adviser questions are in `docs/plans/vat-on-costs-adviser-questions.md`.
- **The cost of one unit** is shown as it is typed ("That works out at R15,00 per kg (without VAT)") and in the list. It is derived, never stored. `materialCostCents` in `lib/materials` is the one place the arithmetic lives (exact integers, units of the same kind only, rounded once); slice 2 uses it for process inputs.
- **Not built yet:** anything that uses a material (the process, slice 2), stock, purchases, suppliers as records, price history.

## Tests (overall)
Unit: unit conversion and refusal of mixed dimensions; the cost of an item for each combination (always, choice-only inputs and steps, size scaling, batch size, quantity, extras with fixed counts, rounding once, VAT-excluded materials, no VAT charged). SQL: isolation, session required, same-business keys, "applies to" is none or exactly one, a used material cannot be deleted, the frozen costing in a sent version cannot change. Browser: set up materials, build a process with a Large that scales, a flavour that adds an input and a tiered variation that adds a step, see the margin change as choices change on a quote; the customer's document and PDF never show cost. Accessibility: each new screen.

## Still open
1. **Order** (assumed): slices 1 and 2 first, then jobs, then stock, since stock is mostly used up by jobs. Say if stock should come earlier.
2. **Waste** (assumed: later). Does an input need a "plus waste" percentage (offcuts, trimming) from the start? "Makes N" covers batches, and the maker can put waste into the amount.
3. **Extras with their own inputs and steps from day one** (assumed yes, decision 4). Say if not.
4. **Tax adviser check** on the VAT-registered wording and treatment before slice 1 ships.

## Not planned yet
Suppliers and purchase orders, price history of materials, supplier-specific costs, per-unit serial tracking, production scheduling, a process that contains other products (a cake made of a sponge product).
