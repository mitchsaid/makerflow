# How the app asks for things

One way to ask for each kind of thing. A screen that asks for an address, a quantity, a date or a price uses the component below, never a plain text box with a label. Founder, 2026-10-17, after finding "Deliver to" on a job and "how many" on an extra as plain boxes: "maybe we're missing a UX/consistency check step?" The step is at the end of this page.

| The screen asks for | Use | Notes |
| --- | --- | --- |
| A postal address (the business's, a customer's, where a quote or job is delivered) | `AddressFields` (`components/address-fields.tsx`): street, suburb or building, city, region, postal code, shaped by the locale pack. For where a **quote or job** is delivered: `DeliveryAddress` (`components/delivery-address.tsx`): the customer's saved addresses, or "A different address" in those same fields | Never one text area. What a quote or job keeps is the address as the country writes it, one line per part (its own copy) |
| A quantity, an amount of something, "how many", "how much" | `QuantityField` (`components/quantity-field.tsx`): the decimal keypad, the unit after the box, minus and plus (`stepper`) where a few more or fewer is the usual change | A count of what is made on a job is `ItemProgress` (the same minus, box, plus). A fixed number of an extra is a tick ("A set number, not one for each item") that opens a `QuantityField` |
| An amount added to a price (a choice that adds R50, an extra) | The money field with the `+R` in front, and beside it, in smaller text, the price it makes: `AddedPrice` with `addedPriceNote` (`lib/products/added-price.ts`). One price: "R350,00 in total"; several: "Small R330,00 · Large R630,00"; a choice priced by size shows each size's own | The same note goes with any new field that adds to a price, so the maker never has to add it up. A quantity price row shows the price it leaves the same way |
| Time spent on something (a cost line) | `QuantityField` for the number, beside a `SelectField` of minutes or hours; stored as whole minutes, a fraction of a minute is refused with how to fix it | The hourly rate is money (below), set once in the Business profile |
| Money | `TextField` with `startText` (the currency symbol) and `inputMode="decimal"`, read with `parseMoney` | Stored as integer cents |
| A percentage | `TextField` labelled "(%)", `inputMode="decimal"`, read with `parsePercent` | |
| A date | `TextField type="date"` | |
| A phone number, an email | `TextField type="tel"` / `type="email"` | |
| A unit ("kg", "dozen") | `UnitField` | |
| One of a few choices | `ChoiceCards` (`components/choice-cards.tsx`): bordered rows with an optional line of help, for a question about the thing being edited ("Does it come in variations?", "How do you track it on a job?"); one of many: `SelectField` | |
| A customer | `CustomerPicker` | |
| An item on a quote or job | `LineSheet` | |
| A picture | `ImageField` (one picture), `ChoiceImage` (a choice's picture) | |
| Words | `TextField`, `TextAreaField` | Helper text under the label, errors under the field (`docs/adr/0003-ui-components.md`) |

Two unit tests keep this honest (`components/__tests__/input-kinds.test.ts`): a text field or text area whose label asks for an address ("Deliver to", "Street address", "Postal code"…) or a quantity ("Quantity", "how many", "how much") fails. A new kind of input is added to this table in the same change that first uses it.

## The consistency check (before a pull request, and in every review)
For every screen built or changed:
1. **List what it asks for**, by kind, in the plan's "Interactions reused" table: every address, quantity, date, price, percentage, choice, customer, item, picture. A thing "asked for" that is not in the table is the miss.
2. **Check each against this page.** If the table has a component, use it; if it only has a text box, say why in the plan.
3. **Walk it on a phone viewport**, in the browser, with the keyboard up: does each field bring the right keypad, sit clear of the bar, and look like the same thing elsewhere?
4. **The review** (the sub-agent on full-lane pull requests) is asked the same question: "find inputs that ask for an address, quantity, date, price or choice some other way than `docs/ux-inputs.md` says."
