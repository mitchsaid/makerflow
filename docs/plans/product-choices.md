# Plan: product variations, and options and extras

Status: **decisions made with the founder 2026-10-09; building in three slices. Slice 1 (variations) built, merged and deployed 2026-10-09** (migration `20261020100000_product_variations.sql`, needs human review). **Slice 2 (options and extras) built 2026-10-09** (migration `20261021100000_product_options.sql` and the once-per-line amount in `lib/money/document.ts`: money, needs human review). Replaces the "Variations and extras" placeholder on products and in the item sheet. Migrations and the change to how a line's amount is worked out need human review (money).

## Decisions (founder, 2026-10-09)
1. **Two concepts, not one** (after comparing Shopify, Square and WooCommerce, below):
   - **Variations**: a list where each entry is a complete sellable thing with its **own price** (later its own recipe, stock, quantity prices and photo). Exactly one is chosen on a quote item. Example: Small R300 / Medium R450 / Large R600.
   - **Options and extras**: things that specify or add to the chosen variation: an added amount (often R0), a choice, or some text. Example: Flavour, Gold leaf +R50, Message on the cake.
   - The test shown to makers: "Does each one have its own price or its own stock? Then it's a variation."
2. **Naming:** the section is always called **"Variations"**; the maker names their list ("Size", "Tiers", "Jar", "Duration") and the product and the quote use their word ("Choose a size"). Suggestions, ordered by the business type when known.
3. **One list of variations** per product (no multiplying lists). Two things that both set the price are written as combinations ("Round 20cm", "Square 20cm"), or one becomes an option ("Square +R50").
4. **Extras priced per variation** (gold leaf +R50 on a Small, +R120 on a Large): a switch on an option, "price depends on the size". Built in slice 3; the data allows it from slice 2.
5. **Charged per item or once per line, built now:** each option says "for each item" (gold sprinkles +R2 on 12 cupcakes = R24) or "once for the item line" (gift box +R30 once).
6. **Text options:** a third kind, "Type something" (message on the cake, engraving), with an optional price and a length limit.
7. **Pre-selected values:** the maker can mark one variation, and one value of a "choose one" option, as **usual**; it is pre-selected. Without a usual one the maker must choose (the item sheet says what is missing, Save stays enabled).
8. **On the document:** folded into the item by default: the variation joins the name ("Wedding cake, Large"), the options print underneath, the price each includes the per-item extras, and once-per-line extras show their amount so the sums add up. **A theme option, built now (slice 3): "Extra prices: included / shown separately"**, which lists each paid extra with its amount.

## What the maker sees
**Product form** (Products screen and the product sheet over a quote):
- **Variations:** "Does it come in sizes or other variations, each with its own price?" and **Add variations**. Then "What do you call them?" (suggestion chips: Size, Tiers, Box… by business type), rows of name and price, a "usual" choice, add and remove. With variations, the single price field goes (each variation has its price) and the list shows "from R300".
- **Options and extras:** **Add an option**: pick the kind as three small pictures (Choose one / Choose any / Type something), then its name, whether they must choose (choose one, type something), how it is charged (for each item / once for the item line), and its values with "+R" (R0 allowed) and a usual one (choose one). Each option is a card that opens one at a time, so the form stays short on a phone. No sheets on sheets.
**Item sheet** (adding or editing a quote item from a product): the variations as large tap cards with their prices, then each option (cards, ticks or a text box), the price each (starts at the variation's price, can be changed for this quote, follows a new variation unless it was changed by hand), and a live line: "12 × R17 + R30 once = R234".
**Quote item row:** "12 × R17 · Large · 3 options".
**Document:** see decision 8.

## How the money works (in this order; integers only)
1. **Price each** = the variation's price (or the product's), changeable on the quote, **plus the per-item extras** of the chosen options.
2. **Line amount** = quantity × price each (rounded to the cent, halves up) **plus the once-per-line extras**.
3. The item's discount comes off the line amount (extras included), then the quote discount is shared across the lines, then VAT once per treatment, as today (`lib/money/document.ts`).
Option amounts are typed in the business's price-entry mode (including or excluding VAT), like every price. They are zero or more (no negative extras in this build). A line keeps its own copy of everything chosen (names, text and amounts): changing or removing a variation or an option later never changes a quote.

## Data
- `products.variation_label` (the maker's word, up to 40 characters; null when there are no variations). With variations, `products.unit_price_cents` is kept as the lowest variation price (the "from" price and the list sort).
- `product_variations`: product, name (1 to 80), price, usual (at most one per product), order. Up to 50 per product.
- `product_option_groups`: product, name, kind (`one`, `any`, `text`), required (`one` and `text`), charge (`item`, `line`), for `text` a price and a maximum length (1 to 500), order. Up to 20 per product.
- `product_option_values`: group, name (1 to 80), price, usual (`one` only, at most one per group), order. Up to 50 per group.
- Slice 3: `product_option_value_prices` (value, variation, price) for "price depends on the variation".
- Every new table: `organisation_id`, the same-business composite keys, row-level security for members (as products: any member manages them), the restrictive `session_required` policy, and SQL tests. Rows can be deleted (quote items keep their copies).
- **Saving a product is one database function** (`save_product`, security invoker, under row-level security): the product and its variations and options in one transaction, keeping the ids of rows that stay.
- `quote_lines`: `variation_id` (same-business key, set to null if the variation is removed), `variation_label`, `variation_name` (the copies), `options` (a checked JSON list: the option's id, name, kind and charge; the value's id and name or the typed text; the amount), `save_quote_draft` replaced to carry them.
- Snapshot (frozen in sent versions): per line, the variation and the options with their amounts, the per-item extras and the once-per-line extras; `unitPriceCents` stays "price each" (now including per-item extras). Older versions have none of these and draw as before.
- Products load with their variations and options in the same single query (nested select), so pages keep one query for their main data.
- **Not done (changed from the first idea):** every product getting a hidden default variation. The product's own price stays for products without variations; recipes and stock (later layers) will attach to the variation when there is one, else the product. Revisit when stock is designed.

## Slices (each merged and deployed to dev)
1. **Variations:** tables, `save_product`, the product form section with the maker's word and suggestions, the item sheet's variation cards with usual and the "choose one" error, quote items carrying the variation (name on the document "Wedding cake, Large"), the list's "from" price. No change to how amounts are worked out.
2. **Options and extras:** the three kinds, per item or once, usual, the item sheet, the money change (once-per-line amounts), the document (folded), text options.
3. **"Extra prices shown separately"** (theme option, every layout) and **extras priced per variation**.

## Built in slice 2 (notes)
- The product form: "Add an option" asks the kind first (three small pictures), then the option opens as a card (name, kind, "must be chosen" or "must be typed", "How is the price added?": to each item or once for the item line, its choices with "+R", the usual one for "choose one", or for text a price when typed and a longest length). One card is open at a time; a card with a problem stays open.
- The item sheet: "choose one" as rows (with "None" when not required), "choose any" as ticks, "type something" as a box with a character count; each shows "+R2 each" or "+R30 once"; a live sum ("12 × R22 + R55 once = R319"); required ones say "Choose a flavour." at the field and in the summary. Choices the product no longer offers stay on the item under "Kept as they were" until removed.
- The quote row: "12 × R22 · 4 options". The document (folded): "Flavour: Red velvet · Toppings: Gold sprinkles · Packaging: Gift box (+R30 once) · Message: “Happy 40th” (+R25 once)"; per-item amounts are in the price each.
- An item's options are a JSON list on `quote_lines.options` (the item's own copy, with the ids it came from).

## Comparison (2026-10-09)
- Shopify: up to 3 options per product, every combination a variant (up to 2,048) with its own absolute price; no built-in extras (line item properties carry text but not price; apps add priced add-ons).
- Square: item variations (own price and stock) vs modifiers (priced add-ons or a text box, no stock).
- WooCommerce: variations (own price, SKU, stock) vs the Product Add-Ons extension (flat, percentage or per-character fees). A long-standing gap: an add-on whose price depends on the variation (a frame for a 20x20 vs a 50x50 print).
- The prototype: one list of "customisation options" with a required flag, a variation/extra flag and price uplifts; costs and steps refer to options by name (fragile; we use ids).
- Shopify import (later): each Shopify variant becomes one of our variations (combinations named "Red / Large"), exactly.

## Tests
Unit: product choices parsing, line parsing with variations and options, the money order (per item, once, discounts, VAT in both modes), snapshot and document text in every layout, old snapshots. SQL: isolation, session required, limits, usual uniqueness, `save_product` keeping ids, a line's variation from another business refused. Browser: build a product with variations and options; quote it with usual and required choices; totals; the document; revise and quote again carry the choices. Accessibility: the product form sections and the item sheet.
