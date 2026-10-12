# How to write a plan

Every feature larger than a small fix gets a plan in this folder before any code (CLAUDE.md, "Working style"). A plan is short. It is for the founder to answer questions and for a fresh session to pick up where the last one stopped.

## Sections

1. **Status** and the founder's priority it serves (one line each).
2. **Where things stand**: what already exists that this builds on.
3. **What the maker sees**: the screens and the steps, in plain words.
4. **Interactions reused and new interactions** (required, see below).
5. **Decisions** to confirm, each with a recommendation.
6. **Data** (sketch), including tenancy, row-level security and what is frozen.
7. **Slices** in the order they will be built, each ending in something usable.
8. **Tests** at each layer (SQL, unit, browser, accessibility).
9. **Questions for the founder** and **Not planned yet**.

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
