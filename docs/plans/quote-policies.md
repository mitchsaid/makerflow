# Plan: quote policies (a saved library of reusable policies)

Status: **decisions confirmed by the founder 2026-10-05**; building. Research behind the wording: `docs/locales/za/consumer-policies.md` (South African consumer law, read from the Act itself). Touches the database (new table, a new quote column, a replaced function), so it needs human review.

## The idea (founder, 2026-10-05)
More structured terms and notes, designed to help makers write and re-use policies on five headings:
1. **Changes:** any change after sign-off is re-quoted and may move the delivery date.
2. **Cancellation:** what the client is charged at each stage (the deposit, plus the cost of materials bought and work done).
3. **Expected variations:** handmade pieces, natural stones, dye lots and fresh flowers vary a little.
4. **Client responsibilities:** being available for fittings, telling the maker about allergies, and handling, storage and transport after handover (confectioners especially).
5. **Liability limits, warranty and aftercare:** resizing, repairs, cleaning.

## Decisions (founder, 2026-10-05, all the recommended options)
1. **A saved library.** Under the five headings a business saves one or more policies (for example two cancellation policies). Each quote ticks which to include and can edit its own copy. Changing a saved policy never changes quotes already made.
2. **Cancellation is text with a guide now, a stages table later.** A written policy with starter wording that prompts for the stages; a proper stages table shows as a visible "coming soon" part.
3. **Starter wording is researched first.** South African consumer rules read from the Act (`docs/locales/za/consumer-policies.md`); starters live in the South African locale pack. A legal adviser should still check them.
4. **Headed sections on the quote.** A "Terms and policies" part after the sign-off, each included policy under its own heading in readable text, not small print. The free-text Terms stays, as "Other terms", in small print after them.

## What the maker can do
- **Business profile > Quote policies** (owners and admins): the library, grouped by the five headings. Add, edit, archive and restore a policy: its heading, a title (starts as the heading's name), the wording, and "include on new quotes". Each heading offers starter wording to tap (some headings offer two, such as cancellation for made-to-order goods and for services and bookings), a short "good to know" line, and a clear "prompts, not legal advice" note. Nothing is forced.
- **On a quote:** a "Policies" section lists the library as ticks; the ones marked "include on new quotes" start ticked. A ticked policy shows its wording, editable for this quote only. "Add a policy" opens a sheet over the quote (the same form as the library, so nothing typed is lost) for owners and admins; other members are told to ask one.
- **On the document and preview:** "Terms and policies": each included policy under its heading; then "Other terms" in small print. The frozen snapshot carries the policies, so a sent version never changes.
- **Visible but inactive ("coming soon"):** the cancellation stages table; attaching a policy to particular products or services (for example "natural stones vary" only on jewellery); the customer accepting the policies when online quotes arrive.

## Data
- New table `policies` (organisation, kind, title, body, include by default, order, archived): readable by all members (they tick them on quotes), written by owners and admins only (it is business wording, like the Business profile), no delete (archive), row-level security, the `session_required` policy, composite key for the business.
- `quotes.policies` (jsonb list, up to 12): the quote's own copy of each included policy (kind, title, wording, and which library policy it came from). It is a copy so the quote keeps its text when the library changes, and so a sent quote is frozen by the quote's own rules. `save_quote_draft` carries it.
- Limits: title up to 80 characters, wording up to 2000, at most 40 lines, 12 on a quote.

## Not built
The stages table, per-product policies, customer acceptance, translations of the headings, and attachments such as care cards.
