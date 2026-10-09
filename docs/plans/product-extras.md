# Plan: two concepts for product choices (variation lists and extras)

Status: **agreed with the founder 2026-10-09**, building in two slices. Replaces the three kinds of option ("choose one", "choose any", "type something") in `product-choices.md`. Slice 2 changes the database and how a line's amount is worked out: money and data, needs human review.

## Why
Options were getting too complex for a maker setting up a product: three kinds, "required", "how is it charged", a kind to pick and a kind to change. Asked what the best shape is, the answer (objective assessment, 2026-10-09) was two concepts, each answering one plain question, and neither needing a setting about how many can be chosen:

1. **Variations: "What does it come in?"** Lists you pick exactly one from: Size, Flavour, Metal.
2. **Extras: "What can people add?"** Things you add on top, each with its own price: Gift wrap, Gold sprinkles, Engraving.

Making an extra a product (so it could be quoted as its own line) was rejected: a maker should not have to set up "gift wrap" as something they sell.

## What the maker sees

### Variations (slice 1)
- One section, **Variations**, holding one or more lists. Two kinds of list, said in plain words when adding one:
  - **Each has its own price**, like sizes (Small R300, Medium R450, Large R600). At most one per product; it sets the product's price.
  - **Adds to the price**, like flavour (Vanilla +R0, Red velvet +R50). As many as wanted, each with a usual one if wanted, and "Price depends on the size" when the product has sizes.
- "Choose one" options become these lists. Nothing changes in the database: the lists are the same rows, shown in one place.
- On a quote: pick one from each list, as now.

### Extras (slice 2)
- One section, **Extras**. An extra is one thing: a name, a price, and one tick, **Ask for wording** (Engraving asks "What should it say?"; a free "Message on the cake" is an extra at R0). Colours are separate extras (Gold gift wrap, Silver gift wrap).
- **Reusable or this product only**, per extra:
  - **Any product** (the default): the extra exists once for the business. Adding it to another product means picking it from the list of the business's saved extras (or typing a new name, which saves it). One price everywhere: changing it changes it on every product that has it, and the form says "Used on 3 products" beside it. Quotes already made keep their own price.
  - **This product only**: its own price, and it can cost more on a bigger size ("Price depends on the size"), as options can today.
- On a quote: tick the extras under the item. Each ticked extra has **how many**: empty means one for each item (12 cupcakes, 12 sprinkles), or a number (gift wrap: 1). That answers "once or each" with no setting. An extra that asks for wording needs its wording when ticked.
- The document: unchanged in look. Folded under the item by default; amounts for "each item" extras are in the price each; extras for a fixed number show their amount ("Gift box (+R30 once)" for one, "3 × R30,00" for more). The theme's "Extra prices: in the price / shown separately" stays.
- What was "Choose any" becomes one extra per choice; "Type something" becomes an extra that asks for wording.

## How the money works
Unchanged in order (`docs/plans/product-choices.md`, "How the money works"), with one addition: an extra for a fixed number adds **number × price** to the item's line amount, before the item's discount, as the once-per-line amount did before the options were simplified. Extras for each item are in the price each, as now.

## Data (slice 2, migration `20261025100000_extras.sql`)
- `extras`: business, optional `product_id` (set: this product only), name (1 to 80), price, `asks_for_wording`, `text_max` (1 to 500, default 100), `price_by_variation` (product-only extras only). Shared extra names are unique per business (case-insensitive).
- `product_extras`: which extras a product has, in the maker's order (shared and product-only alike). Up to 40 per product.
- `extra_variation_prices`: a product-only extra's price for each of its product's variations (the same shape as `product_option_value_prices`).
- Every new table: `organisation_id`, same-business composite keys, row-level security for members (as products), the restrictive `session_required` policy, and SQL tests.
- `save_product` gains `p_extras`: the list replaces the product's extras, keeping ids. Rules: a shared extra is updated in place (that is the "changes everywhere" the form announces); turning a shared extra into "this product only" while other products use it makes a copy for this product; turning a product-only extra into shared makes it shared.
- **Conversion of what exists:** each "choose any" value becomes a product-only extra (same id, so quote items that chose it still match), each "type something" option becomes a product-only extra that asks for wording (same id as the option), prices by variation move across, and those option rows are removed. "Choose one" lists stay as they are (slice 1).
- Quote items keep their own copy of what was chosen (`quote_lines.options`): an extra is kept as `kind: "any"` (value = its name, group "Extras") or `kind: "text"` (group = its name, text = the wording), with `value_id` = the extra's id and a new optional `quantity_milli` (absent: one for each item). Sent versions are frozen: an extra charged "once for the line" from before reads as a fixed quantity of one.

## Slices
1. **Variation lists** (no migration): "choose one" options shown and added in the Variations section; the Options section keeps "choose any" and "type something" until slice 2.
2. **Extras:** the tables, `save_product`, the Extras section, the item sheet (ticks with "how many" and wording), the money addition, the document and snapshot, the conversion, and the saved-extras picker.

## Tests
Unit: variation list parsing and the form; extras parsing (wording, shared or product-only, price by size); the money addition (fixed-number extras, discounts, VAT); document text for each quantity; old snapshots with "once". SQL: isolation and session required, unique shared names, `save_product` keeping ids, shared-to-product-only copying, the conversion of options. Browser: set up a product with two variation lists and a reusable extra; reuse it on a second product and see the price change follow; quote it with extras for each item and for a fixed number; the document. Accessibility: the product form sections and the item sheet.

## Not built
"Often added with this" (adding Mugs suggests "Logo setup"); extras with a cost (a material) for costing; stock; a screen to rename or archive saved extras (an extra can be removed from every product by removing it from each).
