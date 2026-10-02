# Plan: app shell, business profile, customers (layers 1 and 2)

Status: approved by the founder on 2026-09-30 (design choices), built in two slices, each its own pull request. Goal behind both: get to **quotes** (layer 3) quickly.

Progress: slice 1 built and tested locally (awaiting review and merge). Slice 2 (customers) not started.

## Slice 1: app shell and lean business profile
- Bottom tab bar on phones, left sidebar on desktop. Only sections that exist are shown (Home, Customers, Business, Settings for now: four tabs fit on a phone; the fifth, Quotes, is when Business and Settings fold into "More"). **Business profile vs Settings (decided 2026-10-02):** the Business profile screen (`/app/business`) holds facts about the business (name, contact, address, VAT, price entry, and later document numbering, bank details, logo and terms). Settings (`/app/settings`) is for the person and the app (account, sign out, later display and notification preferences). When Quotes and Customers arrive and the phone tab bar runs out of room, Business and Settings fold into a "More" tab (bottom of the sidebar on desktop).
- `business_profiles` table, one row per organisation: contact phone and email, generic address fields (line 1, line 2, city, region, postal code), VAT registered flag and VAT number, country and currency (fixed to ZA and ZAR for now).
  - VAT rule in the database: registered if and only if a VAT number is present.
  - Owners and admins can edit. Every member can read. No direct inserts or deletes: the row is created by `ensure_organisation()` and backfilled for existing organisations.
  - South African format rules (VAT number: 10 digits starting with 4, postal code: 4 digits, the nine provinces) live in the locale configuration, not scattered in code.
- `prompt_dismissals` table (per user, per organisation, per prompt key): the first building block of the "friendly, dismissable prompts" principle. First prompt: "Add your business details so your quotes look right".
- Not in this slice: bank details (invoice layer), logo (branded templates layer), business registration number.

## Slice 2: customers
> **Built 2026-10-02** (see `docs/plans/quotes.md`, "Customers" and delivery slice 2). Differences from the list below: delivery address is one free-text field, the customer picker moves to the quote builder slice, and the customer tax number is not checked against the business's country rules.
>
> Folded into the quotes plan (`docs/plans/quotes.md`, 2026-10-02): customers are built as slice 2 of that plan, with inline creation in the quote picker.

- `customers` table: name (required), individual or business, contact person, email, phone, billing and optional shipping address, VAT number and company registration number (business only), notes, archived flag.
  - Any member can add and edit. Archive, never delete (documents will reference customers). Unique on (organisation, id) so later documents can reference customers with a composite key that cannot cross businesses.
- Screens: list with search, add, edit, archive and restore.

## Assumptions (change if wrong)
- Only owners and admins edit the business profile; all members manage customers.
- Address fields are generic (region = province in South Africa). Bank branch codes are not auto-filled until verified.
- VAT rate is not stored on the profile. It comes from the locale configuration and each document records its own rate when created or issued.

## Tests for each slice
Database security tests (isolation, roles, constraints), unit tests for the locale rules, and phone-viewport browser tests for the journeys, all run in CI.

## Notes from building slice 1
- Saving the profile does two updates (business name, then profile). If the second fails after the first succeeds the user sees an error and can retry. Moving both into one database function would make it atomic; not needed yet.
- The settings form submits by hand (not `<form action>`): React resets a form after its action finishes, which un-ticked the controlled VAT checkbox while the screen still showed it registered. The sign-in and onboarding forms still use `<form action>` and clear a typed value after an error. Minor; revisit.
- On desktop the business name shows in both the sidebar and the Home heading. Cosmetic.
