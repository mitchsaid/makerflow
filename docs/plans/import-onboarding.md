# Plan: bring your products and your business details in (product import, and "start with an invoice or quote")

Status: **planned 2026-10-31; slice 1 (product import) built the same day, slice 2 (the reader) follows.** Founder, 2026-10-31: "Do the plan, and the importer, for both 'start with an invoice or quote' and import a list of products, unless you think product groups should come first." Builds on `docs/plans/onboarding.md` (decisions 3 and 5, and its guardrails for AI reading), which this plan makes concrete.

## Decision: product groups do not come first
Import first. A group is "products that share quantity prices and extras", so it only matters once a maker has many products, and getting many products in is what the import does. Imported products are ordinary products, so groups can be added afterwards and offered on top of them ("these 24 candles look alike: group them?"). Doing groups first would build a data model before the catalogues that need it have arrived. The made-up catalogues below (and the beta) decide its shape.

## Where things stand
- Onboarding today: business name, then "What do you make or sell?", then Home. The "Where shall we start?" and head-start screens in `onboarding.md` were never built.
- Products already save through `save_product_layers` (one transaction, the person's own access). The Products empty state has an inactive "Import from Shopify or a CSV" placeholder.
- No AI provider is wired up, and no key exists. The extraction experiment in `onboarding.md` was never run.

## Prototype read
No prototype counterpart. The prototype has no import and no document reading: the only file inputs in `Products.tsx`, `Profile.tsx` and `AdvancedCustomItemModal.tsx` are photo and logo pickers (read by searching them for upload, FileReader and file inputs, 2026-10-31), and its `@google/genai` dependency is unused scaffolding (`docs/prototype-discovery.md`).

## Candidate catalogues (made up, to design and test against)
Realistic shapes for South African makers. They are fixtures in `app/src/lib/import/__fixtures__/`, not real data.

| Maker | Shape | What the importer must do |
| --- | --- | --- |
| Baker | `Chocolate cake - 20cm` rows, `+R120` extras as rows | Flat list works; variation and extra rows import as plain products for now (suggested grouping is later) |
| Candle maker | `Product, Scent, Size, Price`, 24 rows | Name, Price found by header; Scent and Size ignored (later: variations) |
| Leather goods | `Code, Name, Price`, colour as separate rows | Plain products |
| Wedding stationery | `Invitations x50`, `R1 450` | `R1 450` read as 1 450 rand |
| Seamstress | `Hem trousers`, `R90`, `Hourly rate R250/hour` | Services; `/hour` becomes the unit |
| Woodworker | `from R3 500`, `R2 800–R4 500` | "from" is kept as the price with a note; a range is a problem with how to fix it |
| Xero items export | `ItemCode, ItemName, SalesDescription, SalesUnitPrice` | Columns found by name; blank prices flagged |
| QuickBooks products export | `Product/Service Name, SKU, Sales description, Sales price/rate, Type` | Columns found by name; `Type` of Service makes a service |

## What the maker sees

### Slice 1: import a list of products (Products > Import)
1. **Bring in your list.** Paste rows from a spreadsheet, or choose a CSV/TSV file (read in the browser; it is not uploaded). One question: "What is on this list?" Products or Services.
2. **Check the columns.** The first row is read as headings when it looks like them. Name, Price, Unit, Description and Type are guessed from the heading words (Xero, QuickBooks, Shopify-style and plain names) and can be changed. Without headings the first column is the name and the second the price.
3. **Check the products.** Every row is shown with its price. A row with a problem says what it is and how to fix it, and is left out; a name already in the list or already among the products is left out and says so. Each good row has a tick. For a business that charges VAT, a line says prices are read the way the maker enters prices (including or excluding VAT).
4. **Add N products.** They land on the Products list with "Added N products." Variations, extras and costs come afterwards, one product at a time, as today.

Entry points: a quiet "Import" link beside "Add product" on the Products page, and the Products empty state (replacing the inactive placeholder). Later: the same preview takes products found in an invoice (slice 2).

### Slice 2: start with an invoice or quote (onboarding, and Business profile)
1. After "What do you make or sell?", **Coming from another tool?** "Upload a recent quote or invoice and we'll fill in what we can." A PDF or a photo/screenshot, or "Start fresh". Shown only when the reader is switched on.
2. The document is read; the maker lands on the **Business profile form with the found details already filled in**, to check and save (the existing form and the existing save, so nothing new can write). Found lines go to the product preview of slice 1 ("We found 6 items on it. Add them as products?").
3. Not found is fine: the fields stay empty.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Paste a list | `TextAreaField` | As is |
| Choose a file | `Input type="file"` inside `Field`/`FieldLabel` | As is (no picture involved, so not `ImageField`) |
| Products or services | `ChoiceCards` | As is |
| Which column is the name, price… | `SelectField` | As is |
| A price | `parseMoney` (Money in `docs/ux-inputs.md`), the locale pack's currency symbol and number style | As is; the cell is cleaned first (symbol, "each", "/hour", "from") |
| A unit | `product.unit` text, as the product form | As is; read from a column or from "/hour" |
| Showing the rows | cards like `ProductList` rows, with `Checkbox` | New list because rows carry a tick and a problem; no existing "pick rows" list |
| Errors | `FormSummary`/`FormErrorScope` (ADR 0005) | As is for the paste and mapping steps; row problems sit on the row |
| Primary action | `Button`; the add link uses `AddLink` where it adds one product | As is |
| The business details | Business profile form (`/app/business`) | As is, with `initial` values from the reader |
| The found items | The slice 1 preview | As is |
| Saving a product | `save_product_layers` | As is, one call per product, ten at a time |

Inputs by kind: a paste box (words), a file, a choice (ChoiceCards), column choices (SelectField), ticks. No address, quantity, date or percentage is asked for.

## Decisions (with a recommendation)
1. **Flat list only in slice 1.** Variations, extras and quantity prices are not guessed from a flat sheet; a wrongly grouped catalogue is worse than a plain one. *Recommended.* Suggested grouping ("these 3 rows look like one cake with sizes") is the next slice, as a suggestion the maker confirms.
2. **Up to 200 products a time.** Keeps one request small and the preview readable; a longer list says to split it. *Recommended.*
3. **Existing names are skipped, never updated.** Importing twice does not double the catalogue and never overwrites a price the maker set by hand. *Recommended.*
4. **Prices are in the maker's own VAT entry mode.** The import does no VAT sums; it says which way the prices will be read. Asking "do these include VAT?" per import is possible later.
5. **The reader is off until configured**, like Google sign-in: with no key the onboarding step is not shown and nothing else changes.
6. **The reader takes one document at a time**, a PDF or one image up to 4 MB (phone photos are shrunk in the browser first), and does not keep it.

## Data
- **Slice 1: none.** No table or migration; products are written through `save_product_layers` under the person's own access.
- **Slice 2: one table**, `document_reads` (organisation, person, time), only to count how many reads a business has made so a limit and a cost cap are enforceable. Row-level security, the `session_required` policy, a SQL test. **Needs human review** (a migration, and an external service that receives the maker's document).

## Slices
1. **Product import** (parser and fixtures, the three steps, the server action, entry points, tests).
2. **The reader** (provider call with a fixed output schema, limits, the onboarding step, the Business profile entry, the found items into the preview). Off until a key is set. Real accuracy is unmeasured until someone runs it on real documents with a key; the experiment in `onboarding.md` stays the way to decide how much to rely on it.
3. **Later:** suggested grouping of variation rows, Shopify's product CSV (options become variations; additive-price check; see `onboarding.md`), customers import, product groups.

## Tests
- Unit: delimiter and quote handling; column guessing; price cells (`R1 450`, `450.00`, `from`, `/hour`, ranges, blank, junk); duplicates; the eight fixtures.
- Browser: paste a list, change a column, see a problem row left out, add, see the products; the empty-state entry; a phone-viewport walk and an accessibility case (light and dark).
- Slice 2: unit tests of the output schema validation with a fake provider; the limit; the off state; no browser test against the real provider.

## Questions for the founder
- Which model should the reader use? Default: the current Sonnet. A cheaper one may be enough once measured.
- Who sets the key and the monthly spend cap on the AI account? It is the one thing only the founder can do.

## Not planned yet
Reading a website, a costing spreadsheet, several documents together, Word and Excel files.

## Missed from the prototype
(none; no counterpart)
