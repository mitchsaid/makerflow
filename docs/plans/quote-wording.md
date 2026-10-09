# Plan: quote wording and units (units, title and description, sign-off, terms, how to pay)

> **Changed 2026-10-09 (founder):** the Terms box (on a quote and under Quote wording) is gone: its text became a term. See `terms.md`.

Status: **built 2026-10-05 on the founder's "Build 1 to 4"** (the first four items of the list of missing maker-quote elements). The founder did not set the details below, so they are my defaults, open to change. Touches the database (migration `20261005100000_quote_wording_and_units.sql`), so it needs human review.

## What the maker can do
1. **Units:** a line's quantity can have a unit ("2 kg", "1 dozen", "3 hours"). A short optional label (up to 20 characters) typed or picked from suggestions (each, dozen, kg, g, litre, hour, day, metre, box, set, pair, portion). A product or service carries a default unit, so choosing it fills the line's. Blank means a plain count, as before. Shown wherever the quantity is: the item card, the Qty column of the document, the text version.
2. **Title, description, sign-off:** three optional quote fields. *Quote title* ("Wedding cake for Sarah", up to 120 characters) shows as a heading above the items; *Description* (up to 2000) sits under it as an introduction; *Sign-off* ("Yours in sweetness", up to 200) closes the document, followed by the business name. Notes stay as they are (specifics, shown after the totals).
3. **Terms:** free text (up to 4000) printed small at the end under "Terms". Optional starter lines ("Please allow [2 weeks] to make your order", a deposit line, a changes line) can be added with one tap and edited; they are prompts, not legal advice, and the wording needs the founder's eye.
4. **How to pay:** free text (up to 1000) printed under "How to pay" (bank details, SnapScan, "pay on collection"). Structured bank fields come with invoices.

**Defaults live under Quotes and invoices (moved from the Business profile, 2026-10-06)** ("Quote wording": sign-off, terms, how to pay; owners and admins). A new draft starts with them filled in and the maker can change them for that quote. Changing a default later never changes an existing draft or a sent quote. Everything is optional: nothing here is needed to send a quote.

## Data
- `quotes`: `title`, `description`, `sign_off`, `terms`, `payment_instructions` (all optional, empty stored as NULL, length checks).
- `quote_lines.unit`, `products.unit` (optional, 1 to 20 characters).
- `business_profiles`: `default_sign_off`, `default_terms`, `payment_instructions` (grants added for owners and admins through the existing update policy).
- `save_quote_draft` carries the new fields and the unit. The snapshot (JSON) carries them too, so a sent version never changes; older versions simply lack them.

## Not built
Structured bank details, a share message built from the sign-off, units that change the price, per-unit product pricing, Afrikaans or other-language wording for the app's own words ("Terms", "How to pay").
