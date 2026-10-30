# Plan: invoices get themes and the quote's display settings

Status: **planned 2026-10-30; the three slices built the same day** (see "Built" at the end; slice 2 **needs human review**, migration `20261129100000_invoice_draft_themes.sql`). Founder, 2026-10-30: "invoices should have themes, just like quotes, same settings for showing images, quantity discounts etc."

Three slices, one pull request each. Slice 1 has no database change; slice 2 changes the database (`invoice_drafts`) and **needs human review**.
1. **The display settings on an invoice draft**: show product photos, show quantity prices (the two the quote has), set on the item sheet exactly as on a quote.
2. **Themes on an invoice draft**: the same theme strip, studio, "Edit this theme" and "Remix" as a quote's preview, using the business's own themes.
3. **An issued invoice shows the theme it went out with**, read-only, as a sent quote does.

## Where things stand
- An invoice is drawn by the quote's document code from a snapshot, so every theme part already works on an invoice. What is missing is a way to choose.
- An invoice made from a quote **follows the quote's theme** (`prepareInvoiceDraft` takes the quote's `theme_id`/`theme_starter`, read live through the quote). An invoice with no quote uses the business default theme, Classic if none (`chooseTheme`). Nothing on an invoice draft lets the maker change either.
- The draft form already carries `showPhotos` (a draft from a quote copies the quote's) and `showQuantityPrices` (it is a quote form value), but the invoice form has no control for either, so a quote's choice is carried over and cannot be changed.
- An issued invoice stores its finished look (the theme, resolved) in its snapshot, like a sent quote: that is untouched.

## Prototype read
Read 2026-10-30: `prototype/src/components/Invoices.tsx` (the template state at lines 96 and 284 to 285, the load and save of `templateId` and `templateCustomStyle` at 624 and 749, and the invoice view with `DocumentRenderer` at 2085 to 2135), and `DocumentRenderer.tsx` for `showProductPhotos`. The template gallery and customiser modals (`TemplateGalleryModal`, `TemplateCustomizerModal`) are imported by `Invoices.tsx` but their use on the invoice screens was not found in the lines read: **not verified further**; they are the quote screens' modals (see `docs/plans/quote-themes.md`).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| An invoice has a `templateId` (default 'artisan-warm') and optional `templateCustomStyle`, saved with it and drawn by the same `DocumentRenderer` as a quote | **Kept:** an invoice has a theme, drawn by the same document code as a quote | Founder, 2026-10-30 |
| `showProductPhotos` is part of the template style, so photos on or off travel with the template | **Changed:** as on a MakerFlow quote, photos on or off is a setting of the document (the draft), not of the theme | Quotes already work this way (`docs/plans/quote-themes.md`, `docs/plans/pictures.md`) |
| The invoice's template is changed on an issued invoice (`onUpdateInvoiceTemplate`) | **Dropped:** an issued invoice never changes; the look is chosen on the draft | Issued documents are immutable |
| No quantity prices on an invoice | **New for invoices:** same setting as a quote (a quote has it, `docs/plans/quantity-prices-and-steps.md`) | Founder, 2026-10-30 |

## What the maker sees
**Slice 1: the settings.** On an invoice draft's item sheet, exactly the quote's:
- Under the product photo: **Show product photos on this invoice**.
- Under the price field, when quantity prices apply: **Show quantity prices on this invoice**.
- Both are applied when the item is saved (Cancel changes nothing), and set for the whole invoice, as on a quote. An invoice made from a quote starts with the quote's choices.

**Slice 2: the theme.**
- The invoice **preview** (`/app/invoices/drafts/[id]/preview`) shows the same **Theme** strip as a quote's preview: your themes, then the five starters, **Create new theme**, **Edit this theme**, **Remix this theme** for owners and admins. A tap redraws the preview at once and is saved quietly.
- A new invoice from a quote **starts with the quote's theme** (copied when the draft is made, so changing the quote later does not move the invoice); a new invoice with no quote starts with the business's default theme.
- The draft's PDF copy and the numbered invoice use the chosen theme.
- Themes are **one library for the business**, used for quotes and invoices (as the quote-themes plan said, "and, later, invoices"): the strip, the studio and the themes list are the same. *Question below: one default, or one for invoices as well?*

**Slice 3: the issued invoice.** Its page shows a read-only **Theme** card ("The look this invoice was sent with"), as a sent quote's does (`DesignSection`).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| The item sheet's two display settings | `LineSheet`'s `quoteShows` (photo checkbox under the photo, quantity-price checkbox under the price) | As is; the invoice form passes it, with "invoice" in the labels (the sheet already takes the document word) |
| Choosing a theme on a preview | `DraftPreview` in `quotes/design-section.tsx` (strip, instant redraw, quiet save) | **With a mode:** it takes a save function and the links' return address instead of assuming a quote (today it calls `saveQuoteTheme(quoteId, …)` and links with `?quote=`) |
| The theme studio, "Edit" and "Remix" | `/app/quotes/settings/themes/...` (`?quote=` brings the maker back to the quote's preview) | As is, with the return address generalised (`?back=`, `lib/back-link.ts`, as the invoice-preview plan did) |
| The issued document's theme | `DesignSection` (read-only card) | As is |

Inputs by kind: none new (checkboxes and the existing strip).

## Decisions (with a recommendation)
1. **Store the draft's theme in two columns on `invoice_drafts` (`theme_id`, `theme_starter`), as `quotes` has.** A composite same-business foreign key keeps a draft from pointing at another business's theme; deleting a theme clears the reference (its drafts then follow the default), as for quotes. *Recommended* over a value inside the draft's `form` JSON, which cannot be checked by the database. The numbered invoice needs no new column: its snapshot carries the resolved look.
2. **Copy the quote's theme into the invoice draft when the draft is made** (today it follows the quote live). A look chosen for the invoice then stays put.
3. **One theme library, one default for new documents** to begin with (the business default theme). A separate default for invoices later if wanted.
4. **No theme or photo choice on the Create invoice sheet**: it opens the preview, where the strip is.

## Data (slice 2; needs human review)
`invoice_drafts.theme_id uuid` and `theme_starter text` with the same checks as `quotes` (at most one set; the starter must be a known key; the theme is of the same business by composite foreign key, `on delete set null` for the theme column only), column grants for insert and update by members, and a SQL test: stored and cleared, another business's theme refused, a deleted theme clears the reference, another business sees nothing. The existing row-level security and `session_required` policy cover the new columns. Nothing is rewritten: existing drafts have neither set and follow the default (or their quote's theme until they are saved).

## Tests
- Unit: the draft's theme is chosen as `chooseTheme` does; an invoice from a quote starts with the quote's; the display settings carry from the quote and can be changed.
- SQL: as above.
- Browser: the two checkboxes on an invoice draft's item sheet (the preview shows or hides photos and the quantity-price line; Cancel changes nothing); the strip on the invoice preview (a tap changes the preview and survives a reload; "Create new theme" returns to the invoice preview); the numbered invoice carries the theme; the accessibility walk covers the invoice preview strip and the issued invoice's card.

## Questions for the founder (answered 2026-10-30)
- One default theme for quotes and invoices, or a separate default for invoices? **Shared.** A new quote or invoice starts with the theme chosen last, on either.
- Should a sent invoice be locked to its theme? **Yes.** It carries the look it went out with and cannot be changed.

## Not planned yet
Different theme parts for invoices (a "paid" stamp, a payment panel layout); per-customer themes.

## Built (2026-10-30)
- **Slice 1:** `LineSheet`'s `quoteShows` is passed by the invoice draft form (labels say "invoice"); an invoice made from a quote also starts with the quote's quantity-price choice.
- **Slice 2:** migration `20261129100000_invoice_draft_themes.sql` (`invoice_drafts.theme_id`, `theme_starter`, `theme_picked_at`, a pick trigger, an inherit trigger, and `quotes_inherit_theme` replaced so the last pick counts across quotes AND invoice drafts); `saveInvoiceDraftTheme`; the invoice preview uses `DraftPreview` (now taking a `ThemeTarget`, `lib/quotes/theme-target.ts`, so the studio's `?quote=` and new `?invoice=` both work and "Save and use on this invoice" returns to the invoice preview); Download and Mark as sent wait for a pending theme save; `prepareInvoiceDraft` takes the theme as its own argument. A draft made from a quote copies the quote's theme. SQL test `invoice_draft_themes.test.sql`; browser test in `e2e/invoice-drafts.spec.ts`.
- **Slice 3:** a sent invoice's page has the read-only Theme card (`DesignSection` with `what="invoice"`).
- **Known edge:** a draft's pick stops counting as "the last chosen" once the draft is sent (the draft is removed); the sent invoice keeps its look, and quotes keep theirs.
