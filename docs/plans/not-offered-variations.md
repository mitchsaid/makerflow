# Plan: a choice that is not offered for some variations

Status: **built 2026-10-30** (founder, 2026-10-30: "when I add a second variation, I want to be able to specify that it isn't offered for a certain first variation"). Changes the database (one new table and a replaced `save_product`): **needs human review** (migration `20261128100000_option_values_not_offered.sql`).

## Prototype read
Read 2026-10-30: `prototype/src/components/AdvancedCustomItemModal.tsx` lines 1 to 260 (the variation and extra state, `addVarValue`, `saveVariationOption`, `saveExtraOption`, the option editing helpers) and a search of the rest of the file for exclusions, availability and disabling. Coverage is in `docs/prototype-discovery.md`.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| A variation is a name and a list of values, each with a price uplift and a photo; every value is offered with every other | **Kept** (the product's variation lists), plus this plan | Nothing in the prototype says a value can be unavailable for a combination, so this is new |
| A value cannot be hidden for a combination | **New:** each choice of a further variation can say which first variations it does not come in | Founder, 2026-10-30 |

## What the maker sees
**On the product form** (Production and Inputs tabs unchanged).
- Under each further variation (Flavour), under "Price depends on the size", a tick: **Not every choice comes in every size** (the word is the product's first variation name: size, type, colour). It shows only when the product has first variations.
- Ticked, each choice gets a **Comes in** list: one tick for each size, all ticked to begin with. Un-ticking Small for Red velvet means Red velvet is not offered on a Small.
- When the price depends on the size, a size a choice is not offered in has no price box.
- Saving checks two things, each said where it is: a choice must come in at least one size ("Offer it in at least one, or remove it."), and every size must have at least one choice to pick ("Nothing here is offered for Small. Offer at least one choice in each."), because one is always chosen.

**On a quote, job and invoice item.** The item sheet's list shows only the choices that come in the chosen size. Changing the size changes the list: a chosen choice that does not come in the new size is swapped for the list's usual choice when that comes in it, else cleared (and the list asks to choose when the item is saved). Before a size is chosen every choice shows. An item keeps its own copy of what was chosen, so changing a product later never changes a quote.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new |
| --- | --- | --- |
| A tick with its label | `Checkbox` with `Field`/`FieldLabel` (as "Price depends on the size" in the same card) | As is |
| Choosing one from a list on the item | `OptionChoices` (radio rows) | As is; it filters its rows by the item's size |
| Saying what is wrong at the field | The product form's problem list and field messages (ADR 0005) | As is, two new messages |

Inputs by kind: no new kind; ticks only.

## Data (migration `20261128100000_option_values_not_offered.sql`)
- `product_option_value_exclusions (organisation_id, value_id, variation_id)`: a row means the choice is **not** offered when the item is that variation; no rows, offered everywhere (so every existing choice is unchanged). Composite same-business foreign keys; the variation must be one of the same product's (the same trigger function as `product_option_value_prices`); cascades with the choice or the variation.
- Row-level security for members, the restrictive `session_required` policy, grants for select, insert and delete only.
- `save_product` (same signature): each choice takes `not_offered: [variation_index, …]`, by the variation's place in the product's list (new variations have no id yet), replaced on every save.
- Tests: `option_values_not_offered.test.sql` (stored by place, replaced, gone with the variation, another product's variation refused, another business sees and removes nothing).

## Not built
Hiding a choice by a *choice* of another further variation (Red velvet not with Square, where both are further variations); extras not offered for a size; a "not offered" cell in the quantity price grid. Say so if one is wanted.

## Tests
- Unit: parsing and payload (`options.test.ts`); the item's list, the swap and the missing choice (`option-choices.test.ts`).
- SQL: as above.
- Browser: `e2e/not-offered.spec.ts` (set it on the form, comes back as saved, the quote's list follows the size, the two save problems).
