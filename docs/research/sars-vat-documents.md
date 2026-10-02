# SARS rules for VAT documents (reference for quotes, invoices and credit notes)

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
