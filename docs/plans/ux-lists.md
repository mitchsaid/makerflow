# Plan: one way to narrow a list, one empty state, tabs that answer at once

Status: **built 2026-10-24** (UX pass, pull request 4 of 4; from the founder, 2026-10-24: "rather than buttons on quotes and invoices and jobs, maybe a filter pattern is useful? Better empty states … responsiveness when clicking tabs, seems to wait on a page load (unlike main navigation items)"). **No database change, no new query.**

## Prototype read
Read in full 2026-10-24 for these behaviours: the jobs list in `Jobs.tsx` (the search, the status dropdown, the empty states, 1690 to 1795), the quotes list filter in `Quotes.tsx` (84, 851 to 853, 2343 to 2374, 2470) and the invoices list filter in `Invoices.tsx` (86, 828 to 832, 861 to 936); `Customers.tsx` and `Products.tsx` and `Materials.tsx` by search for list and empty states.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| **Jobs:** a text search and a status **dropdown** ("All Statuses (n)", then each status); a list with no match says "No jobs match your search parameters." with a **Clear filters** link; a business with no jobs says "No jobs in queue" | **Changed:** one filter bar of chips (the same on Quotes, Jobs, Invoices), the search kept; "nothing matches" says so in a line with a **Show all** button; a business with nothing has a title, one line and one action | The founder asked for one filter pattern; chips show the counts without opening a menu |
| **Quotes:** a row of status buttons (`statusFilter`, with a "Drafts" alias) and "No quotes found. Create a new quote to get started!" | **Kept in spirit:** the same chips, now in the shared bar; the empty state is the shared one | |
| **Invoices:** a segmented control All, Unpaid, Paid, Overdue, Credited; "No invoices found" | **Kept in spirit:** the same chips plus Drafts; the "no invoices yet" line no longer shows while a draft is waiting | The screenshot the founder sent |
| Archived items: the prototype has none (it deletes) | **Changed:** the "Show archived" tick box on Customers, Products and Materials becomes a **Current / Archived** pair of chips in the same bar | One control to narrow a list |
| Tabs in the prototype are React state (a click answers at once); the profile editor's tabs and the app's tabs never wait | **Kept:** a customer's sections and Products and Services switch in the page, with the address updated | The founder's point: tabs should answer like the main navigation |

Missed from the prototype: nothing found.

## What the maker sees
- **Filter bar:** one row of chips with counts ("Sent (3)"); on a phone it scrolls sideways rather than wrapping onto several lines. Choosing one changes the list at once. Used on Quotes, Jobs, Invoices, and for Current / Archived on Customers, Products and Materials (shown only when something is archived).
- **Empty states:** a business with nothing: a title, one line, one action. A filter or search with nothing in it: one line ("Nothing is late."), and a button that shows everything again. Invoices: when only drafts exist, "No invoices issued yet. Your drafts are waiting." with **Show drafts**.
- **Tabs:** a customer's Quotes, Jobs, Invoices and Details, and Products and Services, change in the page, mark the new tab at once, and update the address; back and forward move between them; a link to `?section=jobs` still opens that section.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Chips with counts | The Jobs and Invoices chip rows | **Lifted into `FilterBar`**, not copied; Quotes' status links and the archived tick boxes now use it |
| An empty list | The cards on each list | **Lifted into `EmptyState`** and `NoMatches` |
| A switch between a few views | `SectionSwitch` | A mode: with `onSelect` it changes the view in the page; without it, a plain link |

Inputs by kind: none new.

## Decisions
1. **Every section is on the page, only the open one shown** (customer page, Products and Services), because the data is already loaded in the page's one query. The cost is a slightly heavier page, which is how the product form's tabs already work.
2. **Chips scroll sideways** instead of wrapping, so a list never starts below a block of buttons.
3. **Archived is a chip, not a tick box;** it shows only when something is archived.
