# South Africa (ZA): VAT and documents (reference for quotes, invoices and credit notes)

> **Applies to businesses whose country is South Africa (`country_code` = `ZA`) and to no one else.** These rules are implemented in the South African locale pack, `app/src/lib/locale/za.ts`. Other countries get their own pack and their own folder under `docs/locales/`; see `docs/locales/README.md`. Do not apply anything below to another country.

Read 2026-10-02 from SARS's **VAT 404 Guide for Vendors, Issue 15**
(https://www.sars.gov.za/wp-content/uploads/Ops/Guides/Legal-Pub-Guide-VAT404-VAT-404-Guide-for-Vendors.pdf) and SARS's **Tax Invoice Checklist**
(https://www.sars.gov.za/wp-content/uploads/Docs/Government/Tax-Invoice-Checklist-Version-2-29032016.pdf). The text was extracted from the PDFs locally and read directly; section numbers below are the guide's. This is **not legal or accounting advice**: the accountant review in `docs/product-brief.md` section 7 still applies, especially where marked "to confirm".

## What the guide says

1. **Prices must include VAT** ("10 important principles", number 1, and Chapter 1): "All prices charged, advertised or quoted by a vendor must include VAT at the applicable rate (currently 15% for standard-rated supplies)." This applies to quotes.
2. **Tax invoice particulars** (13.3, VAT Act section 20):
   - *Full tax invoice* (consideration of R5 000 or more): the words "tax invoice", "VAT invoice" or "invoice"; supplier name, address and VAT registration number; **recipient** name, address and VAT registration number (the checklist says the recipient's VAT number is needed where the recipient is a vendor); serial number and date of issue; full and proper description of goods or services; **quantity or volume**; price and VAT by one of three approved methods.
   - *Abridged tax invoice* (consideration below R5 000): the same, **without the recipient's details and without the quantity**.
   - Note: the guide says "R5 000 or more" for full and the older checklist says "exceeds R5 000". Treat R5 000 and above as full.
3. **Three approved ways to show price and VAT** (13.3): (1) every amount shown (price excluding VAT, VAT charged, total including VAT); (2) total consideration only, with the VAT rate ("R570 including VAT at 15%"); (3) total consideration and the VAT amount included.
4. **Commercial invoice versus tax invoice** (13.2): an "invoice" can be any payment request; a tax invoice is for taxable supplies and must carry all prescribed details. Vendors may combine the two if the invoice meets the tax invoice requirements. Nothing in the guide treats a quotation as a tax invoice.
5. **Issue within 21 days** of the supply (the guide's chapter on invoices; also referenced under the payments basis in 4.5).
6. **Credit and debit notes** (13.8.3): the words "credit note" or "debit note"; supplier name, address and VAT number; recipient name and address (unless an abridged invoice was issued); date; the amount by which the value and the VAT changed; a brief explanation; and enough to identify the original invoice (number and date).
7. **Records are kept for at least five years** (principle 4).
8. **Time of supply and deposits** (5.2.1): the time of supply is generally the earlier of the invoice being issued or any payment of consideration being received. A "deposit" that does not form part of the consideration for the supply does not trigger it until applied as payment. **Lay-by agreements** (5.2.7) are treated specially: where the consideration is R10 000 or less and the supply is reserved by a deposit with delivery after full payment, the supply is deemed to take place on delivery and there is no VAT on the deposit until then.

## What this means for the product (proposed)

- **VAT setting.** For a VAT-registered business the default is to **enter and quote prices including VAT**, and every document shows the VAT clearly (method 1, with price excluding VAT, VAT and total including VAT, as the default layout). An "excluding VAT" entry mode may be offered for business-to-business quoting only if documents always show the VAT-inclusive total; **to confirm with the accountant** that this meets principle 1 for quotes. A business that is **not** VAT registered must show no VAT anywhere, no VAT number, and must not call anything a "tax invoice".
- **Data needed before a tax invoice can be valid:** the supplier's address and VAT number (so business details become a hard requirement at the first *invoice*, a soft ask at the first *quote*), the customer's name and address (and VAT number for business customers), a quantity on every line, and a gapless serial number.
- **Deposits (to confirm).** A deposit that is a part-payment of the price (the usual case for made-to-order work) looks like a payment of consideration, so VAT is likely due on receipt and a tax invoice is needed within 21 days. A refundable security deposit does not. The lay-by exception may or may not fit made-to-order work. This decides whether the invoice slice issues a **deposit invoice** or records a **payment on account**, which is the open question in the brief.
- **Retention.** Issued documents must be kept at least five years, which fits our "issued documents are never deleted" rule and affects account deletion.
- **Locale configuration.** The words, thresholds (R5 000), the VAT rate and the method of showing VAT all belong in `app/src/lib/locale/za.ts`, not in screens.

## Answers to the accounting questions (2026-10-02)

These are my answers, reached by reading the primary texts, not hand-offs. Each shows the basis and how confident I am. They are not professional advice, but nothing here is left as "ask someone"; if a rule changes or an accountant later disagrees, the locale configuration (`app/src/lib/locale/za.ts`) is where it is corrected.

**Sources read directly:** SARS VAT 404 Guide for Vendors Issue 15 (extracted locally); SARS Tax Invoice Checklist; VAT Act sections 9 and 65 (acts.co.za); the Consumer Protection Act 68 of 2008 and its Regulations (Gazette 34180, 1 April 2011), both as hosted by the National Consumer Commission (https://thencc.org.za/wp-content/uploads/2020/11/Consumer-Protection-Act.pdf and .../CPA-REGS.pdf, extracted locally; not checked against later amendments). **Secondary sources:** Nolands and TenderPro articles (on how quotes show VAT), a Mondaq article about a tax court decision on delivery fees (no case name given), RSM on deposits.

### 1. Can a VAT-registered maker quote prices excluding VAT, and how must it look?
**Answer: yes. Both entry modes are allowed, the default is inclusive.**
- **Basis (VAT Act section 65, read directly):** a quoted price for a taxable supply "shall include tax and the vendor shall in his advertisement or quotation state that the price includes tax, unless the total amount of the tax chargeable, the price excluding tax and the price inclusive of tax for the supply are advertised or quoted", and where both are shown they get "equal prominence and impact". Contravening it is an offence (reported penalty: a fine or up to 24 months), including through negligence.
- **Presentation we use:**
  - *Inclusive mode:* the document states "All prices include VAT at 15%" and shows the VAT included in the total (SARS method 3).
  - *Exclusive mode:* the totals block shows total excluding VAT, the VAT amount and total including VAT, the first and last at the same size and weight (SARS method 1).
  - Line amounts follow the chosen mode. **Per-line inclusive figures are not needed.** SARS's own invoice examples show lines excluding VAT with the VAT worked out underneath, and the secondary sources describe the same breakdown as compliant.
  - **VAT is calculated once per VAT rate on the total of the lines at that rate**, not line by line. SARS's example of a mixed invoice (guide, example 41) shows exactly this: "VAT @ 15% on R16 000 = 2 400". It also avoids rounding drift. In inclusive mode the VAT is the group total x 15/115. Rounding is to the nearest cent, half up, at the group total.
  - When a document mixes VAT statuses (standard-rated, zero-rated, exempt), each line shows its VAT status and the supplies are clearly distinguished (guide 13.6).
- **Not VAT registered:** no VAT lines, no VAT number, and the word "tax invoice" never appears.
- **Confidence:** high on the rule; medium-high that no per-line inclusive figure is needed (SARS examples and commentary agree; no ruling states it outright).

### 2. VAT on delivery charges
**Answer: a delivery charge is its own line, standard-rated at 15% for a VAT-registered maker, whatever the goods are rated.**
- **Basis:** the guide lists "local transport of goods (all modes of transport)" among standard-rated supplies; it requires a mixed invoice to "clearly distinguish between the various supplies and indicate separately the applicable values, and the tax charged (if any) on each" (13.6); and a reported tax court decision held a vendor's delivery fees attract VAT at the standard rate. A separate delivery line is therefore the correct presentation even if the goods are zero-rated. If a maker instead builds delivery into the goods' price ("free delivery"), there is no separate line and the goods' rating applies to the whole price.
- **Confidence:** medium-high (strong on the principle; the court decision is secondary and unnamed).

### 3. Deposits: when is VAT due, and what do we issue?
**Answer: a deposit that is part of the price is a part payment. VAT is due on it when it is received (or becomes due or is invoiced, if earlier), and the maker issues a tax invoice for the deposit amount within 21 days. The final invoice covers the whole supply, shows the deposit already invoiced and paid, and shows the balance due. We do not use an unallocated "payment on account".**
- **Basis:**
  - *Section 9(1):* the supply is deemed to take place at "the time an invoice is issued ... or the time any payment of consideration is received ... whichever time is earlier".
  - *The deposit proviso* (a deposit "whether refundable or not ... shall not be considered as payment made for the supply unless and until the supplier applies the deposit as consideration ... or such deposit is forfeited") is read by SARS (guide 5.2.1) as covering only a deposit that "does not form part of the payment due (that is, consideration payable)", that is, security-type deposits held until a later event. A maker's "50% to start work" is part of the price, so the proviso does not shelter it.
  - *Section 9(3)(b), progressive supplies* (guide 5.2.3): for goods supplied "in connection with the ... manufacture, assembly or alteration of goods where the agreement provides for the consideration to become due and payable in instalments", the time of supply is "the earliest of the date when payment is due or is received, or any invoice relating to the payment is issued". SARS's example 7 invoices each instalment separately, the second "less already invoiced". Made-to-order work with a deposit and a balance fits this pattern.
  - Vendors on the **payments basis** (natural persons and partnerships of natural persons with taxable supplies not exceeding R2,5 million) account for VAT on cash received anyway, but still issue the tax invoice within 21 days.
  - The lay-by regime (guide 5.2.7) is a narrow case (consideration up to R10 000, goods reserved by a deposit and delivered after full payment). It is **not** assumed for made-to-order work.
- **What we build:** the quote states the terms and calls it "deposit (part payment of the price)". The invoice slice issues a **deposit tax invoice** on receipt (VAT-inclusive amount x 15/115) and a **final invoice** crediting it. Non-VAT-registered makers issue a plain receipt or invoice with no VAT. A refundable security deposit (for example hiring out a cake stand) is a different thing and is not built.
- **Confidence:** medium-high. The statute and SARS's guide point one way; the alternative (VAT deferred to completion under the proviso) would only apply if the deposit were genuinely security-type.

### 4. What must a quotation contain?
**Answer: SARS prescribes nothing for a quotation. The rules that matter are VAT Act section 65 (above) and, for consumers, the Consumer Protection Act. A quote must state what it covers and until when; for repairs and alterations to the customer's own item it must carry four specific things.**
- **A quotation is not a tax invoice** (guide 13.2: a tax invoice is for a taxable supply and carries prescribed details). We title it "Quotation" and add the line "This quotation is not a tax invoice."
- **CPA section 15(4):** where a supplier has given an estimate "for any service, or goods and services, the supplier may not charge ... a price ... that exceeds the estimate, unless after providing the estimate the service provider has informed the consumer of the additional estimated charges and the consumer has authorised the work to continue." So the quote is a price cap for consumers. Every quote states its scope and **valid-until date**; a change of scope is a new version that the customer accepts.
- **CPA section 15 and the 2011 notice, for repair or maintenance of the consumer's property** (a jeweller repairing a ring, a dressmaker altering a dress), where the maker takes possession of it or the consumer asks for an estimate: no charge may be made unless an estimate was given and authorised, or the consumer declined it **in writing or another recorded manner**; the threshold is **R1 excluding VAT**, so effectively always. The estimate must specify (a) a breakdown and the total, (b) the nature and extent of the repair or maintenance, (c) the period of validity, and (d) **the period within which the consumer must collect the goods and the consequence of not doing so**. The estimate itself must be free (unless the maker disclosed a price for preparing it and the consumer approved it first).
- **What we build:** nothing specific (founder's decision: it adds complexity for very few users, so the maker is responsible for it). A search of Xero's and Zoho's quote pages found templates, expiry dates and copying quotes and no mention of this rule, so the market does not enforce it either (the products themselves were not tested). Revisit if repair-focused makers (jewellers, dressmakers) ask for it.
- **Not applicable to quotes:** the Electronic Communications and Transactions Act section 43 (physical address, registration number and more) applies to offers made on a website; section 26 of the CPA (sales record, including the address of the premises) applies to the record of a completed transaction, which is the invoice or receipt.
- **Confidence:** high on the text (read directly); the CPA protects "consumers" as the Act defines them, but we apply the same discipline to all customers.

### 5. Minimum business details to send a quote (the founder's rule: nothing beyond the minimum)
**Answer: the business name and a way to contact the maker (a phone number or an email address). Nothing else is needed, including no physical address and no VAT number.**
- **Basis:** none of section 65, the CPA estimate rules or the VAT guide requires a physical address or a VAT number on a quotation. A quote should say who it is from and how to reach them, so it can be acted on. (An earlier draft listed the VAT number as required; it is not a legal requirement for a quote. It **appears on the quote when the business is VAT registered** simply because it is already on file, since the profile cannot be marked registered without it, so there is no extra ask.)
- **Physical address:** required on the **invoice** (SARS tax invoice particulars; CPA section 26), not before.
- **Two just-in-time asks:** choosing **Collection** asks where customers should collect (a suburb is fine); adding a **deposit** gently suggests a "how to pay" note, dismissably. Banking details are not required.
- **Confidence:** high.

### 6. Order of calculations, discounts and rounding
**Answer:** line amount = quantity x unit price; line discount; quote-level discount shared across lines in proportion; then VAT per rate group as in answer 1; amounts to the cent, half up.
- **Basis:** a discount agreed before the supply simply reduces the consideration, so VAT is charged on the discounted amount (guide, Chapter 13 on credit notes: a discount "by agreement with the recipient" reduces the consideration). Section 65(iv) forbids implying that a discount is in place of the VAT. **Early-payment (prompt settlement) discounts are different** (guide 9.4: output tax is declared on the full amount and adjusted later) and are **not** modelled as quote discounts.
- **Confidence:** high.

### 7. Tax invoices later (for the invoice slice)
- Below R5 000: an **abridged** tax invoice (title; supplier name, address and VAT number; serial number and date; description; price and VAT by one of the three methods). At R5 000 and above: a **full** tax invoice adding the **recipient's name, address and VAT number (if a vendor)** and the **quantity**. (The guide says "R5 000 or more" for full; the older checklist says "exceeds"; we treat R5 000 as full.) The threshold sits in the locale configuration.
- Issue within **21 days** of the supply. Credit notes carry the words "credit note", the supplier's name, address and VAT number, the recipient's name and address (unless the invoice was abridged), the date, the amount by which value and VAT changed, a brief explanation, and the original invoice's number and date (guide 13.8.3).
- Keep records for **at least five years**.

## Line VAT: zero-rated and exempt items (2026-10-08)

What the app does (plan: `docs/plans/quote-line-vat.md`). These are my readings of the sources above, not professional advice; the wording is in `app/src/lib/locale/za.ts` (`tax.statuses`, `tax.mixedInclusiveStatement`) so an accountant's correction is one file.

- A VAT-registered maker can mark an item **standard-rated** (15%, the default), **zero-rated** (0%) or **exempt**. A maker who is not registered cannot, and no document shows VAT.
- The hints name the usual examples only so the choice is not a blank: zero-rated, the basic foods listed in section 11 of the VAT Act (for example brown bread, eggs, fresh fruit and vegetables, rice, dried beans) and goods exported; exempt, supplies such as residential rent and some education. **To confirm with the accountant:** the exact list, and that makers of crafts will almost always be standard-rated.
- Zero-rated and exempt are both "no VAT charged" on the document, and differ in the maker's own VAT return (zero-rated supplies allow input tax to be claimed, exempt ones do not). The app does not do the return; it only keeps the two apart and labels them.
- A document that mixes treatments names the treatment on each item and breaks the totals down by treatment (guide 13.6). The statement under inclusive prices changes with the mix (section 65 still needs it to say what the prices include).
- Delivery is a separate standard-rated item (answer 2 above), whatever the goods are rated.
- Not built: a default treatment per product, and any VAT return or reporting.
