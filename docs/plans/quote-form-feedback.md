# Plan: the quote form, reuse, and the app's back navigation (founder feedback, 2026-10-15)

Status: **planned 2026-10-15; built in three slices (A, B, C), one pull request each.** Serves the founder's priority that quotes feel professional and light on a phone. Slice B changes the database (a migration, human review). Slice C touches saved terms.

The founder tried the New quote screen and sent ten observations. They are not ten fixes. They come down to a few problems, each fixed once and then applied across the app.

## The problems underneath

1. **Reuse works three different ways, and none feels light.** Terms are a library to manage. Sign-off, "other ways to pay", the deposit and delivery or collection have saved defaults, but only under Quotes and invoices, and nothing on the quote says so. Title, description and notes are per quote only. The founder: "re-use is good, but setting it up feels heavy."
2. **Optional fields are either always shown or hidden.** Needed by, discount and notes show whether or not the maker wants them.
3. **Page structure and navigation feel like a website.** A plain underlined "Quotes" link sits above 18 page headings; a tagline explains numbering; the form order does not follow the printed quote; the primary button does not say it is the next step.
4. **Errors do not clear** when the maker fixes the thing. They clear only on the next save.

## Prototype read

Read, in `prototype/src/components/Quotes.tsx`: the creation state (lines 255 to 310), loading a quote for editing (`handleEditQuote`, 690 to 725), saving (`handleActionOnQuote`, 727 to 830), the creation screen header, the dates and customer pickers (925 to 1010), the notes, sign-off and bank blocks and the step 1 footer (1735 to 1870), the start of step 2 (1870 to 1900), the quote detail's back button (2085 to 2100) and the item sheet's back button (2540 to 2570). Also the back buttons of `Customers.tsx`, `Materials.tsx`, `Jobs.tsx` and `Invoices.tsx` (by search, for the pattern only). Not read in full: the 3,600-line file's printing and template code, which this plan does not touch.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Creating a quote is two steps: 1 the details and items, with **Continue →**; 2 a preview | **Kept** (Preview is step 2). **Changed**: the button reads "Continue to preview" | The founder: make the next step clearer |
| No quote title and no description field | **Dropped** the title (hidden for now); the description stays, as a saved "usual" | The founder's decision |
| Notes ("Notes / Terms of Trade") is **pre-filled** with a fixed sentence about a 50% deposit and delivery, the sign-off pre-filled with "Thank you so much for your business!" | **Changed**: pre-filled from the business's own saved usual, never from fixed text; nothing is invented for them | Fixed text is wrong for most businesses; the founder dislikes the example |
| Notes, sign-off and bank details sit together at the end | **Kept in spirit**: notes move to just before sign-off | The founder: notes belong with the closing, not with payment and terms |
| Editable quote number, with an auto number | **Dropped** (numbers are gapless and automatic) | Decided earlier (quote numbering) |
| Issue date, expiry date with shortcuts (7, 14, 30 days) | **Kept** (already built) | |
| Customer search with add and edit inside | **Kept** (already built) | |
| X to cancel; a labelled "← Back to Quotes History" button on the detail screen; "← Back to Customers" and similar pills elsewhere | **Kept as an idea, changed in form**: a back control (a chevron with the parent's name for screen readers) at the start of the page heading, not an underlined text link | The founder: the text link feels like a website |
| Save Draft beside Continue, both disabled until a customer and an item exist | **Changed**: the buttons stay enabled and say what is missing (ADR 0005) | MakerFlow's form rule |
| Quote-level discount, tax and delivery or collection presets | **Kept** (already built) | |
| Deposit, terms library, needed-by date, description, title | **No prototype counterpart** (notes doubled as terms) | MakerFlow additions |

## Where things stand
- `business_profiles` already holds `default_sign_off`, `payment_instructions`, `default_deposit_kind`, `default_deposit_value`, `usual_fulfilment`, edited under **Quotes and invoices** (`/app/documents`), and a new quote starts from them (`quotes/new/page.tsx`). What is missing is the way **in** from the quote and a description usual.
- Terms are a library (`policies`) ticked onto a quote as copies; "just for this quote" terms and "Save a new term" are two ways to make one.
- Errors on every form come from the last save and disappear only when the next save comes back.

## What the maker sees

### Slice A: no database change
1. **Back control, everywhere.** One shared page heading component: a back control (chevron) in line with the heading, labelled for screen readers "Back to Quotes". It goes to the logical parent (never browser history, so it works in an installed app and after a deep link). It replaces the underlined text link on all 18 pages that have one. New quote has its X and no back control.
2. **Quote form.** The "It gets its number…" line is gone. The **title field is hidden** (the column, the printing of a title already on a quote, and the snapshot stay; nothing is removed from the database). The sign-off hint no longer shows an example. **Notes move to just before Sign-off**, labelled "Notes for your customer", with a hint that payment details and terms go in their own sections. The primary button reads **Continue to preview**.
3. **Needed by** is an "Add a needed-by date" link until the maker uses it (or the quote already has one). **Discount** gets the same treatment where it is always open now. The same on the New job form.
4. **Errors clear when fixed.** A shared error scope: once a field is edited, its message and its row in the summary go away at once, and the summary count drops; a new failed save brings back what is still wrong. It is built into the shared field components, so every form that uses them gets it.

### Slice B: "your usual" (migration)
- **A usual, offered where it is needed.** Description, sign-off and other ways to pay start from the business's usual. When what is on the quote differs from the usual (or none is saved), a quiet **Save as my usual** button appears under the field (owners and admins; others do not see it). One tap, no sheet, and it says "Saved as your usual". **Use my usual** puts it back. The only place to manage usuals stays **Quotes and invoices**, as plain fields, no lists.
- **Description** gets a usual (new column `default_description`).
- **Deposit** gets a fourth default, **Ask me each time**: a new quote opens with the Deposit section **open**, with no amount chosen (no deposit still sends fine). Choosing a deposit on a quote offers Save as my usual too.
- The first-quote questions offer "Ask me each time" with the others.

### Slice C: terms as create and use (like customers and products)
- The Terms section on a quote shows the chosen terms as compact rows and has one **Add a term** button. It opens a sheet listing the business's saved terms (tick, search) with **New term** inside it; a term made there is saved and ticked. **No "just for this quote" and no "Save a new term"**: every term is a saved term (the founder's call: the plain create-and-use flow).
- A ticked term can still have its wording changed for this quote only (as built).
- **The wall of examples:** the new-term form shows three or four examples for the business's type first, with the rest behind "More examples" (the same split the Terms page already uses); a business with no type set is offered the type question once.
- Terms already written "just for this quote" on existing quotes keep working and printing.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Back to the parent | The 18 underlined links | **New shared component** (`PageHeader`); replaces them |
| A field the maker may want | The Items list's `AddLink` style ("+ Add …") | Reused: `AddLink`-style disclosure button |
| Save a default from where it is used | `dismissLogoPrompt`-style quiet actions; the Business profile's save | **New small component** (`UsualButtons`), because nothing else saves from the quote itself |
| Error messages | `FormSummary`, `FieldError` (ADR 0005) | Extended with an edit scope; no new look |
| Pick customers and create inside | `quotes/customer-picker.tsx` | Slice C mirrors it for terms (a mode of the same pattern, not a copy where the code can be shared) |
| New-term form | `documents/policies/policy-form.tsx` | Reused, with its examples split by business type |

## Decisions (made with the founder)
1. Title: hidden for now (founder). 2. Deposit "ask each time" opens the section only (founder). 3. Terms are create and use (founder). 4. Usuals are managed under Quotes and invoices, not Settings (the 2026-10-06 split). 5. Quote date fields stay; the back control goes to the parent, never history.

## Data (slice B only)
- `business_profiles.default_description text` (1 to 2000 characters), update granted to the same roles as the other defaults.
- `default_deposit_kind` allows `'ask'` (value 0). A new quote starts with deposit kind "none" and the section open; the business keeps "ask".
- No new tables. `save_quote_draft` is unchanged: the quote still stores a real deposit or none.

## Tests
A: unit (error scope: edit clears message and summary row, a new failed save restores what remains), browser (back control on each kind of page goes to the parent; the quote form order; Continue to preview; needed-by link; errors clear on the quote, customer and product forms), accessibility cases. B: SQL (columns and check), unit, browser (Save as my usual, Use my usual, Ask each time, role limits). C: browser (add, create inside the sheet, examples for the business type, old own-terms still print).

## Not planned yet
Quote title back as an option; usuals for notes; a Settings page for these; invoices will reuse the same usuals.
