# How to write a plan

Every feature larger than a small fix gets a plan in this folder before any code (CLAUDE.md, "Working style"). A plan is short. It is for the founder to answer questions and for a fresh session to pick up where the last one stopped.

## Sections

1. **Status** and the founder's priority it serves (one line each).
2. **Where things stand**: what already exists that this builds on.
3. **Prototype read** (required, see below), before anything is decided.
4. **What the maker sees**: the screens and the steps, in plain words.
5. **Interactions reused and new interactions** (required, see below).
6. **Decisions** to confirm, each with a recommendation.
7. **Data** (sketch), including tenancy, row-level security and what is frozen.
8. **Slices** in the order they will be built, each ending in something usable.
9. **Tests** at each layer (SQL, unit, browser, accessibility).
10. **Questions for the founder** and **Not planned yet**.

## Prototype read

Why this section exists: Jobs slice 1 was planned from a one-line summary of the prototype's Jobs screen, which `docs/prototype-discovery.md` itself marked *unverified*. The founder had to ask whether the prototype had been reviewed. It had not, and reading it showed a feature the plan never mentioned (counting what is made, item by item, with the job moving along by itself), which became Jobs slice 2. A plan that listed the prototype's behaviours would have shown the gap before anything was built.

For a feature the prototype also has (check `prototype/src/components/`, the state functions in `hooks/useAppState.ts` and `types.ts`):

1. **Read it in full, not by grep or summary.** List what was read, with the files and what was skipped. If the coverage table in `docs/prototype-discovery.md` marks it unverified or skimmed, do the read first and update the table.
2. **List every behaviour** in a table, and say what MakerFlow does with it:

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |

Cover each of these, because they are where gaps hide: every state or status and what moves between them; every action on a list row and on the detail screen; what happens **by itself** (automatic moves, defaults, derived values); what it does to **other data** (stock, costs, invoices, notifications); every way to **create** one (from another record, directly, other types); what it can **delete**; the settings it reads; empty and edge cases.
3. **Show the table to the founder** in the summary, as with "Interactions reused", so a dropped behaviour is a decision and not an accident.
4. **A feature with no prototype counterpart** has one line: "No prototype counterpart." (The test reads this section.)
5. **When a behaviour turns up later** that the table did not list, add it under "Missed from the prototype" in the plan, with what it cost, so the next plan reads the code more carefully.

Plans written before 2026-10-13 are exempt from the test. Their prototype reads, where they exist, are in the plan or in `docs/prototype-discovery.md`.

## Interactions reused and new interactions

Why this section exists: jobs without a quote were first built with a hand-made list of typed item fields, although a quote already has a complete way to add an item (pick a product or service, its variation and choices, or a one-off item). The founder had to ask for it to follow the quote's process, and the shared item sheet then needed a mode instead of a copy. A plan that had listed "adding an item" would have caught this on paper.

For every thing the screen asks for or shows, say which existing interaction it uses. A thing is "the same" when it has the same name in the maker's head: an item, a customer, an address, a date, a product, a note, a photo.

| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Add an item | Item sheet (`app/src/app/app/quotes/line-sheet.tsx`) | With a `job` mode: no prices |
| Choose a customer | Customer picker (`quotes/customer-picker.tsx`) | As is, with a `subject` word |

- **Find first.** Search the code for the noun (`rg -i item`, `rg -i customer`) and the screens that already ask for it. Do not rely on memory of the layout.
- **Reuse by default.** If the existing component is tied to the first place it was used (prices, quote wording), give it a mode or lift the shared part out. Do not copy it.
- **A new interaction needs a reason**, written here: what the existing one cannot do, and what it would take to make it do so. "It was quicker" is not a reason: CLAUDE.md says a thin slice keeps the full feature's interaction and never uses a stand-in to be replaced later.
- Mention the table in the plan's summary to the founder, so a missed reuse is seen before building starts.
