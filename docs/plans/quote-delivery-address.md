# Plan: where a quote is delivered to (delivery address on the quote)

Status: **building 2026-10-07** (founder: "ensure delivery address has an option to use saved customer address or add another one"). Migration: needs human review (a new column on quotes, a replaced `save_quote_draft`).

## Goal
When a quote says "Delivery", the maker can say where to. It prints on the document so the customer sees it was understood, and it is the same address the maker will need again for the job later. No more retyping an address the customer already has on file.

## What the maker sees
Under **Delivery or collection**, when **Delivery** is chosen (after the fee):
- **Deliver to**, a short list of choices:
  - the customer's **saved delivery address** (their "Deliver to" on the customer, if they have one),
  - the customer's **address** (their main address, if they have one and it differs),
  - **A different address**: an empty box to type one in (for this quote only).
- The first saved address is picked for them when they choose Delivery (or change the customer), so the usual case is zero taps. A choice they typed themselves is never replaced when the customer changes.
- Nothing is required: **no address is needed to send a quote** (founder, 2026-10-02, "Minimum to send a quote"). With no saved address the box is simply empty, with a hint that it can be left for now.
- Choosing Collection or "Not decided yet" hides it; the address stays on the draft, but is not printed unless Delivery is chosen.
- Editing the customer from the quote (the existing "Edit details") refreshes the saved choices.

## On the document
A **Deliver to** block under the customer's details (same small capital label), only when the quote is a delivery and has an address. It is part of the frozen snapshot, so a sent quote keeps what the customer received.

## Decisions
1. **The quote keeps its own copy of the address text** (like policies do), not a link to the customer. Changing the customer's address later never changes a quote that was sent, and a draft can use an address that is not saved on the customer.
2. **Plain text, up to 400 characters, line breaks kept**: the same shape and limit as the customer's own "Deliver to" box, so a saved address always fits.
3. **The country's address rules still apply to the saved main address** (it is formatted by the locale pack's `formatLines`). A typed address is just text: delivery addresses are often "the gate at the back, ask for Sipho".
4. **Not built (later):** "save this address to the customer" from the quote, and several saved delivery addresses per customer. Both would need a customer addresses table; one text box per customer is enough for now.

## Database (migration `20261012100000_quote_delivery_address.sql`)
- `quotes.delivery_address text` (null, up to 400 characters), with insert and update column grants.
- `save_quote_draft` replaced to carry `delivery_address`. A payload without the key (an older app still open on a phone) keeps what the draft has.
- Existing row-level security and `session_required` cover the new column. SQL test: `quote_delivery_address.test.sql`.

## App
- `lib/customers`: `savedAddresses(customer, locale)` gives the saved choices; `CustomerOption` and the picker's results carry them.
- `QuoteFormValues.deliveryAddress`; parsed and checked by `parseQuote`; stored, read back and copied by Quote again.
- The builder: the "Deliver to" choices and box; the customer picker's list moves up into the builder so the choices follow the chosen customer.
- Snapshot field `deliveryAddress` (optional, so old snapshots still render), the PDF block, and the document-as-text view.

## Tests
Unit (parsing, the choices, snapshot), SQL, browser (use the saved address, use another, change customer, not shown for collection, on the sent document), accessibility case.
