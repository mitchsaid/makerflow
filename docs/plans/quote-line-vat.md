# Plan: VAT treatment on each item (zero-rated and exempt)

Status: **built 2026-10-08** (founder: "Yes", to doing discard a revision and line VAT next). No database change: `quote_lines.vat_status` (`standard`, `zero`, `exempt`) and the money code (`calculateDocument`, VAT once per treatment) existed from the first quote slice; this slice makes them reachable. **Touches money and tax logic: needs human review**, and the South African examples need an accountant's eye (research note: `docs/locales/za/vat-and-documents.md`, "Line VAT").

## What the maker sees
- A **VAT-registered** business gets a "VAT on this item" choice in the item sheet: Standard-rated (15%) (the default), Zero-rated, Exempt, each with a one-line hint in the country's words. A business that is not VAT registered never sees it, and everything is standard (no VAT shown anywhere).
- The item row on the quote says "· Zero-rated" or "· Exempt" when it is not standard.
- The total follows at once: VAT is worked out on the standard-rated items only (once per treatment, on the group total, as the money code already did).
- The quote document, when it mixes treatments:
  - names the treatment under each item (SARS guide 13.6: a mixed document must distinguish the supplies);
  - breaks the totals down by treatment ("Zero-rated, no VAT R100,00", "Standard-rated, VAT R15,00 R115,00");
  - says what the prices include, in words that fit (prices include VAT at 15% on standard-rated items; zero-rated and exempt items carry no VAT; or "No VAT is charged: all items are zero-rated");
  - the VAT row does not name a rate when nothing on the quote is standard-rated.
  A quote of only standard-rated items looks exactly as it did.
- Delivery stays standard-rated (research note, answer 2); a free collection line is not an item and is never labelled.

## Decisions
1. **The words live in the locale pack** (`tax.statuses` labels and hints, `tax.mixedInclusiveStatement`), and are **frozen into the sent version** (`wording.vatStatusLabels`, `lines[].vatStatus`) like the rest of the wording. Versions sent before this have neither and are drawn as they were.
2. Not registered: the choice is dropped on save (a leftover from when the business was registered becomes standard), and the document ignores treatments.
3. Older apps that do not send a treatment mean standard (like other newer fields).
4. Not built: a default treatment on a product (a baker of only zero-rated bread would set it on each item for now). Next if asked. Also not built: reason codes, or the 21-day deposit tax invoice (invoices slice).

## Tests
Unit: parsing and totals with each treatment in both price-entry modes, not registered, missing and unknown treatments, quote discounts shared across treatments, the saved payload and the form round trip; snapshot wording and labels, the document for every layout (labels and breakdown present, drawn text), an older version unchanged. Browser: not registered has no choice; registered, an item zero-rated, the total and the row tag, saved and reloaded, the preview text, sent and frozen. Accessibility: the item sheet with the choice.
