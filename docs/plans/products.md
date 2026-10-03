# Plan: products, first layer (name, price, description, kind)

Status: **approved by the founder 2026-10-03** (decisions below). Building in two pull requests. Brings slice 7 of `docs/plans/quotes.md` forward, ahead of issuing (founder, 2026-10-02: "customers first", then products with name, price, description and kind). Inputs: `docs/plans/onboarding.md` ("Products (shape agreed, build later)"), the prototype (`prototype/src/components/Quotes.tsx`, `App.tsx`), and the thin-slice rule in `docs/product-brief.md`, principle 9.

## The rule this plan follows
A thin slice uses the **full feature's interaction**, with what is not built yet shown as **visible but inactive "coming soon" sections**, in production as on dev. Nothing here is a stand-in that a later layer replaces.

## The flow (agreed with the founder 2026-10-03)
Two separate jobs, as in the prototype:
1. **Create a product** (what you sell, once): name, price, description, product or service. Later layers add options, costs, quantity prices, production steps and stock.
2. **Configure a line** (what this customer gets): choose the product, then set the quantity, the price for this quote and a discount. Later: choose its variations and extras (the founder wants to work through variations and extras together before they are designed).

What the prototype does (checked in the code): choosing a product opens a configuration view (quantity, unit price from the quantity price, variations with the first pre-selected, extras, item discount, item tax) before the line is added, and "Edit Specifications" reopens it. "Add new product" closes the picker and **switches to the Products tab** (`App.tsx:49`), so the maker leaves the quote, creates the product, comes back, opens the picker again and chooses it.

What we do instead: everything happens over the quote, in sheets (full-screen on phones, like the customer sheet).

```
Quote > Items > "Add item"
  -> Item sheet: search your products and services
       - choose one ............................> Configure sheet -> line added
       - "Add new product" -> Product sheet -> saved -> Configure sheet -> line added
       - "One-off item" (just for this quote) ..> Configure sheet (name typed) -> line added
       - "Import from Shopify or a CSV" (inactive: coming soon)
Quote > a line > "Edit" -> Configure sheet (same one)
Configure sheet > "Edit this product" -> Product sheet (stays on the quote)
```

## Screens
1. **Product form** (a page under Products, and the same form in a sheet over the quote):
   - **Basics (working):** name (required), price (typed in the business's VAT entry mode, like quote lines), description (optional, shown on quotes), product or service.
   - **Inactive "coming soon" sections**, in this order: Photo; Variations and extras; Costs and margin (materials, labour, other costs); Quantity prices; Production steps; Stock. Each is a card with its title, one plain line on what it will do, and no inputs.
2. **Products list:** search, add, edit, archive and restore (archive, never delete: quote lines will point at products). Empty state: "Add your first product" plus the inactive "Import from Shopify or a CSV". On phones it is **its own tab** (Home, Quotes, Customers, Products, More); the desktop sidebar lists it too.
3. **Quote items:**
   - The items section becomes a **list of lines** (name, quantity x price, line total, Edit, Remove) with an **"Add item"** button. Lines are edited in the Configure sheet, not inline. This is the plan's original "line editor as a sheet", and it is where variations and extras will go.
   - **Item sheet:** search products and services, "Add new product", "One-off item", and the inactive import.
   - **Configure sheet (working):** quantity, unit price (starts at the product's price, can be changed for this quote), discount on this item, description (starts from the product's, can be changed). For a one-off item the name is typed too. **Inactive:** "Variations and extras: coming soon". A link **"Edit this product"** opens the product form in a sheet.
   - Delivery or collection, discount on the whole quote, notes and totals stay as they are.

## Data
- New table `products`: organisation, **kind** (product or service), name, description, **unit price** in cents, archived, timestamps. Row-level security for members (any member can manage products, like customers), the `session_required` policy, no delete grant, unique on (organisation, id) for composite keys. SQL tests as for customers.
- `quote_lines` gets an optional **`product_id`** (composite foreign key to the same business's products). The line keeps its **own copy** of the name, description and price, as it does now. A product's price changing later never changes an existing line, draft or sent; the Configure sheet shows the product's current price beside the line's, so the maker can update a draft line on purpose.
- **Not modelled yet:** options, variations and extras, costs and materials, quantity prices, production steps, stock, photos. The onboarding plan says "the full model is stored from the start", but the founder wants to work through variations and extras before they are designed, so their tables are designed then. Nothing decided here blocks them: products keep stable ids, and lines already reference a product and carry their own copy.

## Delivery (two pull requests)
1. **Products:** table, tests, Products list and product form with the inactive sections, the Products tab.
2. **Products in quotes:** lines list with "Add item", Item sheet, Configure sheet (with "Edit this product"), "Add new product" from the quote, one-off items through the same sheet; existing draft lines keep working (they become one-off items).

## Tests
SQL: isolation between businesses, any member manages products, no delete, archive and restore, a line can only reference a product of the same business. Unit: product form parsing, configure-sheet parsing, line copies. Browser (phone): create a product from the Products screen and from inside a quote without losing the quote; choose a product and configure it; edit a line; a product price change does not move a line; the inactive sections are visible and do nothing; accessibility for every new screen and sheet (light and dark); `pnpm perf` for the Products list.

## Decisions (founder, 2026-10-03)
1. **Existing typed lines** become one-off items, edited in the Configure sheet like every other line. (They already are: a line without a product is a one-off item, so nothing is converted or lost.)
2. **Price changes:** a line keeps its own price when the product's price changes; the Configure sheet shows the product's current price beside it.
3. **Products gets its own tab on phones:** Home, Quotes, Customers, Products, More (Business profile and Settings stay under More).
