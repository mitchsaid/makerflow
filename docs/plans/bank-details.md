# Plan: structured bank details (Business profile; reused on quotes and invoices)

Status: **decisions confirmed by the founder 2026-10-05; built, in review.** Touches the database (a new table, a new quote column, a replaced function), so it needs human review. Replaces the free-text "How to pay" as the place for bank details; the free text stays for other ways to pay.

## Decisions (founder, 2026-10-05, all the recommended options)
1. **Fields that follow the country.** The field list, its checks and its labels come from the country's locale pack (South Africa: account holder, bank, account type, account number, branch code), plus an option to ask customers to use the document number as their payment reference. Another country gets its own fields.
2. **One account now.** One set of details per business. SnapScan, PayShap and "pay on collection" stay in free text. The table can hold more accounts later without redoing this.
3. **On quotes: on by default, with a switch per quote.** A quote shows a "How to pay" block with the bank details when they are saved; a switch on the quote leaves them off. The free-text "How to pay" (renamed "Other ways to pay") prints under the bank block.
4. **Owners only can change them.** Changing where customers send money is how invoice fraud happens. Members can read them (documents show them); admins and staff cannot change them. A sent quote keeps the details it showed.

## What the maker can do
- **Business profile > Bank details** (owner edits; everyone else sees them read-only): one field per item the country needs, each checked with a message that says how to fix it (account and branch numbers: digits only, branch code 6 digits for South Africa), the "use the document number as the payment reference" tick, and "last changed" under it. A short note says that changing them affects new documents only.
- **On a quote:** a "Bank details" part shows what will print (bank, holder, account ending 6789) with a switch to include them (on by default). With none saved, an owner can add them in a sheet over the quote (nothing typed is lost); others are told to ask the owner.
- **On the document:** under "How to pay", one line per field ("Bank: FNB", "Account number: 62 123 456 789"…) and "Reference: QT-0042" when that is ticked, then the other ways to pay. Frozen in the snapshot, so sent versions never change when the details do.
- **Invoices (later)** use the same record and the same lines.

## Data
- New table `business_bank_details`: one row per business (unique), the country, the fields as a small object (`details`, up to 10 short text values, checked by the app against the locale pack), `use_reference`, timestamps. Members read; **owners only** write; no delete; row-level security and `session_required`.
- `quotes.show_bank_details` (default true), carried by `save_quote_draft`.
- Loaded with the workspace in the same query, so no page gets slower.

## Not built
More than one account, structured details for other countries (their packs), suggestions of branch codes (not verified against a source, and a wrong code sends money to the wrong place), a re-authentication step before changing the details (listed in `docs/security-notes.md`), and a change history.
