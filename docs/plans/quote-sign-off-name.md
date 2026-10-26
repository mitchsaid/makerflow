# Who signs a quote: the business, the owner, or no name

## Status
Planned and built in one slice, 2026-10-25. Founder: "Quotes should have a configurable sign off - business name, business owner name or none" (after "makers want quotes signed off with their name rather than the business name").

## Where things stand
- A quote has a sign-off message (`quotes.sign_off`, a usual in Quote settings › Wording). The document prints it at the end with the **business name** under it, and prints nothing there when there is no message (`quote-document-view.tsx`, `lib/quotes/pdf`).
- There is no name of a person anywhere a maker can set. `profiles.display_name` exists (filled from Google's name at sign-up) but nothing asks for it or shows it.
- Sent versions keep a snapshot of everything they print (`lib/quotes/snapshot.ts`); an old snapshot must keep printing as it did.

## Prototype read
No prototype counterpart. (The prototype's `Profile.tsx` has the business name, logo, bank and tax; no person's name or sign-off choice. Read 2026-10-24 for UX pass 2.)

## What the maker sees
- **Business profile › Details › Your business:** *Business name*, then *Owner's name (optional)*, "For signing quotes, if you choose to."
- **Quote settings › Wording › Sign-off:** under the message, *Sign with*: **The business name** (Sweet Co) / **The owner's name** (Thandi Nkosi) / **No name**. New quotes start with it.
- **The quote form › Sign-off:** the same *Sign with* choice, starting from the usual; the quote can change it.
- **The document:** the message, then the chosen name in bold. *No name* prints the message alone. The owner's name prints even without a message (a signature); the business name still needs a message (it is already at the top).
- If the owner's name is chosen but none is saved, the choice says so with a link to the Business profile, and sending is held with the same words until it is added or another choice is made.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Owner's name (text) | `TextField` in the Business profile form | As is |
| Sign with (a choice of three) | `SelectField` / `NativeSelect`, like *Delivery or collection* in Quote settings | As is |
| A usual a quote starts with | The quote usuals (`lib/quotes/usuals.ts`) | As is: one more usual |
| What stops sending | `sendProblems` (`lib/quotes/send-checks.ts`) | One more problem |

Inputs by kind: one text (a person's name), one choice. No address, quantity, date or money.

## Decisions
1. **Where the owner's name lives:** the Business profile (a fact about the business, CLAUDE.md), not Settings. Employees' own names (Settings, `profiles.display_name`) come with the employees layer; then *Sign with* can gain "The person who sends it".
2. **Default:** *The business name* for every business and quote, so nothing changes until the maker chooses.
3. **Invoices** keep printing the business name for now (an invoice made from a quote takes its message, not its choice): later, with invoice wording under Invoices.

## Data
- `business_profiles.owner_name text` (1–120 characters, trimmed, optional), column grant to update.
- `business_profiles.sign_off_as text not null default 'business'` and `quotes.sign_off_as text not null default 'business'`, both `check (in ('business', 'owner', 'none'))`, column grants; `save_quote_draft` carries `sign_off_as` (a payload without it keeps the draft's). No new table; the existing RLS and `session_required` policies cover the columns.
- Frozen: the snapshot gains `signOffName` (the name printed, or null for none), worked out when the quote is previewed or sent. A snapshot without it prints the business name, as before.
- **Needs human review:** the migration (columns, grants, `save_quote_draft`).

## Slices
One slice: the migration, the Business profile field, the usual, the quote's choice, the snapshot, the document and PDF, the send check.

## Tests
- SQL: the columns' checks; a member of another business cannot read or change them (`app/supabase/tests/`).
- Unit: the snapshot's name for each choice and for an old snapshot; the send check; the usual.
- Browser: set the owner's name, choose it as the usual, a new quote starts with it, the preview prints it, *No name* prints the message alone, a sent quote keeps the name after it changes; the send hold without a name. Accessibility case for Quote settings › Wording and the Business profile.

## Another name (founder, 2026-10-26)
"Add 'other' (with text field) as an option for sign off." *Sign with* gains **Another name**, with *Name to sign with* under it (a studio name, "The Nkosi family"), in Quote settings › Wording and on each quote. The name is required with that choice (the error says so at the field) and dropped with any other. Data: `sign_off_as` gains `'other'`; `sign_off_other` on `business_profiles` and `quotes` (1–120 characters), never empty with that choice; `save_quote_draft` carries it with the choice. Migration `20261121100000_sign_off_other.sql` (needs human review).

## Questions for the founder
None open.

## Not planned yet
Employees' own names and "the person who sends it"; the same choice on invoices.

## Missed from the prototype
Nothing found.
