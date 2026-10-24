# Plan: stock (materials and finished goods)

Status: **planned 2026-10-24, awaiting the founder's review before any code.** From the founder (2026-10-24: "do stock next"; "finish the features except the email and hosting of quotes and invoices"). Delivery layer 8 (`product-brief.md`); slices 5 and 6 of `costs-and-recipes.md` made concrete. Four slices, each its own pull request, **each with a migration (human review: new tables with row-level security, security-definer functions, a trigger that moves counts)**.

## Where things stand
- **Materials** (`/app/materials`) have a name, a unit, how much was bought, what was paid (so a cost for one unit), a supplier note, archive. Nothing counts how much is left.
- **Cost lines** on a product (and on an extra) say which material goes into one unit, how much, and for which choices (a size, an extra, a quantity), with "how many one batch makes".
- **Jobs** have items with a made count (`job_items.made_milli`) that changes in several places (counting, steps, the item editor); a job item knows its variation, options and extras.
- **Credit notes** show "Put returned items back in stock" as coming soon; products show a "Stock" placeholder; the Home page has job counts and prompts.

## Prototype read
Read in full 2026-10-24: `Materials.tsx` (all 1,558 lines: the list, the form, the detail screen, the low-stock logic and the active-job demand), the stock functions in `useAppState.ts` (`updateMaterialStock`, `applyDeductionsForUpdatedJobs`, `updateProductStock`, `applyStockToJobTask`, `removeStockFromJobTask`, the credit-note restock, `addNotification`), `costUtils.ts` (`getItemMaterialRequirements`, `getTaskMaterialBreakdown`), and the stock parts of `Jobs.tsx`, `Products.tsx` and `Invoices.tsx` by search.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| **Every material has a stock number** ("Current available stock", filled in with the bulk quantity bought on creation) and a **low-stock threshold** (default 15% of the bulk quantity) with an on/off switch | **Changed:** a count is **optional per material** ("Keep a count of this"). The count is a **ledger** of movements, the number on hand is their sum. A low level is optional too | Principle 1 (advanced features offered, never forced); prototype lesson, item 9 of the discovery notes (overwritten counts are not auditable) |
| **Quick adjust** on the detail screen: −5, −1, a typed number, +1, +5 write the count directly | **Changed:** three honest actions: **Bought some** (adds; optional what it cost), **Used some** (takes off, with a reason), **Count what you have** (you type what is on the shelf; the app records the difference). Each is a ledger entry with a day and a note | The ledger; a typed number that silently overwrites is how counts go wrong |
| **Stock is deducted as units are finished** (from the item's material requirements; restored if work is un-ticked; the amount is converted into the material's unit) | **Kept** (slice 2): taken off as an item's made count goes up, put back if it goes down. The amounts are **worked out when the job is made and kept on the item**, so a later change to a product's costs does not change an old job | Server side and in one transaction (discovery item 9); the prototype recomputed from the live product |
| **Low-stock warning** as a notification when a deduction takes stock to or below the threshold (and a "restored" notification) | **Kept in-app** (slice 1): a "Running low" filter and badge on the material, a count on the Materials menu item, a card on Home; dismissable. **Email or phone alerts: later** | Founder: notifications that grow from this; in-app first |
| **Active job demand** on each material card and the detail screen ("12 kg needed for 2 active jobs"), with a **+ Restock shortage** button that sets the stock to cover it | **Kept** (slice 2): needed for active jobs and short by, per material; the shortage button becomes **Bought some** with the shortage filled in | The same, without overwriting the count |
| **Per-job material breakdown**: each job item lists its materials, what is in stock, and "Need +X" with a restock button | **Kept** (slice 2) as a "Materials" section on the job | |
| (Not in the prototype) | **New, slice 3:** "**Can I make this?**" on an accepted quote and a **what to buy** list across active jobs, shareable as text | `costs-and-recipes.md` slice 5 |
| **Finished goods stock** is a number on a product ("Number in stock") that **Add from stock** takes into a job item (counts as made, needs no materials) and **return** gives back; **stock-creation jobs** (prefix STK, no customer) make things for the shelf | **Kept** (slice 4), but **per variation** and optional ("I keep some ready-made" on a product); a job for the shelf has no customer; credit-note restock uses it | The plan's decision 7 |
| **Credit note "restock"** puts the returned quantity back into product stock | **Kept** (slice 4): the sheet's "Put returned items back in stock" becomes real for products that keep stock | Placeholder in `credit-notes.md` |
| Supplier as a block of name, contact, email, phone and a full address on each material, with copy buttons; categories (Raw material, Packaging, ...) | **Later / not now:** suppliers as records, categories and copy buttons are not part of stock; the supplier note stays | Out of scope for stock; `costs-and-recipes.md` lists suppliers as later |
| Delete a material | **Dropped:** archive only (a material that a product uses is never deleted) | Already decided |

Missed from the prototype: nothing found.

## What the maker sees
**Slice 1, count materials.** On a material: a switch **"Keep a count of this"** (off by default). When on: the page shows **how much is on hand**, a **Bought some** button (how much, the day, what it cost: optional; "this is the new price" can update what the material costs), **Used some**, **Count what you have**, and a **history** of every entry. A material can have a **"Tell me when it's running low"** level. The list shows the count, a **Running low** chip and badge; the Materials item in the menu shows how many are low; Home gets a quiet card ("2 materials are running low") with a link and a dismiss. The first time a business adds a material, one friendly dismissable offer: "Want to keep a count of what you have?" (never forced).

**Slice 2, jobs use materials.** When a job is made from a quote, the materials one unit needs are worked out and kept on each item. As the item's made count goes up, the materials come off the count (an entry per change, "Used for JOB-0003: Cupcakes"); if it goes down, they go back. The job's page gets a **Materials** section: for each material, needed, on hand, short by. The Materials page shows "needed for active jobs". Materials that are not counted are ignored here (never block).

**Slice 3, can I make this and what to buy.** On an accepted quote (and the Create job sheet): "You're short of 2 materials for this quote" with the amounts. A **What to buy** page lists everything short across active jobs, with **Bought some** to record a purchase and a **Share** that gives the list as text.

**Slice 4, finished goods.** On a product: **"I keep some ready-made"** (off by default); then a count **per variation** with the same Bought/Used/Count actions (called **Made some**, **Sold or used**, **Count**). The products list shows how many are in stock. A job item can **take from the shelf** (counts as made, uses no materials); a **job for the shelf** (no customer) adds to the count as it is made; a credit note can put returned items back.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| An append-only list of entries with reversal | Invoice payments (`invoice_payments`, the Payments section, "Record a payment" sheet, reversing entry) | The same shape for the ledger and its sheet; reversal of a wrong entry |
| A quantity of a material with its unit | `QuantityField` and the unit list used by cost lines | As is |
| A day | The date field the payment sheet uses | As is |
| Filter chips and a badge | The Invoices list's Drafts chip; the nav's More item | As is |
| A friendly dismissable offer and a Home card | `prompt_dismissals`; the "Create a job?" and logo prompts | As is |
| Sheets for Bought / Used / Count | The payment sheet and the credit note sheet | The same sheet pattern |
| The "short by" per material | The costing summary lines | New small component |

Inputs by kind: **quantities** with `QuantityField` and the material's unit; **money** as the existing money field; **days** as the existing date field; no free-text numbers.

## Decisions (recommended first)
1. **Counting is optional per material,** off by default, offered once (not for every material). *Recommended.* Alternative: every material counted from the first purchase.
2. **Materials come off as units are made,** not when a job starts or ends. *Recommended;* it follows the made counts that already exist and matches the prototype. A job moved to Done with nothing counted takes nothing off (it says so on the job) rather than guessing.
3. **The materials one unit needs are kept on the job item when it is made,** not recalculated from the live product. *Recommended.*
4. **A trigger on the made count writes the entries,** so every place that changes the made count (counting, steps, the item editor) moves stock the same way. *Recommended* over changing each function.
5. **Entries are append-only;** a wrong entry is reversed by another, never edited or deleted (like payments). Counts on a material are kept in step by the same trigger and checked by a test.
6. **Alerts are in-app** (menu count, Home card). Email and phone alerts wait for the sending domain.
7. **A purchase can update the price paid** (a tick, "this is the new price"); a price history is not built.
8. **A job for the shelf has no customer** and no number from the customers' sequence (its own prefix, as the prototype's STK). *To confirm:* whether it should share the job sequence instead.

## Test plan
- SQL: isolation between businesses, session required, members read and cannot write directly, append-only, reversal rules, the count equals the sum of entries, concurrent entries, the made-count trigger (up, down, several items, an item removed), never below zero is a warning not a refusal (a count can go negative only through "used"; recorded, shown as short).
- Unit: unit conversion into the material's unit, the per-unit amounts for a choice and a batch, rounding (no drift over many small movements), the short-by sums.
- Browser: keep a count, buy, use, count, history; running low (chip, badge, menu count, Home card, dismiss); a job takes materials as it is counted and gives them back; the Materials section on a job; can I make this; what to buy; a product's per-variation stock and the shelf flows; accessibility cases in light and dark; a phone walk of each new screen.

## Risks
- **Rounding.** Small per-unit amounts (1 g from a 12-batch) are kept in millionths per unit and the movement is the difference between what should have been taken in total and what has been, so nothing drifts.
- **Several writers of the made count** (counting, steps, item editor): the trigger covers them; a test fails if one is missed.
- **Speed** (`docs/adr/0002-performance.md`): the on-hand count is a column kept by the trigger, so no list adds a query.
- **A material changed after it is used** (unit, archived): a counted material cannot change its unit once it has entries; archive keeps its history.

## Left for later
Email and phone alerts, suppliers as records and price history, purchase orders, barcode scanning, expiry dates, stock take sheets for several materials at once.
