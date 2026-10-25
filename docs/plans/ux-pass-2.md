# Plan: UX pass 2 (the second review's fixes)

Status: **in progress 2026-10-25.** From the founder (2026-10-25, on `docs/ux-review-2026-10-25.md`): "Fix all these". Five pull requests, in the review's order. No database change in any of them.

## Prototype read
No prototype counterpart for A to D: they make MakerFlow's own screens consistent with each other (button weight, sheet endings, form order and words, Home, labels). For E, the prototype's settings screen was read in full on 2026-10-24 (`Profile.tsx`, 385 lines; see `docs/plans/ux-settings-and-cancel.md`): one long "My Profile" form with a single save, holding the business's facts and bank details, and no pricing preferences.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| One profile screen, one Save for everything on it | **Changed:** the Business profile is split by tabs (Details, Logo, Bank details), each tab one form with one Save | Our forms save different things with different rights (bank details are owner-only) |
| No pricing preferences on the profile | **Kept:** *What your time is worth* and *The margin you aim for* move out of the Business profile to Products (`/app/products/settings`), where they are used | CLAUDE.md: the Business profile holds facts about the business |

Missed from the prototype: nothing found.

## The five pull requests
**A. One filled button, actions by status, sheets end the same way** (review N1, N2, N4)
- Once a document is sent or issued, Share / Download PDF is an outlined button; the filled one is the next step.
- A sent quote: the answer card first, then Share and Revise; no *Quote again* until the quote is answered or withdrawn. An accepted quote: the job, then the invoice, then *Change the answer* and *Quote again* together, outlined, without a sentence under each.
- An invoice with a deposit asked: *Record the deposit* is filled and *Record a payment* outlined.
- Every sheet ends with its verb and an outlined **Cancel** (*Keep …* only where the confirm button destroys something): the answer sheets, Record a payment (*Record payment*), Create invoice, Issue a credit note, Add a material, Issue this invoice (was *Keep editing*).

**B. One form order and one set of words** (N3)
- New quote, new invoice and new job ask in one order: Customer, Items, Dates and delivery, Money (discount, deposit), Wording (intro, terms, how to pay, notes, sign-off).
- One word per thing: *Items*; *Dates*; *date* (*Due date*, *Date paid*, *Date they told you*, *Credit note date*); *Sign-off*; *Delivery (you deliver, with a fee)* everywhere a fee can be added.
- The Totals card at the end of the quote and invoice forms goes (the pinned bar is the total); the bar's button says *Save*.

**C. Home: what needs attention, money first, no zeros** (N7)
- Home shows, in order, money owed (overdue first), quotes waiting for an answer, jobs late or due this week; a count of zero is left out; with nothing to act on, one line ("You're all caught up") and New quote.
- A customer's page leaves out zero counts the same way.

**D. Private, the optional-things leftovers, list headers, Quotes search, prompt cards** (N5, N6, N8, N9)
- One *Private* tag (read out as "never shown to your customer") on every private field or section; no sentence.
- The item discount becomes *+ Add a discount* with Remove; *Unit* is not asked on a product line (it has the product's); a job item's stepper loses the *All made* tick (the stepper has a "make all" step); *Add steps* gets the plus; the customer form shows Address, Delivery and Notes as three add buttons.
- List headers: *New* for documents, *Add* for records, always with the plus; a search on Quotes.
- The job's invoice card: *Invoice this job?*, buttons never underlined inside cards, *Create invoice* opens its sheet on the quote as before but the card says where it goes; every prompt offers *Not now* and *Don't ask me again*.

**E. Long pages and coming soon at the end** (T5, T7 and the leftovers)
- Business profile: tabs *Details | Logo | Bank details*; each with one full-width *Save*. *What you make* sits in Details. The pricing preferences move to Products › Product settings (`/app/products/settings`), one form with one Save.
- Quote settings: tabs *Wording | Starting values | Numbers*, with Terms and Themes as two links at the top; every Save full width and named *Save*. Starting values keeps three short forms (deposit, discount, delivery or collection), each saving its own thing: they were built as separate usuals that the quote form also saves one by one (*Save as my usual*), so one Save for the three would mean a second way to save them.
- Coming-soon cards inside forms move to one quiet "Coming later" group at the end of the screen.
- *What you make* is asked in one place (the Terms page links to it instead of asking again).
- The filter bar shows that it scrolls (a fade at the edge) and starts at the first chip.

## Interactions reused
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Tabs on a long page | `SectionTabs` (customer page) | As is |
| Optional section | `Section` with `onRemove`, `AddButton` | As is |
| Sheet with a way out | The Mark as sent sheet (confirm, then Cancel) | The same ending everywhere |
| Counts on Home | Home's tiles | As is |
| A search on a list | The Jobs list search | As is |

Inputs by kind: none new.

## Tests
Each pull request: the browser specs that click the renamed buttons, a new spec for the rule it adds (one filled button, form order, Home attention, list headers, tabs), accessibility cases for changed screens, unit tests unchanged or extended.
