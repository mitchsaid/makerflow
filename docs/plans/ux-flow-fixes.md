# Plan: flow fixes (Home says what to do, the accepted quote has one next step)

Status: **built 2026-10-24** (UX pass, pull request 5; the founder said "fix issues 1-4 … and whatever else you deem high priority", 2026-10-24; these are items T6.1 to T6.3 in `docs/ux-review-2026-10-24.md`). **No database change;** one light extra read on Home (each quote's status).

## Prototype read
Read in full 2026-10-24: `Dashboard.tsx` (all 583 lines: the header and its "Create New" menu, the three money cards, Recent Quotes with its empty state, the quick links, the reset and sample-data dialogs); for the accepted quote and the invoice's totals, the quote and invoice detail screens in `Quotes.tsx` and `Invoices.tsx` were searched (they show actions in one row of buttons and the totals once).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A **"Create New" menu** (quote, invoice, job, product) at the top of the dashboard | **Not now:** each list has its own add button; Home gets the one thing a new business needs | Menus hide the first step; the founder's note on Home |
| An empty dashboard says "No quotes generated yet." with **"Create Your First Quote"** | **Kept:** a new business sees "Make your first quote" with a New quote button first | The same idea, at the top of Home |
| **Recent Quotes** table with status, and a link to all quotes | **Changed:** counts instead of a table: quotes waiting for an answer and drafts, each opening the Quotes list at that filter | A phone has no room for a table; the counts say what needs a nudge |
| Three money cards: collected, outstanding, overdue | **Kept as before** (owing and overdue already on Home); "collected" is **later** | Not part of this slice |
| Quick links to Catalogue and Customers; sample data and reset dialogs | **Later / dropped:** the tab bar and More already reach them; no sample data or reset in product code (CLAUDE.md) | |
| Accepted quote actions: buttons in one row | **Changed:** the next step is the one filled button; the corrections are quiet | The founder's review: three primary actions of different weight |
| Invoice totals once | **Kept:** the Payments card no longer repeats "Owing" | The review, T6.3 |

Missed from the prototype: nothing found.

## What the maker sees
- **Home, a new business:** first card "Make your first quote" with **New quote**; the jobs card below it has its **New job** as the quieter button.
- **Home, with quotes:** a **Your quotes** card: *Waiting for an answer* and *Drafts* as counts that open the Quotes list at that chip, and **New quote**.
- **An accepted quote** reads top to bottom: **Create a job** (filled) then **Create invoice** (outlined); once there is a job, **Create invoice** becomes the filled one. *Change the answer* and *Quote again* come last and are quiet.
- **An invoice's Payments card** shows what was paid; what is owing is said once, at the top.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Counts that open a list | Home's Late / Needed this week tiles | The same tile |
| A first-run card with one action | The empty-state card | As is |
| Quiet and filled buttons | The button hierarchy (docs/adr/0003) | As is |

Inputs by kind: none new.
