# Plan: the customer page in sections

Status: **planned and built 2026-10-22** (see "Built" at the end), after the founder asked "when viewing a customer, should we have the page divided into sections for details, quotes, invoices etc?" and said yes. One slice. **No database change.**

Today a customer's page is the edit form, a Statement link and Archive. A maker who opens a customer usually wants to know what they owe and what work is open, not to edit a phone number.

## Where things stand
- The customer form (`customers/customer-form.tsx`), the Statement page, Archive; the quotes, jobs and invoices lists and their rows; the Products switch (Products, Services, Materials), which is the app's way of splitting one area into a few views.
- Quotes, jobs and invoices all carry the customer's id (composite foreign keys with the organisation).

## Prototype read
Read in full on 2026-10-22: `prototype/src/components/Customers.tsx` (all 1057 lines: list, add or edit form, detail screen). The statement modal was read in full on 2026-10-19 (`customer-statements.md`).

| The prototype does | MakerFlow | Why |
| --- | --- | --- |
| List of customer cards, search, count badges ("2 quotes, 3 invoices"), a Statement shortcut on each card | List and search **kept** (already built). Counts and the Statement shortcut on the list: **later** | The page this plan builds shows them; a list of cards with counts needs a second query per customer or a view |
| Detail screen header: name, a "Business" badge, ID, CIPC and VAT numbers, three count boxes (quotes, invoices, credits) | **Changed:** name, a "Business" tag, and a summary of what matters: what they owe, open quotes, jobs in progress. The numbers stay in the Details form (VAT and company number are already fields). The customer ID is not shown (it means nothing to a maker) | Counts of everything say little; what is owing and what is open drive the next move |
| Contact cards (contact person, email, phone, billing and shipping address) each with a copy button | **Changed:** phone and email are tap-to-call and tap-to-email links under the name; the full contact details and addresses are in Details (the form). Copy buttons: **later** | A phone does the right thing when a number is tapped; a copy button is a desktop habit. The address block is the form the maker edits |
| Notes box that saves as you type | **Kept as is in MakerFlow's form** (notes are a field in Details, saved with Save). Auto-save: **dropped** | The app saves with a visible Save everywhere (ADR 0005); a half-typed note must not save by itself |
| Three ledgers side by side: quotes, invoices, tax credit notes (each row opens the document; a credit row opens the statement) | **Changed:** sections Quotes, Jobs, Invoices. Credit notes are not a section: each shows on its invoice and in the statement. Rows open the document | Credit notes belong to an invoice; a maker looks for them there. Jobs are new (the prototype's customer screen has none) |
| Generate Statement | **Kept** (built 2026-10-19): in the summary | |
| Edit Customer | **Kept:** the Details section is the form | |
| Delete a customer ("history will be unlinked") | **Dropped, as before:** customers are archived, never deleted, because documents refer to them | Issued documents keep the customer's details; deleting would break the record |
| Starting a quote for the customer from here | **Not in the prototype; added:** "New quote" and "New job" in their sections, with the customer already chosen | The obvious next step from a customer |

Missed from the prototype: nothing found after the read.

## What the maker sees
- **Top:** the customer's name, a "Business" tag for a business, their phone and email as links, then a summary card: **Owing** (money, a link to their invoices; "Nothing owing" when settled), **Statement of account**, **Quotes open** (drafts and sent, not answered), **Jobs in progress**.
- **A switch** (the same control as Products, Services, Materials): **Quotes · Jobs · Invoices · Details**. It opens on **Quotes**; the choice is in the address (`?section=`), so back works and a section can be bookmarked.
- **Quotes, Jobs, Invoices:** that customer's rows, the same rows as the lists (with the customer's name left out, since it is their page), newest first; an empty state (a title and one line) with the action that starts one (New quote, New job; Invoices come from an accepted quote, so a link to Quotes).
- **Details:** today's form and Archive, unchanged. Saving stays on the Details section.
- A new quote or job started from here has the customer chosen already.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A switch between views of one area | `ProductsSwitch` (`products/products-switch.tsx`) | Lifted into a shared `SectionSwitch` (a list of links, the active one marked); `ProductsSwitch` now uses it, no change to how it looks |
| A quote, job or invoice row | Rows inline in the Quotes page, `JobList` and `InvoiceList` | Lifted into `QuoteRow`, `JobRow`, `InvoiceRow`, with `hideCustomer`; the lists use them too, so a row can never differ between a list and a customer's page |
| Quote and job status chips | `StatusChip`, `JobStatusChip`, `InvoiceStatusChip` | As is |
| Money, dates | `formatMoney`, `formatDay` | As is |
| The edit form, Archive | `CustomerForm`, `ArchiveButton` | As is |
| Start a quote or a job | `AddLink` | As is |
| Pre-choosing the customer | The quote builder's and New job form's own customer picker | A `?customer=` address value sets the picker's starting value (checked against the business's customers); no new control |

Inputs by kind: none new (the form is unchanged).

## Decisions
1. **Sections as links, not tabs that switch on the page.** All sections come from one query (the customer with its quotes, jobs and invoices embedded), so a section change is a light server render and the page stays one query (ADR 0002). *Recommended.*
2. **It opens on Quotes**, the start of a maker's workflow, and the summary shows what is owing on every section. *Recommended; the alternative is opening on Details, which is what it does today.*
3. **No credit notes section**: they show on their invoice and in the statement.
4. **Jobs in the summary** are those not done and not cancelled.

## Data
Nothing new. One read: the customer's row with `quotes`, `jobs` and `invoices` embedded (invoices with their payments and credit notes, to work out what is owing), each limited to the latest 200, under the person's own row-level security. The page keeps the business's own rows (`organisation_id`), as every page does.

## Slice
One: the switch, the rows lifted out, the sections, the summary, the pre-chosen customer, tests.

## Tests
Unit: `ownedBy` figures (owing across invoices with payments and credit notes, open quotes, jobs in progress). Browser: a customer with a quote, a job and an invoice: the summary figures, each section lists its row and opens the document, the empty states, Details still saves and archives, New quote from here has the customer chosen. Accessibility: the page in each section and one empty. The existing customer browser tests that edit a customer now go through Details.

## Questions for the founder
None blocking. Counts and a Statement shortcut on the customers list are not planned yet.

## Not planned yet
Copy buttons, counts on the list, a combined activity timeline across quotes, jobs and invoices.

## Built
2026-10-22, one slice, no database change.
- **Page:** `/app/customers/[id]` has a summary (what they owe, quotes waiting for an answer, jobs in progress, the Statement link), phone and email as tap links, a "Business" tag, and the switch **Quotes · Jobs · Invoices · Details** (`?section=`; opens on Quotes). Details is the form and Archive, unchanged.
- **One query:** `lib/customers/page-data.ts` reads the customer with its quotes, jobs and invoices embedded (each the latest 200); the figures are `lib/customers/overview.ts`, unit-tested.
- **Reuse:** `SectionSwitch` lifted out of the Products switch; `QuoteRow`, `InvoiceRow`, `JobRow` lifted out of the three lists, so a row is the same everywhere (with `hideCustomer` on this page).
- **Started from here:** New quote and New job open with this customer chosen (`?customer=`, checked against the business's own, not archived, customers).
- **Tests:** unit (`customers/__tests__/overview.test.ts`), `e2e/customer-page.spec.ts`, an accessibility case; the customer tests that edit now go through Details.
