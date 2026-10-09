# Plan: product variations and options (in discussion)

Status: **being worked through with the founder (2026-10-09). Nothing built.** Replaces the "Variations and extras" placeholder on products and in the item sheet.

## Decided so far
1. **Two concepts, not one** (founder, 2026-10-09, after the comparison with Shopify, Square and WooCommerce):
   - **Variations**: a list where each entry is a complete sellable thing with its **own price** (later its own recipe, stock, quantity prices and photo). Exactly one is chosen on a quote line. Example: Small R300 / Medium R450 / Large R600.
   - **Options and extras**: things that specify or add to the chosen variation, adding an amount (often R0) or recording a choice or text. Example: Flavour, Gold leaf +R50, Message on the cake.
   - The test shown to makers: "Does each one have its own price or its own stock? Then it's a variation."
2. **Naming:** the section is always called **"Variations"**. The maker names their own list ("Size", "Tiers", "Jar", "Duration"), and the product and the quote use their word ("Choose a size"). We suggest names, ordered by the business type when we know it (food: Size, Tiers; candles: Size, Scent is an option; services: Duration).

## Background
- Shopify: up to 3 options per product, every combination a variant (up to 2,048) with its own absolute price; no built-in extras (line item properties carry text but not price; apps add priced add-ons).
- Square: item variations (own price and stock) vs modifiers (priced add-ons or a text box, no stock).
- WooCommerce: variations (own price, SKU, stock) vs the Product Add-Ons extension (flat, percentage or per-character fees). A long-standing gap: an add-on whose price depends on the variation (a frame for a 20x20 vs a 50x50 print).
- The prototype: one list of "customisation options" with a required flag, a variation/extra flag and price uplifts; costs and steps refer to options by name (fragile; we use ids).

## Open
See the conversation of 2026-10-09: one list of variations or combinations; extras priced per variation; per item or once per line; text options; pre-selected values; how choices print.
