# Ways to pay: more than bank details and a note

## Status
**Slice 1 built 2026-10-26 (the list, the words, the document, the PDF and the statement). Slice 2 built 2026-10-27: the QR code picture.** The founder answered the questions (section "Answers"). Founder: "How to pay needs some restructuring. I think there may be multiple options, eg. paying by scanning a QR code or other methods. Right now it's just add bank details and notes."

Touches the database (a new table, a new kind of picture, the quote and invoice snapshots), the money details printed on customer documents and a security-sensitive setting (where customers send money), so it needs human review.

## Where things stand
- **How to pay** on a quote has two parts: **Bank details** (one saved account, with a tick to show it on this quote, `business_bank_details`) and **Other ways to pay** (one free text, "SnapScan, PayShap, or pay on collection"). The same two parts print on the document, on an invoice and on a customer's statement.
- Anything that is not a bank account (SnapScan, a QR code, a payment link, PayShap, cash on collection) is typed as free text. A QR code cannot be shown at all.
- Only the owner can change bank details (changing where customers send money is how invoice fraud happens); a sent document keeps the details it showed.
- Pictures (product photos, the logo, a theme's background) have their own store, upload field and printing (`lib/images`, `ImageField`).
- A recorded payment already has a method (EFT, cash, card, other), separate from this.

## Prototype read
Read in full on 2026-10-26: `prototype/src/components/Profile.tsx` (the bank card), `DocumentRenderer.tsx` (section 7, the printed block), `types.ts` (`BankingDetails`) and the payment parts of `BuyerView.tsx`.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| One bank account on the profile: bank name, account number, branch code, account type (all required, account type from a list) | **Kept**, already built as the country's structured fields (`docs/plans/bank-details.md`) | Done |
| Prints "Banking & Payment Details" as a four-box grid when a bank name or number exists; nothing otherwise | **Kept** (the printed block); **changed**: it becomes one block of all the ways to pay | The founder wants more than the account |
| No other way to pay: no QR, no wallet, no link, no free note | **New**: this plan | The prototype never had it; the founder asked for it |
| The buyer view lets a customer submit a "proof of payment" that marks an invoice paid at once | **Later**, with the customer-facing links (not planned yet) | Needs the online quote and invoice link, and a check by the maker |

Missed from the prototype: nothing found.

## What the maker sees

**Business profile › Bank details becomes Ways to pay** (the tab is renamed). It lists the ways the business is paid; each is one card with its own details:
- **Bank transfer** (what is there now: holder, bank, account type, number, branch, "use the document number as the reference"). Still one account.
- **A QR code** the maker already has from their payment app: they upload the picture, name it ("SnapScan", "Zapper") and say what the customer should do ("Scan to pay").
- **A payment link** (a card or wallet page from a provider): the address and a name ("Pay by card"). The document prints the address as a clickable link and, later, a QR drawn from it.
- **PayShap or a mobile payment ID:** the number or ID and a name.
- **Pay on collection / cash:** a line of words.
- **Something else:** a name and a line of words (what "Other ways to pay" is now).

Each card has a name, its details, and **"On new quotes"** (on by default). *+ Add a way to pay* picks the type first, then asks for its details; the owner can add one from a quote in a sheet, as bank details are now, so nothing typed on the quote is lost. Only owners change them. A card says when it was last changed.

**On a quote and an invoice, How to pay** shows each saved way with a tick, "Show on this quote", and a one-line summary ("Bank transfer · FNB ending 6789", "SnapScan · QR code"). All are on unless the maker unticks one. Under them, one box for a note that is only for this quote ("Please pay within 7 days"): what *Other ways to pay* is today, renamed **Payment note**.

**On the document,** one *How to pay* block: a row for each way. A QR code is printed as a square picture with its name and instruction beside or under it, with a size that scans on paper and on a phone screen. The bank rows are as they are now.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| Bank transfer fields, owner-only, with "last changed" | `BankDetailsForm` (`business/bank-details-form.tsx`) | As is, as one card's form |
| Add one from a quote, without losing what was typed | The "Add bank details" sheet (`quotes/bank-details-section.tsx`) | With a type step first |
| The QR picture | `ImageField` and the pictures store (`lib/images`) | With a new kind, `payment-qr`: not cropped, kept at a size and sharpness a scanner reads |
| Show it on this quote | The "Show my bank details on this quote" tick | One tick per way, same wording |
| A list of cards on a tab of the Business profile | `SectionTabs`, `Section`, `AddButton` | As is |
| The free note | The "Other ways to pay" text and its usual | As is, renamed *Payment note* |
| Which types a country offers | The locale pack (`payment.bankFields`, `methods`) | Extended: the pack lists the types and their fields |

Inputs by kind: names and instructions are text; the QR is a picture (`ImageField`); the link is a web address (a text field with a check); the bank fields are as built. No address, quantity, date or money.

## Decisions (with a recommendation)
1. **Types come from the country's pack** (`docs/locales/README.md`): South Africa lists the ones above; another country lists its own. Recommended. *I have not checked the current names, formats or QR rules of South African payment providers: the founder and a maker who uses them should confirm the list and wording before it is built.*
2. **Additive, not a rewrite.** `business_bank_details` stays as it is (one account, the existing snapshots and the statement keep working); the other ways go in a new table. The tab shows both as one list. Moving the bank account into the new table later is possible without changing any sent document. Recommended.
3. **A QR is an uploaded picture first.** Payment apps already give the maker a QR to save or screenshot; drawing one from a link needs a QR library (a new package, which needs approval) and is a later slice. Recommended.
4. **On by default per way, switch per quote**, as bank details are. Recommended.
5. **Owner-only changes, frozen in what was sent**, as bank details are. A way to pay changed after a quote was sent never changes that quote. Recommended.
6. **The same ways on invoices and statements** (they already show the bank details and the note). Recommended, in its own slice.

## Data (sketch; needs human review)
- New table `payment_methods`: `id`, `organisation_id`, `kind` (checked against the pack by the app), `name` (1–60), `details` (small object of short text values, as `business_bank_details.details`), `image_id` (nullable, the QR picture), `on_new_quotes boolean`, `sort_order`, timestamps. Row-level security: members read, **owners only write**; the restrictive `session_required` policy; a test in `app/supabase/tests/` (another business sees and changes nothing; an admin or staff cannot change one).
- `images.kind` gains `'payment-qr'` (check widened, as for `'background'`).
- `quotes.hidden_payment_methods uuid[]` (the ways the maker unticked for this quote; default empty), carried by `save_quote_draft`; a payload without it keeps the draft's. (Hidden rather than shown, so a way added later appears on new quotes without touching old drafts.)
- The snapshot gains `paymentMethods: { name, kind, lines: { label, value }[], qrImageId?, url? }[]`, frozen when sent; a snapshot without it prints as it does today.
- Loaded with the workspace in the same query (no new query per page).

## Slices
1. **The list and the words.** `payment_methods` (no QR yet), the Ways to pay tab, the section on the quote (ticks, payment note), the document and the PDF. Usable on its own: SnapScan handle, PayShap ID, a payment link, cash on collection.
2. **QR pictures.** The new picture kind, the upload on a card, printing it on the document and PDF at a scannable size.
3. **Invoices and statements** use the same ways and snapshot lines.
4. **A QR drawn from a payment link** (needs the QR library approved); clickable links in the PDF.
5. **Later:** record which way a customer paid when recording a payment (links to the existing payment method), the customer-facing "I've paid" step.

## Tests
- SQL: owner-only writes, another business sees nothing, the kind and the picture belong to the business, `session_required`.
- Unit: the pack's types and fields, the snapshot lines for each type, a quote with some ways unticked, an older snapshot.
- Browser: add a way from the Business profile and from a quote; untick one on a quote; the preview and the sent quote print the chosen ways; a sent quote keeps what it showed after a way changes; a QR upload (slice 2); accessibility cases for the tab, the section and the sheet.

## Answers (founder, 2026-10-26)
1. **The South African list is fine** (EFT, QR code, payment link, PayShap or mobile ID, pay on collection, something else). **A bank transfer is called "EFT"** on screens and documents (`payment.bankTransferName` in the pack). The names and rules of each provider are still not checked against a source: the fields are plain text and only the payment link is checked (a whole https address).
2. **QR as an uploaded picture first.** Slice 1 listed it as *Coming soon*; slice 2 (2026-10-27) builds it.
3. **The same list and component on invoices.** The *How to pay* section (`PaymentWaysSection`) takes `document="quote" | "invoice"`. The invoice form has no How to pay section today (an invoice shows the ways its quote showed), so slice 1 puts the ways on the invoice document (current details of the ways the quote showed, matched by id) and on the statement; a section on the invoice form comes with the invoice wording settings.
4. **The box is renamed *Payment notes*** (a line for this quote only). Its usual keeps its "Use this note on new quotes" link.

## What was built in slice 1
- `payment_methods` (owners write, members read, at most 20 a business, the restrictive `session_required` policy; `supabase/tests/payment_methods.test.sql`), `quotes.hidden_payment_methods` carried by `save_quote_draft` (a payload without the key keeps the draft's).
- The pack's `payment.waysToPay` (kind, label, description, default name, available, fields), `bankTransferName`, `paymentNotesHint`; `lib/payments` (parse, lines, summaries, snapshots, invoice ways); `lib/payments/groups.ts` (what *How to pay* prints).
- Business profile › **Ways to pay** (was *Bank details*; `?section=bank` still opens it): the EFT form, a card for each other way (change, remove after a question), *Add a way to pay* (kind first, then its details, in a sheet).
- On a quote: each saved way with a tick, *Add a way to pay* for owners (the same sheet), *Payment notes*. New quotes start with the ways not kept off new quotes ticked. The document, the PDF and the statement print a block per way, with the EFT named only when other ways are shown too.
- Sent documents keep their own copy of each way (`snapshot.paymentMethods`, with ids).

## Not planned yet
Several bank accounts; checking a payment against the bank; taking the payment inside MakerFlow (needs a payment provider, and is a separate decision in `docs/product-brief.md`); a re-authentication step before changing where money goes.

## What was built in slice 2 (2026-10-27)
- Migration `20261124100000_payment_qr.sql` (**needs human review: a QR code sends money**): `images.kind` gains `payment-qr`; `payment_methods.image_id` points at a picture of the same business (composite foreign key, `on delete set null (image_id)` so a way keeps its words if a picture ever goes). Tests in `payment_methods.test.sql` and `delete_account.test.sql`.
- Pack: the *QR code* kind is ready (`picture: true`), with an optional *What to tell the customer* line and the default name *Scan to pay*.
- Picture: `ImageField` with the new kind; the browser keeps it a lossless PNG on white (no JPEG blur), the server keeps it whole (never cropped), fitted inside 800 across, never enlarged, with a 300 thumbnail (`lib/images/process.ts`).
- Printing: on screen 160 px on white; in the PDF about 3.5 cm on white, from the full-size copy (quote, invoice and statement PDFs). The snapshot's way carries the `imageId`, so a sent quote keeps its picture and an invoice shows the current picture of the same way.
- A QR is required for the QR kind (error at the field); other kinds have none.
- Still later: a QR drawn from a payment link (needs a QR library, which needs approval) and clickable links in the PDF.
