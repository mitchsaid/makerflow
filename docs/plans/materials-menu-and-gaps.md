# Plan: Materials in the menu, and two small customer-page gaps

Status: **planned and built 2026-10-23**, from the founder's request ("materials deserves a place as a first class menu item (and might grow to include notifications when low on certain items etc)", then "what about the product gaps - can we do those now with materials as a menu item?"). One slice, **no database change**. The gaps taken are the small ones from the "what's left" list; the rest are listed under "Left for later" with reasons.

## Where things stand
- Materials is the third switch on the Products tab (`/app/products/materials`): a list, add, edit, archive, and a cost for one unit. Nothing counts stock yet; stock, purchases, suppliers and low-stock warnings are layer 8 (`costs-and-recipes.md`, slices 5 and 6).
- The phone's tab bar is full at five (Home, Quotes, Jobs, Products, More). The desktop sidebar has room for everything.
- A customer's Invoices section lists issued invoices only: a draft started for them (I3b and I3c) is not shown there, and nothing says how many credit notes their invoices carry.

## Prototype read
Read in full 2026-10-23: `App.tsx` (the navigation: the tab list and how each tab is reached). **`Materials.tsx` (1,558 lines) is not read line by line for this slice**; this slice moves a page and does not build what the prototype's screen does. That screen is the stock slice's prototype and gets its full read when stock is planned (recorded in the coverage table in `prototype-discovery.md`).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| **Materials is a top-level tab** of its own, between Services and Customers (`App.tsx`: `TabType` includes `'Materials'`, and the sidebar lists it with a layers icon) | **Kept:** Materials is its own place, in the desktop sidebar and under More on a phone (the phone's bar stays at five) | The founder: it deserves a first-class place; stock and alerts will grow there |
| The Materials screen holds stock levels, a low-stock warning (a bell), suppliers with contact details, a reorder flow and unit conversion | **Later (stock slices):** a material has none of these yet; the page they will live on now exists | Thin slices: they come with the stock ledger (`costs-and-recipes.md`, slices 5 and 6) |
| Customers have no credit notes or invoice drafts in the prototype (credit notes were a list with a restock option; no drafts) | **No counterpart:** both are MakerFlow additions | |

Missed from the prototype: nothing found for the menu move; the stock screen's behaviours are listed above as later.

## What the maker sees
- **Materials** has its own page at `/app/materials` (with `/new` and `/[id]`). The desktop sidebar has a **Materials** item after Products; on a phone it is the first row under **More**. The Products tab has two switches again, **Products** and **Services**. The old address under Products still works (it forwards).
- **A customer's Invoices section** also lists their drafts (a row each: items, total so far, "Not issued", the quote it adjusts), above the issued invoices. Under it, when there are credit notes, a quiet line: "2 credit notes on these invoices".

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A place in the menu | `ITEMS` in `nav.tsx` (desktop only) and the More list | As is: one more entry in each |
| The Materials page, form and list | The existing page, moved | As is (heading becomes "Materials"; the switch is gone) |
| A draft row on the customer page | `InvoiceDraftRow` from the Invoices list | As is |
| The customer's drafts | The customer page's one query | Another embed in it, not another query |

Inputs by kind: none new.

## Decisions
1. **Not on the phone's tab bar yet.** Five is the most that fits at tap-target size, and a list opened now and then should not take a daily tab from Quotes or Jobs. Revisit when stock gives it a daily use (or a badge on More, for low stock). *Recommended.*
2. **The old address forwards** (a temporary redirect), so bookmarks and the "Add material" link inside a product keep working.
3. **Low-stock notifications are not built.** They need stock counts first (purchases in, jobs using materials up). When they come: an optional "tell me when below" level on a material, and only for materials with stock tracking on; first inside the app (a card on Home and a count on the Materials item, dismissable), email or push later.

## Left for later (and why)
- **Margin on the product list:** it needs every product's cost lines and the materials on one page, a second main query, against the speed rule (`docs/adr/0002-performance.md`). It wants its own plan for how to fetch it in one query.
- **A target per product or per customer, and price breaks suggested from cost:** new settings and design; not small.
- **"Copy summary" on a statement:** Share PDF covers sending it.
- **A mark on the PDF for an invoice changed from its quote:** decided no (the customer sees an invoice, not its history).
- **"Put returned items back in stock" and low-stock cards on Home:** wait for stock.
- **Dropping `invoices.costing`:** a migration to the invoice-issuing functions; best done together with any other change to them (the parked deposit tax invoice).

## Built (2026-10-23)
- `app/materials/*` (moved with `git mv`), the Products switch lost Materials, `next.config.ts` forwards `/app/products/materials/*`, `nav.tsx` and the More page have Materials, and the page text and links were updated.
- `getCustomerPage` also reads the customer's drafts (`invoice_drafts!invoice_drafts_customer_same_org`), `InvoiceSummary` has `creditNoteCount`, and the customer's Invoices section shows both.
- Tests: `e2e/materials.spec.ts` (reached from More, the old address forwards), `e2e/invoice-drafts.spec.ts` (the draft shows under the customer), `e2e/credit-notes.spec.ts` (the count), layout and accessibility cases updated for the new path.
