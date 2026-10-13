# Plan: the business logo on the Business profile, and a nudge on quotes

Status: **built 2026-10-13** at the founder's request: "add business profile logo, but make it discoverable on quotes (at least if you haven't already set it)". No database change.

## Where things stand
- The logo already exists: `business_profiles.logo_image_id`, one picture processed and kept in the private `pictures` storage bucket (`docs/adr/0007-pictures.md`), set with `ImageField` and `saveLogo` (owners and admins only), printed at the top of quotes under the theme's "logo" option, and frozen into a sent quote. Until now it was set only under **Quotes and invoices** (`/app/documents`), which nobody looks at before their first quote.
- `CLAUDE.md`: facts about the business (name, contact, address, VAT, what it makes, bank details) live in the **Business profile**; the logo is a fact about the business, so it belongs there. Quotes and invoices keeps how documents look (themes, including whether the logo is shown).

## Prototype read
Read in full: `prototype/src/components/Profile.tsx` (385 lines), and every use of the logo in `DocumentRenderer.tsx` (lines 122 to 125 and 232 to 235), `TemplateCustomizerModal.tsx` (the "Header Logo & Branding" options), `CustomerStatementModal.tsx` (line 322) and `types.ts` (`logo`, `LogoDisplayMode`). `Jobs.tsx`, `Products.tsx` and `Customers.tsx` only mention the word "logo" in item names and an empty default, not a feature.

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| Profile screen has a Logo card: a file picker for any image, "Upload Logo" | **Kept**: a "Your logo" section on the Business profile, the same `ImageField` | One interaction for pictures everywhere (`docs/plans/quote-looks.md`) |
| Saves the whole profile the moment a logo is chosen, and shows "saved" for three seconds | **Changed**: choosing a picture and pressing "Save logo", as every other section of the page saves on its own button | Same as the rest of the page; nothing is saved by accident, and a refused upload says why |
| A 128 px square preview with a big letter ("M") when there is none | **Kept** as the field's own preview and empty state | Already built in `ImageField` |
| Helper text: "Appears beautifully on quotes and tax invoices." | **Kept**, in plain words, for quotes now and invoices when they exist | The maker should know where it shows |
| No way to remove a logo once set | **Changed**: it can be removed; quotes already sent keep the one they sent | Frozen documents never change |
| Logo kept as base64 text inside the profile, any size | **Dropped**: resized, checked and kept as a file with a record in `images` | ADR 0007 |
| The logo shows on every quote and tax invoice | **Kept** for quotes (built); invoices later | Invoices are not built |
| The template customiser chooses "Logo + Name", "Just Logo" or "Just Name" | **Kept**: already built as the theme's "Top" logo option | `docs/plans/quote-themes.md` |
| Customer statements print the logo | **Later**: statements are not built | |
| Nothing nudges the maker to add a logo (it starts empty) | **Added**: a friendly, dismissable prompt on the quote preview while there is no logo | The founder's ask |

## What the maker sees
1. **Business profile** has a "Your logo" section (owners and admins), right after the business details: the picture, "Choose a picture" / "Remove", and "Save logo". It is the same section that used to be under Quotes and invoices, which no longer has it (a line there says where it went, so nobody hunts for it).
2. **On the quote preview**, while the business has no logo and the person can change it, a card above the quote says: "Add your logo. It is printed at the top of your quotes." with **Add your logo** and **Not now**. "Add your logo" opens a sheet with the same "Your logo" section; saving it closes the sheet and the quote redraws with the logo on it. "Not now" hides the card on this device (a cookie the server reads, so the page does not jump; not the database: it only decides whether to nag).
3. People who cannot change the logo (not an owner or admin) see no card.

## Interactions reused and new interactions
| What the screen needs | Existing interaction | Reused as is, with a mode, or new (and why) |
| --- | --- | --- |
| Choose, preview, remove and save the logo | `LogoForm` with `ImageField` and `saveLogo` (`documents/logo-form.tsx`) | Moved to `business/` and reused as is; one new optional `onSaved` callback so the sheet can close |
| A dismissable prompt | The card style of the first-quote setup prompt (`quotes/quote-setup.tsx`) | `Alert` with two buttons; unlike the setup prompt, "Not now" is a cookie on this device and not a database column, because it only decides whether to ask again (a new device asks once more) |
| A sheet with a form in it | `Sheet` as in `send-sheet.tsx` and `email-sheet.tsx` | As is |

## Tests
Browser: set the logo from the Business profile (choose, save, see it, remove); the Quotes and invoices page points there; the preview shows the card when there is no logo, adding the logo from its sheet closes it and the card goes; "Not now" hides it after a reload; a person who is not an owner or admin sees no card (not browser-tested: it needs a second member; it is the same owner-or-admin check that guards the section). Accessibility: the Business profile with the logo section, and the prompt and its sheet on the preview. The pictures spec that set the logo under Quotes and invoices now sets it on the Business profile.

## Not planned yet
Logo on invoices and statements (when they exist); a crop or a square version; several logos.
