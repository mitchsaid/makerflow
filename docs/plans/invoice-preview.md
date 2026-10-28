# Plan: invoices get the quote's flow (preview before issuing) and a way back when something needs fixing

Status: **planned 2026-10-28; slice 1 built the same day** (see "Built" at the end). Founder, 2026-10-28: "invoice should have the same flow as quotes - see the preview before finalising", and "if something needs correction on a new invoice, eg. business address, once you add it, there's no way to navigate back to the invoice, and it doesn't seem to be saved as a draft?"

Three slices, each its own pull request, **no database change** in any:
1. **A way back, and nothing lost.** Every "fix this first" link (business profile, customer) keeps the invoice (or quote) it came from and brings the maker back to it.
2. **Preview before issuing.** An invoice draft's primary button becomes *Continue to preview*; the preview shows the invoice as the customer will see it, with *Edit* and *Issue invoice*.
3. **Create invoice on an accepted quote goes through the same preview.**

## Where things stand
- A quote: Save draft, then *Continue to preview* (`/app/quotes/[id]/preview`: the real document drawn on screen, the theme strip, and a bar with Edit, Download, Email, Mark as sent). Anything missing is named where it is missing.
- An invoice draft (`/app/invoices/new`, `/app/invoices/drafts/[id]`): a form with a pinned bar, **Save** and **Issue invoice**. *Issue invoice* checks the form, asks "Issue this invoice?", saves the draft if it is new, and issues. The first time anything is missing (the business's address, the customer's address) it shows a list with **Open your business profile** / **Open the customer** links.
- An accepted quote's **Create invoice** is a sheet (dates, note) that issues straight away, with **Adjust before issuing** to make a draft.
- The invoice document is built from the draft by `prepareInvoiceDraft` (number empty: the database gives it when it is issued). Nothing draws it before issuing.

### What went wrong for the founder
Issuing a new invoice keeps it as a draft first (so a lost reply cannot issue twice), then finds the business address missing and shows **Open your business profile**. That link is a plain navigation: the business page has no way back to the invoice (it is a top-level page with no back control; the installed app has no browser Back), nothing says the invoice was kept, and the Invoices list shows drafts only under its *Drafts* view. So the invoice seems lost. The same trap is on the quote's *Mark as sent* (business details) and the *Create invoice* sheet.

## Prototype read
Read in full 2026-10-17 and again for this plan 2026-10-28: `prototype/src/components/Invoices.tsx` (create form 1170 to 1900, the invoice view 1900 to 2230 with `DocumentRenderer` at 2114), `createInvoice`/`updateInvoice` in `hooks/useAppState.ts`, `DocumentRenderer.tsx` (invoice branches). Skipped: the item sheet and customer form (the same as Quotes', read for `docs/plans/quotes.md`). Coverage is in `docs/prototype-discovery.md`.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| The create form's only way on is **Save & Issue Invoice**: the invoice is issued at once, with no preview | **Changed:** a preview step before issuing (slices 2 and 3) | Founder, 2026-10-28; an issued invoice is a tax document that can never change, so the maker should see it first |
| The invoice is shown with `DocumentRenderer` after it is made | **Kept** (the invoice page shows the stored document); the same drawing is used for the preview | One document code for the preview and the PDF |
| An issued invoice can be edited (**Update Invoice**) | **Dropped** (already, I3): an issued invoice never changes; corrections are credit notes | Issued documents are immutable |
| Nothing is kept until it is issued; no draft | **Changed** (already, I3c): drafts are kept | The prototype loses what is typed |
| Missing business or customer details are not checked | **Kept as changed:** named before issuing, with a way to fix and a way back (slice 1) | Founder, 2026-10-28 |

## What the maker sees
**Slice 1 (a way back).**
- Where an invoice (or quote) says something must be fixed first, the link goes to the business profile or the customer **with the way back**: the page shows a back control named for where they came from ("Back to invoice draft", "Back to quote QT-0001"). It is the same control as everywhere else (`PageHeader`), shown only when the maker arrived from a document.
- Following the link **keeps the invoice first**: a new invoice is saved as a draft, so the maker finds it where they left it and nothing typed is lost.
- A new invoice that has been kept says **Draft saved.**, as after Save.
- After the business profile is saved, the back control is what is on the page (no automatic jump: the maker may want to change more).

**Slice 2 (preview).**
- The draft's pinned bar is **Save** and **Continue to preview** (as a quote's *Continue to preview*). It saves, checks it as an invoice, and opens `/app/invoices/drafts/[id]/preview`.
- If something is missing, the form shows it where it is missing, as now (nothing is previewed that could not be issued).
- The preview shows the invoice as the customer will see it (the real document, drawn on screen), numbered "Not yet numbered" until it is issued, with **Edit** (back to the draft) and **Issue invoice** (the existing "Issue this invoice?" question, then the next number). The sr-only text version of the document is there too.
- Problems that appear only at issuing (the business's address) are listed on the preview with the same links and the way back.
- No Download or Email on a draft: a document without its number is not something to send. They are on the issued invoice (as now). *Later:* if the maker wants to share a draft for approval, a watermarked copy.

**Slice 3 (Create invoice from a quote).**
- **Create invoice** on an accepted quote keeps its sheet (dates, note) but its primary button becomes **Continue to preview**: it makes the draft from the quote's agreed version with those dates and note, and opens the preview. **Adjust before issuing** stays (it opens the draft form instead).
- The invoice is issued from the preview, as any draft.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| The preview of a document | `LivePdfPreview` and the sr-only `QuoteDocumentView` (`quotes/live-preview.tsx`, `quotes/quote-document-view.tsx`) | As is (the theme strip is not shown: an invoice keeps its quote's design, or Classic) |
| The way on from a preview | The quote's `PreviewBar` pattern (sticky bar: Edit, then the primary) | Same layout, its own component (it has no Download/Email) |
| Continue to preview | `QuoteBuilder.onPreview` (save if changed, then go) | Same behaviour in the invoice draft form |
| Confirm issuing | The existing "Issue this invoice?" sheet | Moved to the preview (same text) |
| The way back from a fix | `PageHeader` `back` (docs/adr/0009-back-navigation.md) | As is, with the destination given in the address (`?back=`) |
| Naming what is missing | `invoiceProblems` list with links | As is, plus the back address |

Inputs by kind: none new.

## Decisions (with a recommendation)
1. **The back address is in the link** (`/app/business?back=/app/invoices/drafts/ID`), checked on the server to be an address inside the app (`/app/...`, no scheme, no `//`), never trusted otherwise. The label is worked out from the path (an invoice draft, a quote, an invoice preview). *Recommended*: it works after a deep link or in the installed app, and the back control stays the one pattern.
2. **The preview has no number; it says "Not yet numbered"**, because numbers are gapless and given when issued. Showing the next number would suggest a reservation that does not exist.
3. **No theme strip on the invoice preview** for now: an invoice keeps its quote's theme or Classic (as today). *Later* if wanted.
4. **No Download or Email on a draft** (above).

## Data
No database change. The preview page reads the stored draft and runs `prepareInvoiceDraft` (one read, plus the workspace check), the same as issuing does, so the preview and the invoice cannot disagree. Tenancy as today (the draft is read under the person's own session).

## Slices
1. A way back, and nothing lost (this plan's "What went wrong").
2. Preview before issuing (draft form, preview page, the issue sheet moves).
3. Create invoice on a quote goes through the preview.

## Tests
- Unit: the back address is accepted only inside the app; the label for each destination.
- Browser: slice 1 (a new invoice, no business address: Issue, follow the link, the business page has the back control, Back opens the draft with everything typed; the quote's *Mark as sent* link the same); slice 2 (Continue to preview shows the document and "Not yet numbered", Edit returns with nothing lost, Issue invoice issues and opens the invoice; a missing detail stays on the form); slice 3 (Create invoice from a quote opens the preview, the numbers and totals are the quote's).
- Accessibility: the back control on the business page, the preview page, light and dark; the phone viewport walk.

## Questions for the founder
- Is "no Download or Email on an unnumbered draft" right, or do you want a copy to share before issuing?

## Not planned yet
A theme strip for invoices; a watermarked draft copy; emailing the invoice (with the quote's Email, when it is built).

## Built, slice 1 (2026-10-28, PR 144)
The way back (`lib/back-link.ts`, `?back=`), the business profile and customer pages showing it across their tabs, the invoice draft saving before it follows a fix link, and the same on the Create invoice sheet and the quote's no-contact note. No database change.

## Built, slice 2 (2026-10-28)
The invoice draft form's bar is **Save** and **Continue to preview** (checks it as an invoice, keeps it as a draft, opens `/app/invoices/drafts/[id]/preview`). The preview draws the invoice with `LivePdfPreview` from `prepareInvoiceDraft` (number shown as "Not yet numbered"), lists anything still missing with links that carry the way back to the preview, and has **Edit** and **Issue invoice** (`issueStoredInvoiceDraft`, which reads the kept draft, so what was previewed is what is issued). The "Issue this invoice?" question moved from the form to the preview; the form's old issue path and `issueInvoiceDraft` are gone. No database change.
