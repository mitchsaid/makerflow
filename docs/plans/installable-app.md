# Plan: installable app (add to the home screen), and "Tell another maker"

Status: **built 2026-11-01.** Founder, 2026-11-01: "OK do those" (the five things proposed to get real makers testing; this is the first). Makers use MakerFlow on their phones, so it has to behave like an app there. No database change.

## Where things stand
The app was a plain website: no manifest, no icons, no safe-area handling. The docs for this Next.js version (`node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`) say an install prompt needs a manifest and icons, **not** a service worker.

## Prototype read
Read in full: `prototype/public/manifest.json`, `prototype/index.html` (its head) and a search of `prototype/src` for a service worker (none).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A manifest with name "MakerFlow Artisan Ledger", short name "MakerFlow", `display: standalone`, `start_url: "/"` | **Kept** (name and short name "MakerFlow", standalone), **changed** (start at `/app`) | An installed app should open on the maker's work |
| Icons that are **stock photos hot-linked from a photo site** (a sized photo, typed as PNG) | **Dropped** | Not an icon, not ours, and it breaks offline or if the link dies; ours are drawn and committed |
| `theme_color` terracotta `#b45309` in the manifest and `#D17A5E` in the page head (two different colours) | **Changed**: the page's own colours, light and dark | One source of truth (`globals.css`) |
| `background_color` cream, `orientation: any` | **Kept** the cream; orientation **changed** to portrait | The app is built mobile-first |
| No service worker | **Kept** (none) | See decision 1 |
| Nothing for the iPhone (no touch icon, no safe-area handling, plain viewport) | **Added** | Most makers' phones are iPhones |

## What the maker sees
- **On Android and in Chrome or Edge:** the browser's own "Install" works, and a row on the **More** tab says **Install MakerFlow**; one tap shows the browser's question. Once installed the row is gone.
- **On an iPhone or iPad in Safari** (there is no install button): the same row, which when tapped says where to find "Add to Home Screen".
- **Installed:** MakerFlow has its own terracotta icon with an "M", opens full screen, and starts at the workspace (a signed-out person is sent to sign in). The tab bar and the pinned action bars sit above the home bar, not under it.
- **Elsewhere** (a desktop Firefox, another iPhone browser): no row.
- **Tell another maker:** a row on More that opens the phone's own share sheet with a short line and the link; where there is no share sheet it copies the line and link and says so.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| A row on the More tab | The More rows and the "Send feedback" row (`Button` styled as a row) | As is (same look) |
| A short instruction | `p` with `role="status"` | As is |

Inputs by kind: none.

## Decisions (with a recommendation)
1. **No service worker, no offline.** Installing does not need one, and caching pages risks showing stale quotes and prices to a maker who is deciding things from them. *Recommended*; offline reading of a sent quote could come later and needs its own plan.
2. **Start URL is `/app`.** An installed app should open on the maker's work, not the marketing page.
3. **The tab bar's height is one variable** (`--tabbar-h`, 3.5rem plus the safe-area inset), used by the page's bottom padding and every pinned action bar, so the two cannot drift apart. The inset is 0 in a normal browser tab, so nothing changes there.
4. **Icons are drawn from shapes** (`scripts/make-icons.mjs`, no fonts) and committed; a maskable icon keeps its mark inside the safe 80%.
5. **No install nag.** An install prompt that pops up uninvited is the kind of thing we do not want; the row is there for whoever looks.
6. **A friendly card on Home for new makers on a phone** (founder, 2026-11-01: "After the user signs up on mobile, maybe a prompt to let them know how to add it, custom for iOS and android"). It sits on Home below the first-quote card, only on an iPhone, iPad or Android phone that is not already running the installed app, and says how for that phone: one **Install MakerFlow** button where the browser offers it; the Share → Add to Home Screen steps in Safari; "open this in Safari" on another iPhone browser; the browser-menu steps on Android when no offer has come. "Done" / "Not now" hides it for good on that phone (remembered in the browser's own storage, because an install is per device, not per account); it vanishes by itself once installed. It is never shown on a computer. The More row stays for anyone who dismissed it. The words and the choice of steps live in `src/lib/install` (`installGuide`) and are unit-tested.

## Tests
- Unit: which way a browser installs (installed, one tap, Safari steps, nothing), including an iPad that calls itself a Mac.
- Browser: the manifest is served with the right name, start URL and icons, and every icon exists as a PNG; the page links the manifest, the Apple icon and the theme colours; the More tab has the share row, which copies the link where there is no share sheet; no install row in a normal desktop browser.
- Accessibility: the More tab (light and dark) is already walked and now includes the new rows.
- By hand on a real phone, which tests cannot do: add to home screen on an iPhone and an Android, check the tab bar clears the home bar, check the icon.

## Missed from the prototype
(none)
