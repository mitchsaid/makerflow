# Plan: your own quote themes (replaces "pick a design, then override it")

Status: **drafted 2026-10-08, in build.** Founder feedback on the first designs (PR #36): "I don't like how quote themes are implemented. Rather than choosing a default and overriding it, just allow users to make their own theme, either by remixing an existing one or starting from scratch. I want options for how the items are represented, e.g. table styling (the prototype has something along these lines). Need a more visual way to see what you're choosing; research best practices on mobile. Also the preview lags the selection."

Supersedes slice 2 of `quote-looks.md` (five designs + overrides + brand colour). Pictures (slice 1) stay as they are.

## What the maker sees

1. **A theme is a complete, named look that belongs to the business.** Nothing is "a default with overrides". A quote uses one theme.
2. **Starting points:** five **starter themes** that ship with the app (Classic, Modern, Warm, Bold, Soft; read-only) and **your themes**. From any theme: **Use**, or **Remix** (makes your own copy, named "Remix of Warm", opens it in the studio). Or **Start from scratch** (a plain black-and-white base with every part visible and changeable).
3. **The theme studio** (a full screen, mobile first) where a theme is built and changed. It never changes a sent quote.
4. **Where themes live:** Quotes and invoices > Themes (the library: use as the default for new quotes, remix, rename, delete). On a draft quote's preview: a strip of your themes to pick from, "Edit this theme" and "Make my own copy" (for a change to this quote only, remix it and it is yours).
5. **The default for new quotes** is one of your themes (or a starter). A quote that has not picked its own follows it.

### What a theme controls (the "parts")
| Part | Choices |
|---|---|
| Colours | accent; paper (white, cream, blush, mist, stone, or any colour); text stays near-black for reading (the app picks black or white where text sits on a colour) |
| Type | heading font and body font (sans, serif now; more later, each is a font file we ship) |
| Top of the page | style (plain, line of colour, band of colour, **boxed**), logo (logo and name, logo only, name only), alignment (left, centred) |
| **Items** | **layout: table, list, cards, showcase (large photo beside the details)**; table head (line, light colour, solid, none); rows (lines, zebra, grid, cards, space only); density (compact, comfortable, airy); columns (quantity, unit price: on or off); item numbers on or off; descriptions on or off; photo (none, small, large) and its shape (square, rounded, round) |
| Totals | line, light box, solid box, pill |
| Finish | corner roundness, border weight |

The first slice of items work covers table, list, cards and showcase with the table options. More can be added later as data.

## Seeing what you're choosing (research, 2026-10-08)

Findings (sources: WordPress Customizer trac on narrow screens, Material and other bottom-sheet guidance, Canva's mobile editor, Shopify's mobile theme editor, card-selection design systems; Square, Stripe and Wave only offer dashboard or colour-only template choices, so there is little to copy there):
- **The preview must stay in view** while choosing. WordPress's phone Customizer was criticised for dropping people on controls with no preview. A modal sheet that covers the page defeats live preview; a persistent (non-modal) panel does not.
- **Show the choice, don't name it.** For layout-type options use cards with a small picture of the result (vertical thumbnail cards for styles; chips only for simple things like on/off and short lists). Short labels (one to three words), same structure in a group.
- **Group, don't scroll one long form.** Five to seven tabs (chips), one group visible at a time. Pin the preview and the tab row; only the options scroll.
- **Sticky chrome and keyboards don't mix:** keep the sticky area small (about 40% of the screen at most), let the preview be tapped to open full screen, and don't put text fields in the pinned part.
- Canva-style **tap the thing to edit it** is a good later addition (tap the table in the preview and the Items tab opens). Not in the first build.

Design that follows:
- **Phone:** pinned preview at the top (about 40% of the height, page 1 of the real quote, tap to open full screen), a row of part chips under it (Colours, Type, Top, Items, Totals, Finish), and the options for that part scrolling below. Save and Done in a pinned bar at the bottom. Every option card is a **miniature drawn from the theme being edited**, so the cards change with the colours.
- **Wide screens:** options on the left, preview on the right, same components.

## The preview must not lag

Why it lags now (measured by reading the path): a tap saves to the database (server action), then the whole server page is re-rendered, then the PDF is fetched (which re-reads the quote and renders it on the server), then pdf.js draws it: four round trips in a row, with a blank placeholder in between.

Fix: **draw the PDF in the browser.** The preview page already has everything the document is drawn from (the snapshot, the logo and photos). `@react-pdf/renderer` runs in the browser, so the studio and the preview render the same `QuoteDocument` with the theme in local state, and pdf.js draws the result. No network trip per choice; the old page stays on screen until the new one is ready; stale renders are dropped; typing and tapping are never blocked (rendering happens after a short pause, off the main path). The server still makes the downloaded and sent PDFs from the same document code, so what you see is what is sent. The browser code is loaded only on those screens.

## Decisions
1. **Themes are rows** (`quote_themes`: name, a validated spec, per business, row-level security, `session_required`). Starters are code (read-only). A quote's `theme_id` (or a starter's key) says which; null means the business's default; the business default can be a theme or a starter.
2. **No per-quote overrides and no business brand colour.** The brand colour is the accent of the theme (and a new theme starts from the logo-free base; invoices will reuse themes).
3. **A sent version freezes the resolved spec**, as now. Old snapshots (the first designs shape) are still drawn: the spec reader upgrades them.
4. **Removing a theme in use** moves its drafts to the business default; sent quotes are unaffected (frozen).
5. **Limits:** 30 themes per business, name up to 40 characters, spec under 2 KB.
6. **The spec is data, not code,** and every choice is checked on the server (unknown values dropped, colours only `#rrggbb`).

## Slices (each merged and deployed to dev, per the standing instruction)
1. **Instant preview. BUILT.** The document is drawn in the browser (in a Web Worker, so taps are never held up), from the snapshot and the design held on the screen; the choice is saved quietly in the background (Send and Download wait for it). The preview keeps the old pages until the new ones are ready. Measured here (slow shared CPU, production build): about 0.6 s to lay out and 0.3 s to draw a two-page quote, with no network trip; a phone will differ. No database change. Left for later if needed: a lower-resolution first pass.
2. **Themes as saved things** (migration: `quote_themes`, `quotes.theme_id/theme_builtin`, `business_profiles.default_theme_id/default_theme_builtin`; drops the override columns and brand colour; SQL tests) with the library under Quotes and invoices, remix, rename, delete, default, and the picker on the preview.
3. **The studio** (mobile-first, visual cards, pinned preview): colours, type, top of the page, totals, finish.
4. **Items:** layouts (table, list, cards, showcase) and table styling in the PDF and the studio's Items tab.
5. Later: real-data thumbnails in the library, tap-to-edit from the preview, more fonts.

## Tests
Unit: spec validation and upgrade, every layout and option renders (text, page numbers, no orphan labels), frozen specs unaffected by later changes. SQL: `quote_themes` isolation between businesses, session required, limits, deleting a theme in use. Browser: remix a starter, change parts, see the preview change without a reload, save, use on a quote, send, edit the theme, the sent version is unchanged; accessibility for the library and the studio on a phone viewport; a speed check that a choice redraws the preview in well under a second (browser rendering, no network).
