# Plan: a supplier's email and phone on a material (and neutral tabs on the product form)

Status: **built 2026-11-03.** Founder, 2026-11-03: "don't show the number of inputs in the tab bar, make it neutral; provide an option space for supplier contact details (one for email, one for phone no) in materials." Needs human review: a **migration** (two nullable columns).

## Where things stand
- A material has a name, unit, quantity bought, price, VAT treatment and an optional **Supplier** (a name, text). Nothing says how to reach the supplier.
- The product form's tab bar showed a count badge on Inputs ("Inputs 4": the number of cost lines).

## Prototype read
Read: `prototype/src/types.ts` (`SupplierInfo`, `Material`) and the supplier parts of `prototype/src/components/Materials.tsx` (the form's supplier section, lines 56 to 260 and 540 to 720; the rest of that large screen is covered in `docs/prototype-discovery.md`).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A supplier has a **name**, **contact person**, **email**, **phone** and a structured **address** | **Name kept** (the existing Supplier field); **email and phone added** (this plan); contact person and address **later** | The founder asked for email and phone only |
| The supplier section is hidden behind "+ Add Supplier Information" and has "Remove Supplier" | **Changed:** the three fields are always there and optional; emptying them removes them | Fewer taps; "optional" says it; nothing to remove |
| Email and phone are free text with no checks | **Changed:** checked like a customer's (an email must look like one, a phone like a phone), said at the field | The app's forms say how to fix a problem at the field (ADR 0005) |
| Search matches supplier name, contact and email | **Kept** for name and email (email added to the search); contact is later | Same finding-by-supplier behaviour |
| A "Supplier Contact Summary" with copy buttons for the email, phone and everything | **Later** | Not asked for; tap-to-call and tap-to-email links on the material would be the phone-first version |

## What the maker sees
- On a material (add and edit), under **Supplier (optional)**: **Supplier email (optional)** and **Supplier phone (optional)**. The email uses the email keyboard and the phone the number pad. Both can be left empty; a wrong one is said at its field and nothing typed is lost.
- The email is saved in lower case, as everywhere else in the app.
- Search over materials also finds a supplier's email.
- **Product form tabs:** the Inputs tab shows just "Inputs", like Details and Production. (A tab can still say "N to fix" when something on it needs fixing; that is a problem, not a count.)

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| An email | `TextField type="email"` (`docs/ux-inputs.md`, "A phone number, an email") | As is, with the same check as a customer's (`validateEmail`) |
| A phone number | `TextField type="tel"` | As is, with `validatePhone` |
| Optional values | `optionalValidated` (`lib/form-values`) | As is: empty means none |

Inputs by kind: an email, a phone number, text. No address, quantity, date, price or percentage is added.

## Data
`materials` gains `supplier_email` (3 to 254 characters when present) and `supplier_phone` (1 to 40), both nullable and never `''` (a check refuses an empty string, as for `supplier`). Row-level security and the `session_required` policy already cover every column; the column-level grants are extended for insert and update by a member of the business. No delete, no new table. SQL test: the values are kept, can be changed and cleared, empty strings and over-long values are refused.

## Tests
- Unit: the form parsing (lower-cased email, tidied phone, empty is none, a wrong one is said at its field, the rest is kept).
- SQL: `supabase/tests/materials.test.sql` (above).
- Browser: add a material with a wrong email and phone (said at the fields, in the summary, nothing lost), then right ones (kept, email lower-cased), then clear them; the product tabs show no counts.
- Accessibility: the material form is already walked; the new fields are plain labelled text fields.

## Not planned yet
The supplier's contact person and address; tap-to-call and tap-to-email on a material; showing the supplier's contact where a material is used in a product's costs.

## Missed from the prototype
(none yet)
