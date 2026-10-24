# Plan: tabs on the product form

Status: **planned 2026-10-24; reviewed with the founder the same day (third tab named "Inputs", bar pinned, the sheet over a quote gets no tabs); awaiting the final go.** From the founder (2026-10-24): "I feel like products also needs a top tab bar for core details, production process and inputs, so it isn't so long?" One slice, **no database change**, one pull request.

## Where things stand
- The product (and service) form is one long scroll: Basics, Variations, Price (with the quantity prices), Extras, Production steps, What it costs to make, then the "coming soon" sections (Stock). The same form opens in a sheet over a quote ("add a product" from the item sheet).
- It is one form with one Save. The rows of variations, extras, steps and costs are kept in the form's own state and sent as hidden fields (`steps`, `options`, `extras`, `variations`, `costLines`, ...).
- A problem found on Save is listed in a summary above the Save button (`FormSummary`); each line jumps to its field (`focusField`, which finds the field by its id).
- The app already has one tab list: the theme studio's part tabs (`documents/themes/theme-studio.tsx`: `role="tablist"`, roving focus, arrow keys, Home and End).

## Prototype read
Read in full 2026-10-24: the product editor in `Products.tsx`: the edit form's tab state and header (lines 295, 1022 to 1100), the three tab bodies (1096 to 2142, 2143 to 2871, 2872 to 3150) for what each holds, and the action buttons (3133 to 3160). The field-by-field behaviour inside each tab was read for the earlier product, steps and costing plans (`product-choices.md`, `production-steps.md`, `costing-and-margin.md`); this slice changes only how they are grouped.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| The edit form has **three tabs**: **Core Details**, **Production Process**, **Inputs & Costs** (`editFormTab`: `details`, `stages`, `costs`); opening the form always starts on Core Details | **Kept:** three tabs in the same order, starting on the first. Plainer words: **Details**, **Production**, **Inputs** (a service: **Details**, **Steps**, **Inputs**; the founder chose "Inputs", 2026-10-24) | The founder's own three; short labels (principle 10) |
| Core Details holds name, description, photo, group, price, stock, **variations**, **extras**, active flag | **Kept for what exists:** Basics, Variations, Price (with quantity prices) and Extras are in Details. The "Stock" placeholder stays at the bottom of Details. Group and Active are not built | The customer-facing thing in one place; thin slices keep the placeholder visible |
| Production Process holds the stages, with their rules, and "Quick add existing stages" | **Kept:** the steps (and the steps that depend on a choice) are the Production tab. Reusing stages across products is **later** | Existing steps section as is |
| Inputs & Costs holds the input lines and the base cost, price and profit summary | **Kept:** What it costs to make, with its summary, is the Inputs tab | Existing costs section as is |
| **Count badges** on Production Process (the number of stages, when tracked as stages) and Inputs & Costs (the number of inputs) | **Kept:** a count on Production (steps, when tracked as steps) and Inputs (cost lines) | Shows what is inside without opening it |
| One form, one **Add / Update** button and a Cancel below all the tabs; only the open tab is rendered | **Changed:** one Save below the tabs, as the prototype; **but every tab stays in the page** (the closed ones hidden), so nothing typed is lost and every field is always sent with the form | A form that drops closed tabs from the page can lose data and cannot check the fields it hides |
| The prototype has no problem summary: a missing required field on a tab that is not open fails without a word | **Changed:** problems are marked on their tab and the summary opens the tab that holds the first one | CLAUDE.md forms rule: problems at the fields and in a summary that jumps to the first |

Missed from the prototype: nothing found.

## What the maker sees
- At the top of the form, a **tab bar** of three: **Details | Production | Inputs**. It stays pinned at the top while the tab's contents scroll, so switching never means scrolling back up. On a phone the three fit on one row.
- The Save button, its "Saved." line and the problems summary sit **below** the tabs and belong to all of them.
- **Production** and **Costs** show a small count when there is something in them: "Production 3" (steps, when tracked as steps), "Inputs 4" (cost lines).
- **A tab with a problem** says so in words, not only in colour: "Inputs, 2 to fix". Pressing Save with a problem on a tab that is not open opens that tab at the first problem (the summary line does the same), and the field takes focus.
- The form opens on **Details**. Moving between tabs loses nothing; the choice is not kept in the address (it is a view of one unsaved form), and a new product starts on Details.
- **The sheet over a quote has no tabs and no Production or Inputs.** It is for quoting, so it shows only what a quote needs (the Details content: Basics, Variations, Price, Extras). It already leaves out the costs section today (the form is given no costing there) and only shows a "coming soon" card for it; this slice swaps that card, the Stock card and the steps section for one line: "Add the steps and what it costs to make later, under Products." What a product already has (its steps, its costs) is kept when it is edited in the sheet, as costs already are.
- A service has the same three tabs; its middle tab is called **Steps**.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A tab list with arrow keys, Home and End | The theme studio's part tabs | **Lifted out into a shared `TabList` component** (the studio then uses it too), not copied; the studio's behaviour and look stay as they are |
| Showing which field a problem is on | `FormSummary` and `focusField` | A mode: when the field is inside a closed tab, the tab opens first and the field is focused after it shows |
| Problems at the fields | Existing field errors | As is |
| Sections of a form | `Section` | As is, one group of sections per tab |

Inputs by kind: none new.

## Decisions
1. **Names and grouping.** Details = Basics, Variations, Price (with quantity prices), Extras, and the Stock placeholder. Production = the steps. Inputs = what it costs to make, the margin line and the target note. Extras' own costs stay with the extra, in Details. *The founder named the third tab "Inputs".*
2. **Every tab stays in the page** (hidden when closed) so all values are sent and all errors can be found; the cost is a slightly heavier page, which is how it already is.
3. **A pinned tab bar** (founder: fine).
4. **A service has the same three tabs** (Details, Steps, Inputs).
5. **The sheet over a quote has no tabs** (founder asked whether it needs production and inputs; it does not: it exists to get an item onto the quote). Its form shows the Details content only, with the one line pointing to Products for the rest. A product edited there keeps its steps and costs untouched.
6. **The open tab is not in the address**, because it is a view of one unsaved form, and a reload loses the form anyway.
7. **Steps and costs both depend on the variations** (steps per choice, costs per size). Each section already says which choices it uses; the tabs add nothing to that.

## Build (small steps, one pull request)
1. Lift the theme studio's tab list into `components/tab-list.tsx` (a `TabList` and a panel helper; ARIA tabs, roving focus, arrow keys, Home and End, 44 px targets); the studio uses it.
2. `product-form.tsx`: group the sections into three panels, keep all mounted, pin the bar, add counts and problem markers (the marker counts come from the error groups the form already builds: steps errors to Production, cost errors to Inputs, the rest to Details).
3. `FormSummary`/`focusField`: open a closed tab before focusing, and open the tab with the first problem when a Save comes back with problems.
4. Tests: a unit test for which tab a problem belongs to; a browser test (open each tab, a problem on a closed tab opens it and focuses the field, nothing typed is lost between tabs, counts, a service's names, the sheet over a quote has no tabs and no steps and keeps a product's steps when it is edited there); the existing product, steps, costs, variations and quote specs click the tab first (one helper); accessibility cases for the tabs, with a problem, in light and dark; the phone viewport walk; `pnpm perf` unchanged (no new query).
5. Docs: `docs/project-context.md`, `docs/ux-inputs.md` if it lists the form's layout.

## Risks
- **Many existing browser tests assume everything is on one page.** They need the tab opened first; the helper keeps that to one line each.
- **A closed tab's field cannot be focused** until it is shown; step 3 covers it, and the test checks it for each tab.
- **Colour alone must not mark a problem:** the tab says "to fix" in words.
- **Editing a product from the sheet must not lose its steps:** the steps stay in the form's hidden fields although their section is not shown; the test checks it.
