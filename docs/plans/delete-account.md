# Plan: delete my account (with a typed confirmation)

Status: **built 2026-10-13** at the founder's request: "add a delete user option (with a typed confirmation step) so I can test the first time flow". **Needs human review**: it deletes data and a sign-in, and it adds a migration (`20261101100000_delete_account.sql`, a server-only function).

This is the real "delete my account and data" feature that `docs/prototype-discovery.md` (section 6) says replaces the prototype's "Reset": a deliberate, self-service action for every person, not a test shortcut. It happens to be exactly what is needed to try the first-time flow again (sign up, name the business, the first quote's setup questions). `CLAUDE.md` forbids demo, seed or reset shortcuts in product code paths; this is not one, because it works the same for everyone and deletes only the signed-in person's own account.

## Prototype read
Read in full: the prototype's reset code, `useAppState.ts` lines 1525 to 1625 (`clearAllData`, `loadCompanyPreset`, `resetToDefaults`) and `Dashboard.tsx` (the "demo data controls" block at lines 340 to 385 and the confirm modals at lines 470 to 545).

| The prototype does | MakerFlow: kept, changed, later, or dropped | Why |
| --- | --- | --- |
| "Reset (clear all info)" empties the browser's stored data and shows a blank profile, so a maker can test fresh onboarding | **Changed**: "Delete your account" removes the sign-in and the businesses it solely owns, on the server, and the person signs up again | The prototype's data lived in the browser; MakerFlow's is shared and kept on the server |
| A confirmation modal (Cancel / "Yes, Clear All Info") with a plain yes | **Changed**: the person types their own email address to confirm | The founder's ask; deleting a business cannot be undone |
| "Restore Default Workspace" loads sample quotes, invoices and a Capetonian company | **Dropped** | Sample data is a test shortcut (`CLAUDE.md`) |
| Six one-click demo companies | **Dropped** here; the public demo account is a separate, later feature | `docs/product-brief.md`, section 4 |
| Nothing is kept: invoices and credit notes are deleted too | **Changed**: no invoices exist yet; once they do, deleting an account must keep or hand over issued tax documents, so a test fails until that is decided | Issued invoices and credit notes are immutable and never deleted (`CLAUDE.md`) |
| The control sits on the Dashboard, always visible | **Changed**: it lives in Settings (the person and the app), at the bottom, in its own card | Settings is for the person; the Dashboard is not for destructive actions |
| ErrorBoundary "reset" clears the stored data after a crash (`App.tsx`) | **Dropped** | A crash must never offer to delete data; deletion is only the deliberate Settings action |
| Stages and templates are reset along with the data | **Dropped** | They are per-business settings that go with the business |
| After reset the profile is blank and nobody is signed out | **Changed**: the person is signed out and signs up again | There is a real sign-in now |
| Framed as a "Testing Area" for trying the app | **Changed**: a real "delete my account" for everyone (POPIA), which also lets the founder try the first-time flow | `CLAUDE.md` forbids reset shortcuts |
| `window.confirm` for destructive steps | **Changed**: a typed confirmation in a sheet | The founder's ask |
| Notifications cleared by the reset | **Later**: MakerFlow has none yet | Nothing to delete |
| One browser, one device | **Added**: every device is signed out when the account goes (the session ends with the sign-in) | Server-side sessions |
| One person, one workspace | **Added**: a business can have several people; deleting an account removes the person and keeps the business, unless they are its only owner (see below) | MakerFlow has roles |

## Interactions reused
| Need | Reused | Notes |
| --- | --- | --- |
| A sheet with a form | The `Sheet` pattern used by the quote share and email sheets, with `finalFocus` back to the opening button | Same focus handling |
| A text field with an error | `TextField` and `FormSummary` (ADR 0005) | Nothing new |
| A card in Settings | `Card` from `components/ui` | A destructive button variant from the same set |
| Remembering a "Not now" | Not needed | |

## What the person sees
1. **Settings** has a last card, "Delete your account", saying what is deleted and that it cannot be undone, with a **Delete my account** button.
2. The button opens a sheet "Delete your account?" that lists what will be deleted (your sign-in, and each business where you are the only person, with its quotes, jobs, customers, products, pictures and settings) and what will stay (businesses that have other people; you are just removed from them).
3. A field says "To confirm, type your email address" with the address under it. The **Delete my account** button stays enabled; pressing it with the wrong text says what to type, at the field and in a summary (`docs/adr/0005-form-errors.md`). **Cancel** closes the sheet.
4. When it is done they are signed out and land on the sign-in page with a plain message, "Your account has been deleted. You can create a new one below." Signing up with the same email again starts from the beginning.

## Decisions (made, to confirm)
1. **Confirm by typing the account's email address**, not a fixed word: it shows which account is about to go, and a slip is less likely. Compared ignoring case and spaces, and checked again on the server.
2. **A business where this is the only person is deleted** with everything in it. A few links do not cascade, so the function deletes those children first (a SQL test lists them and fails when a new one appears). **This includes sent quotes and their saved versions**, which ADR 0006 said would be refused until an erasure process exists; for a person deleting their own account that is the erasure process. Issued invoices are different (decision 4). **A business with other people stays**; the person is removed from it.
3. **Sole owner of a business that has other people: refused**, with the business named: "Make someone else an owner first." Handing over ownership is not built; until it is, this stops a business being left with nobody in charge. (Nothing in the app can invite another person yet, so today this cannot happen.)
4. **Issued invoices and credit notes:** *update 2026-10-17: invoices now exist (migration `20261115100000_invoices.sql`). For now deleting an account is **refused** (55007, naming the business) when the person is alone in a business that has issued invoices; a keep-or-hand-over process comes later. Credit notes: the test still fails the day their table appears.* Original note: there were none. Because they must be kept, the day an `invoices` table exists this feature must be reworked (keep the documents with the customer and business details they were issued with, and delete or anonymise the rest); a SQL test fails the moment the table appears, to make that a decision and not a surprise.
5. **Pictures:** the files in storage are deleted with the business (a deleted business must not leave its logo behind).
6. **Order:** the database first (in one transaction; the businesses are locked, so two owners leaving at once cannot both be let through), then the picture files (by the listed pictures and then a sweep of the business's storage folder), then the sign-in. If the last step fails the person is told, and pressing Delete again finishes the job ("user not found" counts as done).
7. **No second sign-in step.** The typed email is a guard against slips, not a re-authentication: anyone holding the open session could type it. Step-up re-authentication is already listed for account deletion in `docs/security-notes.md` (item 12). A later hardening item.

## Data
- `public.delete_account(p_user uuid)`: security definer, **service role only** (like `send_quote`). In one transaction: for each of the person's businesses, refuse if they are its only owner and others remain (errcode 55006, with the business name); delete the businesses where they are the only person (cascades); returns the ids of the deleted businesses and of their pictures so the server can delete the files. Memberships, the profile and "Not now" records go with the sign-in (`on delete cascade`); `sent_by`, `created_by` and `actor_id` columns on kept rows become empty (`on delete set null`).
- No new tables, so no new policies. Every table with an `organisation_id` is checked empty for a deleted business by the SQL test (it reads the catalog, so a future table that does not cascade fails it).

## Tests
SQL (`delete_account.test.sql`): server only; a business with a sent quote, a job, a picture, customers, products and terms is removed entirely (checked in every table that has an `organisation_id`); a business that another person also belongs to stays and only the membership goes; the sole owner of a shared business is refused and nothing changes; a person with no business is fine; **fails if an `invoices` table exists** until this is reworked. Unit: the typed-confirmation check. Browser: wrong text is refused at the field and in the summary, Cancel changes nothing, the right email deletes the account and its data and signs out, and signing up again with the same email gives the first-time flow; accessibility case for the card and the sheet.

## Not planned yet
Handing a business to another owner; leaving a business without deleting the account; export of the person's data before deleting (POPIA access request); a deletion delay or undo; keeping issued invoices (the day invoices exist).
