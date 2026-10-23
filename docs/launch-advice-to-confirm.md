# Advice to confirm before launch

Founder, 2026-10-23: the product is still a concept test, so building goes on with **my best reading of the sources** (`docs/locales/za/`), and a South African adviser confirms these things **at launch**, not now. Nothing here blocks building or testing with friendly users. This is not tax or legal advice; where an adviser disagrees, the fix is in the locale pack (`app/src/lib/locale/za.ts`) or the wording they name.

How to use this page: before real customers rely on the app, take it to **a tax adviser or accountant** (the VAT items) and **a legal adviser** (the legal items), and write the answer and the date in the last column. Say "changed" if the app had to change.

Who needs it: most makers will **not** be VAT-registered (registration is compulsory above R1 million of taxable sales a year), and the VAT items do nothing for them. They matter for the makers who are registered.

## Tax adviser or accountant (VAT)

| # | Question | What the app does today | My reading (confidence) | Needed before | Answer and date |
| --- | --- | --- | --- | --- | --- |
| V1 | **Deposits.** A "50% to start work" deposit on made-to-order work: is VAT due when it is received, and is a tax invoice needed within 21 days? Deposit invoice, or payment on account? | **One invoice, the deposit shown as a payment** (founder, 2026-10-11, pending this answer). The quote calls it "deposit (part payment of the price)". | VAT is due on receipt and a tax invoice is needed within 21 days, because it is part of the price (VAT Act s9(1), s9(3)(b); SARS VAT 404 guide 5.2.1 and 5.2.3). Medium-high. If right, **today's approach can leave a registered maker late with a tax invoice for the deposit.** Full basis: `docs/locales/za/vat-and-documents.md`. | A VAT-registered maker taking real deposits. **Parked 2026-10-23: the likely fix (a deposit tax invoice when the deposit is recorded, which the final invoice credits) is not built; the founder will make a final call before it is.** | |
| V2 | **Quoting excluding VAT** for business customers: acceptable if the document also shows the VAT-inclusive total? | Registered businesses default to prices including VAT; an "excluding VAT" entry mode exists and documents show both. | Fine if the inclusive total is always shown. Medium-high. | A registered maker quoting businesses | |
| V3 | **Zero-rated and exempt items.** Is the hint list right, and are crafts almost always standard-rated? | Hints name the usual examples; the maker picks the treatment per item; documents break totals down by treatment. | Standard-rated for nearly all crafts; basic foods zero-rated (VAT Act s11). Medium-high. | A registered maker with food or exports | |
| V4 | **Delivery.** Can delivery that is part of an export be zero-rated? | Delivery is always a standard-rated line; the maker can't change it. | Probably only for exports. Not researched further. | A registered maker who exports | |
| V5 | **VAT on costs and margins**, eight questions in `docs/plans/vat-on-costs-adviser-questions.md`. | Costs and margins are worked out without VAT for a VAT vendor. The form says the app doesn't work out what can be claimed. Margin is a private figure, never on the customer's document. | Low risk: a management figure, not a record for SARS. | Launch | |

## Legal adviser

| # | Question | What the app does today | Needed before | Answer and date |
| --- | --- | --- | --- | --- |
| L1 | **Starter terms** for each business type (`docs/locales/za/consumer-policies.md`), including who carries the risk once a courier has an order, and food transport rules (not researched). | Starters are examples the maker edits. The new-term form and the Terms page say they are prompts, not legal advice. | Launch | |
| L2 | **POPIA.** Customer data is stored in the EU: cross-border transfer conditions, and the privacy policy wording. | Data in a Supabase EU region (no South African region exists; `docs/adr/0001-stack.md`). No privacy policy page yet. | Launch | |

## Research, not an adviser (when there is time)
- How comparable tools (FreshBooks, QuickBooks and others) handle editing, voiding and the audit trail on issued invoices. It informs the lock-on-issue design and has not been checked against them. (`docs/product-brief.md`, section 7.)
- **How other tools treat a deposit** (looked at 2026-10-23, from help pages and practitioner threads, mostly UK, US and Australia, **none South African and none official tax guidance**). None of them issues a separate "deposit tax invoice" by default. **Xero** advises recording a deposit as a *prepayment* (a customer-deposit liability, with a tax rate chosen) and applying it as a credit to the final invoice, rather than as a payment on an invoice, because the latter can trigger tax too early. **QuickBooks** users do the same with a liability account and a negative line on the final invoice; its built-in invoice deposit field is reported to pull the deposit into tax early. **FreshBooks** has partial payments, or a "Deposit" item on one invoice and the same item as a negative line on the final one, and says nothing about tax. The common shape is *deposit as a credit held against the final invoice, with the tax treatment left to the accountant*. That is close to what MakerFlow does (one invoice, deposit shown as a payment). The difference to settle at V1 is whether, for a **VAT-registered** maker, that credit must also be a tax invoice within 21 days; accounting packages don't answer that for you.

## Already answered from the primary texts
Required fields on a tax invoice; credit note particulars (guide 13.8.3); records kept five years; the R5 000 abridged-invoice threshold; the 15% rate. See `docs/locales/za/vat-and-documents.md`. These still carry its "not professional advice" note.
