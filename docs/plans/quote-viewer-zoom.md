# Plan: pinch and zoom on the quote (and invoice) viewer

Status: **planned and built 2026-11-03.** Founder, 2026-11-03: "I also wonder if I can enable a better quote viewer for mobile web - something with pinch and zoom maybe?" Serves the product differentiator (how a quote looks), which on a phone is currently a whole A4 page squeezed to about 360 px wide, too small to read the small print or see the photos properly.

## Where things stand
- `PdfPreview` (a sent quote, an invoice, a credit note, a statement: the real PDF by URL) and `LivePdfPreview` (a draft or a theme, drawn in the browser from the snapshot) both draw the document with pdf.js onto canvases, one per page, at the width of the screen.
- Pinching the page zooms the whole app, not the document (and the app's layout is not made for that).

## Prototype read
No prototype counterpart. The prototype shows a quote as plain HTML in a modal (`prototype/src/components/QuoteView.tsx`) with no zoom; read 2026-11-03, nothing to carry over.

## What the maker sees
- Under the preview, a **Zoom in** button (a magnifier). Tapping the pages themselves does the same.
- It opens the document **full screen**, sharp at any size: the pages are drawn again at a higher resolution.
- **Pinch** to zoom (up to 5 times), **drag** to move around, **double-tap** to jump in on the spot and again to go back. Buttons for the same (− / + / Fit) at the top, because not everyone can pinch; arrow keys and + / − on a keyboard; Ctrl + scroll or a trackpad pinch on a computer.
- **Close** returns to the page where they were. Nothing is saved or changed; it is a view.
- The document inside the page stays as it is (still scrolls with the page, still one pass of drawing). Zoom is a separate view so a pinch never fights with scrolling the page.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| A full-screen layer with a close button | `Sheet` (`components/ui/sheet.tsx`) | As is, full height |
| Drawing the document | `drawPdfPages` (pdf.js, canvases) | With a "zoomable" option: more pixels per page, and a copy of the bytes (pdf.js hands a buffer to its worker) |
| Buttons | `Button` | As is, 44 px |
| Pinch / pan / double-tap | None in the app | **New**: a small pointer-events handler (no library) with the maths in a tested pure module. A library was not worth the weight for three gestures |

Inputs by kind: none (no form).

## Decisions
1. **A full-screen view, not zooming in place.** In place, a zoomed page would have to scroll inside the page's own scroll, and fingers cannot tell the two apart. *Recommended.*
2. **Re-draw at higher resolution when opened** (up to 4 times the pixels, capped at about 2,200 px wide), not stretch the first drawing: small print stays sharp when zoomed. Costs a second drawing only when someone asks to zoom.
3. **No new dependency**: pointer events with `touch-action: none` on the viewer only.

## Slices
1. This slice: the viewer on the quote, invoice, credit note and statement previews. The theme studio's small preview does not get it (it already has a "Full preview" sheet).

## Tests
- Unit: the zoom maths (clamping, keeping the point under the fingers still, centring a page smaller than the screen).
- Browser (phone): open, zoom with the buttons, double-tap, a two-finger pinch sent as pointer events, drag to move, Close; the page behind is unchanged.
- Accessibility: the open viewer in light and dark.

## Questions for the founder
- A real phone check please (iPhone Safari and Android Chrome): pinch feel and double-tap.

## Not planned yet
Zoom on the customer-facing quote page (not built yet); remembering the zoom between openings; download from inside the viewer.

## Missed from the prototype
(none; no counterpart)
