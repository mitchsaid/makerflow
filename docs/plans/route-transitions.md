# Plan: route transitions (the app slides forward and back, and fades between tabs)

Status: **planned and built 2026-10-31.** Founder, 2026-10-31, after asking whether the app does what makes a web app feel like an app (optimistic updates, skeletons, the View Transitions API, no tap delay): "Let's do route transitions first." No database change; no change to what any page shows.

## Prototype read
No prototype counterpart. The prototype is a single-page demo with no routes (`prototype/src/App.tsx` swaps whole screens in state), so there is nothing to keep, change or drop.

## What the maker sees
- **Going deeper** (a row to its page, a page to its preview, "Add…", Settings to a settings page): the new page slides in over the old one from the right, and the old page moves a little way left and dims under it, like a phone's own push. About a third of a second, decelerating.
- **Coming back** (the chevron or X at the top of a page, or any link that goes to a parent page): the page slides off to the right and the one beneath comes back into place.
- **Moving between tabs, or anywhere that is neither deeper nor back** (Home to Quotes, a customer to a quote that is not under it, after a save sends you somewhere): nothing moves; the page is simply there, as on a phone's own tab bar.
- The bottom tab bar (phones) and the sidebar (wider screens) do not move. Anything pinned inside a page (a pinned action bar) moves with its page.
- **Reduced motion:** with the phone or computer set to reduce motion, there is no animation at all.
- **Browser back and swipe-back** carry no direction, so they fade. (In an installed app on iOS the system's own swipe-back is native.)
- Nothing waits for an animation: a page is on screen and usable as soon as it is ready. During the animation taps go to the new page (the animation layer does not catch them).
- Nothing else changes: the loading skeletons stay as they are (a page that is not ready yet slides in as its skeleton, then fills in).

## How (for review)
- React's `<ViewTransition>` (in the React that Next 16 ships; no setting needed, `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). One keyed wrapper, `PageTransition`, sits around the page content in `app/app/layout.tsx`; its key is the path, so a path change is an exit and an enter. (The guide puts a wrapper in every `page.tsx`; with about sixty pages, a keyed wrapper in the layout does it once.) A change of query only (a customer's tabs) does not change the path, so nothing animates.
- **Direction is worked out, not hand-labelled:** `navDirection(from, to)` (`lib/nav-direction.ts`) says "forward" when the link's target is under the current path, "back" when it is a parent of it, and nothing otherwise. `AppLink` (`components/app-link.tsx`) is `next/link` with that rule applied through Link's `transitionTypes`; the app's links use it (not the tab bar, whose links are peers). `PageHeader`'s back and close controls therefore slide back with no further change.
- The motion is CSS in `globals.css` (short, ease-out; the root snapshot does not animate, so the tab bar stays put; `prefers-reduced-motion` turns it all off).

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Going to another page | `next/link` and `router.push` | `AppLink` wraps `Link` (a thin wrapper, same props); `router.push`/`replace` in code get the direction from the same function through `useAppRouter` (`components/use-app-router.ts`), so a Cancel that returns to the list slides back (added 2026-10-31 after the founder noticed cancelling a new quote did not) |
| A way back | `PageHeader` back and close (docs/adr/0009-back-navigation.md) | As is: it now slides back |
| Waiting for a page | `loading.tsx` skeletons (docs/adr/0002-performance.md) | As is |

Inputs by kind: none.

## Decisions (with a recommendation)
1. **Short and quiet: about 200 ms, 40 px.** The guide's example is 400 ms and 60 px, which feels like a demo. *Recommended* for an app used all day.
2. **Tabs fade, they do not slide.** Peers are not "deeper". The tab bar's own links use plain `Link`.
3. **Browser back fades.** It carries no type; a direction guessed from history would be wrong as often as right.
4. **Not in this slice:** shared-element morphs (a row's photo into the page's photo) and a Suspense reveal for skeleton-to-content; both could follow.

## Tests
- Unit: `navDirection` (deeper, back, same page, peers, query and hash ignored, trailing slashes, `/app` as the root).
- Browser (`e2e/route-transitions.spec.ts`): a row to its page and the chevron back each run a view transition with the right type; a tab change runs one with none; with reduced motion none runs; the new page is usable at once. The existing browser suite and the accessibility walk must stay green (they are the check that nothing waits on, or is blocked by, an animation).
- By eye on a phone before release (the part tests cannot judge: that it feels right).

## Revised the same day, after the founder's phone recording (2026-10-31)
"Transitions aren't looking good." The recording (a dark-mode phone on the hosted dev app, where a page takes about half a second to arrive) showed: the old page fading and shifting while the next page's loading skeleton faded in over it, two see-through layers on a dark background that looked muddy; a tab change fading a skeleton over the old page the same way; and the skeleton then popping to the real content. What changed:
- **Pages are opaque while they move** (the wrapper has the page background), so two pages are never seen through each other.
- **A phone's own push and pop** instead of a fade-and-nudge: the new page slides in over the old, which moves under it and dims; coming back, the page slides away and the one beneath returns. Decelerating, about 340 ms. The tab bar stays above both.
- **Tabs do not animate**, as on a phone's own tab bar.
- Checked frame by frame with the server slowed to about 600 ms (the phone's wait), in dark mode, before and after.
- Still as it was: the skeleton is replaced by the real page without an animation of its own (a cross-fade there would also run on every in-page update). A page-shaped skeleton for each route, and a reveal of the content, could follow.
