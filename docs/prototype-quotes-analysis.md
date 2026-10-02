# Prototype quotes: what it does, what is wrong with it, what to keep

Written 2026-10-02 for the quotes slice. The prototype is a spec and a source of ideas, not a foundation (see `docs/prototype-discovery.md`). Everything marked **verified** was read in the code; the file and line are given so it can be checked.

**Read in full or in the relevant parts:** `src/components/Quotes.tsx` (lines 1 to about 3,650 of 4,106: state, handlers, creation form, review step, list and detail views, product picker and configuration modal, fulfilment modals, send and accept prompts), the quote parts of `src/hooks/useAppState.ts` (lines 370 to 625), `src/types.ts` (product, customer, quote and line item types), `components/DocumentRenderer.tsx` (props and the rendered sections, searched rather than read line by line), `components/BuyerView.tsx` (header, accept and decline), `components/InternalQuoteFinancials.tsx` (the cost and margin logic), `components/DatePickerWithShortcuts.tsx`, `data/quoteTemplates.ts` (names only).
**Not read:** the product and extras editor modals in detail, the template customiser and gallery, `Customers.tsx` beyond the customer fields the quote form uses, `Invoices.tsx`, `Jobs.tsx` beyond the quote links, `lib/pdfUtils.ts`, the tail of `Quotes.tsx` (the delete confirmation and the template modals).

## 1. How the prototype works

**List.** A card stack on phones and a table on desktop. Status filter tabs with counts (All, Drafts, Sent, Viewed, Accepted, Declined; no Expired tab) and a search by number or customer. Draft rows have an Edit button.

**Creation (two steps, one form).**
1. *Step 1:* quote number (editable text), issue date and expiry date (date pickers with shortcuts: +7, +14, +30, +60, +90 days, end of month), a customer picker (search, "Add new customer" opens a large modal), then the line items, then fulfilment, discount, tax, notes, sign-off message, a bank-details card pulled from the business profile, and a private cost and profit panel. Footer: Cancel, Save Draft, Continue.
2. *Step 2 "Review & Publish":* four actions (Save as Draft, Download, Mark as Sent, Send quote), a template card (seven document styles plus a customiser), and a live preview of the document.

**Line items.** The "Add items" modal has three tabs: Products, Services and Custom item. A product opens a configuration view: hide-image toggle, quantity, unit price (starts at the quantity-break price and can be overridden), variations (the first choice is pre-selected), extras (each can be listed as a separate line), an item-level discount (% or fixed), an item-level tax rate, and a "type the total you want" override that back-calculates the unit price. A custom item can be simple (name, description, quantity, price, optional cost) or "advanced" (carries its own options, inputs and stages). "Add new product" closes the picker and navigates to the Products page.

**Document.** The customer-facing document shows business details, customer details, lines with option chips, subtotal, discount, VAT, total, notes ("Notes / Terms of Trade"), banking details and a sign-off line. The title is "Tax Invoice" or "Invoice" depending on VAT registration; quotes are "Quotation".

**Detail view.** A status dropdown (any status can be set), "Resume editing" for drafts, "Mark as Accepted", Delete, a simulated buyer portal, Download PDF, Print, and "Convert to…" Invoice or Job.

**Accepting.** Marking accepted asks "create a job?" with a "don't ask again" choice kept in the browser's local storage. In the simulated buyer portal, a buyer can accept, or decline with a reason.

**Costs.** A private panel shows revenue, cost, profit and margin per line and per quote, and prompts to add costs to products that lack them.

## 2. Verified problems

**Money and tax (the most serious).**
1. Money is floating point throughout (`Quotes.tsx:453-473, 754-775`), rounded with `parseFloat(x.toFixed(2))` at the end.
2. **Tax can be applied twice.** A line's tax rate is folded into its total (`:469-471`), then the quote-level tax is calculated on the sum of those tax-inclusive lines (`:754-770`).
3. **Discounts are applied after line tax.** The quote discount is taken off the sum of already-taxed line totals (`:755-766`), so VAT is not computed on the discounted amount.
4. **Quotes add VAT on top, invoices extract it.** A quote's total is net plus tax (`:775`), but converting to an invoice (for a VAT-registered business) treats the quote total as VAT-inclusive and extracts VAT (`useAppState.ts:510-521`), so the invoice's VAT can differ from the quote's.
5. **The delivery fee is never shown on the customer's document.** It is added to the total after tax (`Quotes.tsx:773-775`), but the document component receives only the fulfilment type and address, not the label or price (`DocumentRenderer.tsx:43-44, 350`). The customer sees a total that does not equal the lines plus VAT.
6. The VAT label is hard-coded "SARS VAT (15%)" regardless of the rate used (`DocumentRenderer.tsx:539`).
7. Costs and margins are looked up live from the current product recipe each time the panel renders, so a past quote's margin changes when a material price changes (`InternalQuoteFinancials.tsx:36-47`). On the quote screen the panel uses line totals without line tax (`Quotes.tsx:1820-1825`), which differs from the document total.

**Numbering, lifecycle and audit.**
8. The quote number is `QT-<year>-<count + 1>` from the current list length (`useAppState.ts:378-381`), so deleting a quote can produce a duplicate number, and it can be freely edited on every quote (`Quotes.tsx:944-951`).
9. Editing a quote overwrites it in place. There are no revisions (`useAppState.ts:393-397`).
10. Any quote can be deleted in any status, including accepted (`Quotes.tsx:2157-2167`).
11. Status is a free dropdown with no rules (`:2107-2125`).
12. Nothing ever sets "expired". The status exists, but no code compares dates (checked across the source).
13. Saving sets the status from the action used (draft or sent), not from the quote's current state (`:780`). Only drafts can be edited in the screen, but the status dropdown lets anyone switch a sent quote back to Draft and edit it, with no record of the change.
14. Accepting a quote in the buyer portal **automatically creates an invoice** after 100 ms (`useAppState.ts:587-592`), against the decision that the maker chooses when to invoice. Declining marks the job "Done" (`:605-611`).
15. A decline reason is collected but only shown in an alert; it is never stored (`BuyerView.tsx:74-79`).

**Sending.**
16. "Send quote" says "A copy of the complete quote has been emailed" (`Quotes.tsx:3606-3617`), but there is no sending code. Nothing is emailed.
17. PDFs are produced in the browser from the page (rasterised), with `window.print()` as a fallback (`:399-411`).

**Fulfilment (the clunk).**
18. Fulfilment options ("presets") live in the browser's local storage, per device, not in the business profile (`:302-315`). The first use requires an "Add fulfilment option" modal; later use needs a "Configure Options" modal that opens another "Add" modal (`:3293-3545`). There are three price modes (free, fixed, variable) and a five-field custom address (all required when used). Only one option per quote, shown as a separate bar under the lines.

**Matching and dead fields.**
19. Products are matched to lines by name using fuzzy `includes` in several places (`useAppState.ts:427-430`, `InternalQuoteFinancials.tsx:29-34`).
20. `defaultPricingTier` (retail or wholesale) on customers is stored but never used (`types.ts:146`).
21. The step 2 preview shows today's date and an expiry computed from a separate `expiryDays` value, not the dates the maker picked (`Quotes.tsx:1902-1903, 2051-2052`).
22. The Jobs screen promises that sending quotes "automatically populates" jobs "Awaiting acceptance" (`Jobs.tsx:1779`), but only the sample data contains such jobs (`defaultData.ts:1183`).

**Error handling.**
23. **Validation is silent.** "Save Draft" and "Continue" are disabled until there is a customer and at least one item, with no explanation (`Quotes.tsx:1848, 1861`), and the handler also silently returns if either is missing (`:733-736`). Only a few fields use the browser's `required` attribute.

**Structure and scope.**
24. The default notes text hard-codes a deposit statement in free text: "Standard 50% deposit required prior to production…" (`:283`). There is no structured deposit.
25. Seven document templates plus a customiser and gallery, which belong to the later branding layer.
26. The customer modal has about twenty fields and parses and rebuilds addresses from a single comma-separated string (`:107-126, 214-271`; `types.ts:150-179`).

## 3. Good ideas worth keeping

- Quote lines can be a catalogue product, a service, or a one-off custom item (which can be as rich as a product).
- Quantity price breaks applied automatically ("bulk pricing applied").
- Required variations and optional extras with price uplifts, shown as chips on the document.
- A private cost and profit panel that doubles as a prompt to add costs to products.
- **"Mark as Sent"** separate from "Send": makers often send quotes by WhatsApp or from their own email, and the app only needs to record that.
- Date shortcuts for expiry and "valid for N days".
- Notes and terms, and a sign-off message.
- The "create a job?" prompt on acceptance with a "don't ask again" choice (to be stored on the server per person, not in the browser).
- Snapshot of the customer's details on the quote (so later edits to the customer do not change a sent quote).
- Search by customer or number; status filter tabs with counts.
- A customer picker that can add a new customer without leaving the quote.
- A live preview of the actual document before sending.

## 4. Proposed improvements (for discussion, not yet decided)

These come from the founder's list and from the findings above. See the chat discussion and `docs/plans/quotes.md` (once written) for decisions.

1. **Money:** integer minor units, one calculation function shared by the server (authoritative) and the screen (preview), with a fixed, documented order of operations: line amounts, line discounts, quote discount, VAT, rounding. A setting for whether prices are entered including or excluding VAT. VAT rate and wording from the locale configuration, never hard-coded.
2. **Delivery and collection as a line on the quote** (a line with a kind), so it is taxed, shown and edited like any other line.
3. **Structured deposits** on the quote, carried through to the job and invoice later.
4. **Numbering** from a per-business sequence (editable prefix and next number), assigned when a quote is first sent, never edited per quote.
5. **Revisions:** editing a sent quote creates a new version; old versions are kept. No deletion of sent quotes (withdraw or archive instead). Derived "expired" status from the date.
6. **Customers:** name only is enough; more can be added later; details are copied onto the quote when it is sent.
7. **A general standard for errors:** buttons stay enabled; clicking shows what is missing, at the fields and in a summary.
8. **Sending:** a PDF shared from the phone (share sheet, WhatsApp, email) plus "Mark as sent"; real email later with proper email setup; hosted online quotes later.
9. **Server-generated PDF**, one clean default design; templates and branding later.
10. **Snapshot costs at send time** so margins do not drift.
11. **Never fuzzy-match** products; lines reference a product id or are custom.
12. **Acceptance is recorded, not automatic:** who accepted, how and when, plus a decline reason; the maker then chooses to create a job or an invoice.
13. **New:** "needed by" date, "quote again" (copy a quote), customer notes visible while quoting, an activity log per quote.
