# Plan: visual design pass ("warm editorial") and a light / dark / system choice

Status: **planned 2026-11-02; slice 1 (the Appearance choice) built the same day.** Founder, 2026-11-02: "want to do a visual design / UI loop on the app ... all the values etc really easy to read, so don't want to overdo it with style, but it needs a bit more personality and polish ... also want to add explicit light mode / dark mode / follow system default options." Three directions were mocked on a design canvas (A warm editorial, B bold and friendly, C quiet ledger); the founder chose **A, warm editorial**, with one change: **no underline highlight under the business name**. (The "&" in the serif was tried in the body font instead and the founder preferred the original, so it stays as Fraunces draws it.)

## Where things stand
- Palette and tokens are in `app/src/app/globals.css` (shadcn names: terracotta `primary`, cream `background`). Dark mode follows the phone only (`prefers-color-scheme`), and Tailwind's `dark:` variant is wired the same way.
- Type is Geist (sans) for everything; headings are the same face, only heavier.
- Settings has a placeholder card, "App preferences: Your preferences will appear here."

## Prototype read
No prototype counterpart. The prototype has no dark mode or theme choice (searched `prototype/src` and `index.html` for dark, theme and prefers-color-scheme, 2026-11-02; the only "theme" hits are quote document themes, which MakerFlow already has separately). Its look is from another generation of the design and is not copied.

## What the maker sees
- **Look (slice 2 onward).** Warm cream pages and white cards with soft borders; a serif (Fraunces) for page titles and section titles; the body face (DM Sans) for everything else, including every number. Money is large, bold and tabular so columns line up and values read at a glance; overdue is red, paid is green, always with words as well as colour. Terracotta stays the action colour. Cards are a little rounder and the tab bar gains a small indicator above the active tab. The yellow marker highlight from the mock is dropped. "Products & services" keeps the serif's own "&".
- **Appearance (slice 1).** Settings, under "Appearance": **Same as my phone** (the default), **Light**, **Dark**. It applies at once and is remembered on that phone or computer (a screen is per device, like the install prompt; an account-wide setting could follow).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Choose one of three, with a line of help | `ChoiceCards` (`docs/ux-inputs.md`, "Choose one of a few") | As is |
| A place for the setting | The Settings page's "App preferences" card | As is (the placeholder is replaced) |
| Remembering it | Browser storage, like the install prompt's "seen" flag | As is: a per-viewer convenience, wrapped in try/catch, the page works without it |

Inputs by kind: one choice (ChoiceCards). No address, quantity, date, price or percentage.

## Decisions (with a recommendation)
1. **Stored per device, in the browser (`localStorage`), applied before the first paint** by a tiny script in the page head, so there is no flash of the wrong colours and the pages stay cacheable (a cookie read on the server would make every page dynamic). *Recommended.* Account-wide later if wanted.
2. **The attribute `data-theme="light" | "dark"` on `<html>`; absent means follow the phone.** The tokens are written once for light, once for dark under `[data-theme="dark"]`, and once for dark under the phone's setting when the attribute is not `light`. Tailwind's `dark:` variant follows the same rule.
3. **The browser's address-bar colour** (`theme-color`) follows the choice too, so a dark choice on a light phone does not leave a light bar.
4. **Fonts** through `next/font/google` (self-hosted by Next, no request to Google at runtime): Fraunces for headings, DM Sans for the body. Both are open licences.
5. **Documents are not themed by this.** Quote and invoice documents have their own themes (a sent invoice is locked to its theme); the app's dark mode only changes the app around them.

## Slices
1. **Appearance choice** (this slice): the mechanism (`data-theme`, the head script, the `dark:` variant), the Settings card, tests. No change to the colours.
2. **Tokens and type:** the warm-editorial palette (light and dark, contrast-checked) and the two fonts, app-wide; headings use the serif.
3. **Home and cards:** the money card (large tabular figures, status words), quote and job counts, the tab bar indicator.
4. **Lists and the quote builder:** product and customer rows, the pinned total bar, forms and buttons polished to match.

Each slice is walked on a phone viewport in light and dark and passes the accessibility scan.

## Tests
- Unit: the stored value is parsed safely (anything but "light" or "dark" means system); the head script's output.
- Browser: choosing Dark on a phone that prefers light makes the page dark and keeps it after a reload; choosing Light on a phone that prefers dark does the same; "Same as my phone" follows the phone again; the `dark:` classes (an input's background) change with the attribute.
- Accessibility: Settings in light and dark (already walked), with the new card.

## Questions for the founder
- Per device (recommended) or on the account, so it follows you to a new phone?
- Should the serif also be used for the quote and invoice documents, or stay with their own themes? (Recommended: stay with their own.)

## Not planned yet
A theme for the marketing landing page beyond the same tokens; per-business accent colours.

## Missed from the prototype
(none; no counterpart)
