# Plan: Home polish, and a better demo

Status: **planned 2026-11-03; Home part (PR 1) built the same day; the demo part (PR 2) follows.** Founder, 2026-11-03, looking at Home on their phone: "improve the 'home' experience: uneven tile heights on quotes; jobs doesn't show you a rollup of in progress jobs; no icons; on 'your money', it's unclear if 'owing' means money owed to you or by you; show business logo in header if it exists. Then, on demos: add images for products; make the home views more populated; show a better loader when the demos are being loaded."

## Where things stand
- Home (`app/src/app/app/(home)/page.tsx`) shows cards only for what needs the maker: money (overdue, owing, paid this month), quotes (waiting, drafts) and jobs (late, needed this week). Each count is a link tile; the jobs card shows nothing about jobs that are simply in progress.
- The business logo lives in the Business profile (`profile.logoImageId`) and is used on documents; Home never showed it. `PhotoThumb` already shows a stored picture small.
- Demos are built server-side by `lib/demo/build.ts` from `lib/demo/content.ts`; the logo is drawn with shapes (`lib/demo/logo.ts`). No product has a picture. The landing picker shows "Starting…" on the chosen button while the demo is built.

## Prototype read
No prototype counterpart. These are changes to the existing Home screen's layout and wording (its behaviours were read when Home was planned, `docs/ux-review-2026-10-25.md`, N7); nothing here adds a behaviour the prototype has.

## What the maker sees

### PR 1: Home
- **Tiles in a row are the same height** (a tile fills its grid cell, so a label that wraps over two lines no longer makes its neighbour shorter).
- **Jobs roll-up.** Beside Late and Needed this week, the jobs card now counts where the active jobs stand: **In progress**, **Ready** (ready, or out for delivery) and **Not started**. A count of nothing is left out, as before. The old "Nothing is due in the next week." line goes, because the roll-up says what is there.
- **Icons.** Each card title has a small icon in a tinted square (money, quotes, jobs), and each tile has an icon that says what it counts (overdue, owed, paid, waiting, draft, late, this week, in progress, ready, not started). Icons are decoration (`aria-hidden`); the words stay.
- **Money says whose it is.** The money card has a line, "What your customers owe you."; **Owing** becomes **Owed to you**; Overdue says "Late payments owed to you"; the link reads "See all 3 invoices owed to you".
- **The business logo** shows beside the name in the header when the business has one (nothing when it has not: no empty square, as everywhere).

### PR 2: demos (after PR 1)
- Pictures for the demo products (drawn like the logo, so a server without fonts or photos still makes them), attached when the demo is built.
- A fuller Home in each demo: more sent and draft quotes and more jobs in different states (not started, in progress, ready, late, due this week), so the roll-up has something to show.
- A better loader while a demo is built: the choice sheet changes to a friendly "Setting up your bakery" screen with what is being added, instead of a button that says "Starting…".

**Decision for the founder (money in demos).** A demo never has an *issued* invoice: issued invoices cannot be deleted, and the clean-up deletes demos (`docs/plans/demo-accounts.md`, decision 5). So the "Your money" card stays empty in a demo. Showing money would need a migration that lets the demo clean-up remove a demo's invoices; that touches the immutability rule and needs human review. Recommendation: leave it out for now.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| The logo, small | `PhotoThumb` (`components/photo-thumb.tsx`) | As is, with a rounder class; shows nothing with no logo |
| A count or amount that opens a list | The Home `MoneyLink`, `CountLink` and `DueLink` tiles | Merged into one `Tile` (they were three near-copies); gains an icon and a full-height mode |
| A card title | `CardTitle` | As is, with a small icon beside it (`SectionTitle`) |
| The roll-up numbers | `jobDueCounts` (`lib/jobs`) | Extended with notStarted, inProgress and ready |

Inputs by kind: none (Home asks for nothing).

## Slices
1. **Home** (PR 1): tiles, roll-up, icons, wording, logo.
2. **Demo** (PR 2): pictures, fuller Home, the loader.

## Tests
- Unit: the job roll-up counts (not started, in progress, ready including out for delivery, ignoring done and cancelled).
- Browser: the jobs card shows "Not started" for a new job; the money card says what it is and "Owed to you"; the accessibility walk of Home (light and dark) is unchanged and passes with the icons.

## Not planned yet
Tiles for credit notes or statements on Home; a per-status jobs filter (the roll-up tiles open the active jobs list).

## Missed from the prototype
(none; no counterpart)
