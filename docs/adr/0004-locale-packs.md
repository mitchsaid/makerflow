# ADR 0004: Country rules live in locale packs

Status: accepted (founder, 2026-10-02: rules must be recorded as applying to a South African user, because other regions come later)

## Decision
Every rule that depends on the country a business trades in lives in a **locale pack**: tax rate and rules, document wording and requirements, address shape, money and number style. The business's `country_code` selects the pack. The code is `app/src/lib/locale/<cc>.ts` (type `LocalePack`), the registry is `getLocalePack(countryCode)`, and the research and sources behind each rule are in `docs/locales/<cc>/`. South Africa (`ZA`) is the first pack.

## Why
- The first slices (VAT, tax invoices, deposits, quotes) are full of South African law. If it is written into screens and arithmetic, adding a second country means finding every rule by reading everything.
- Packaging the rules makes them testable in isolation, reviewable by someone who knows the country, and visibly tied to their sources.
- The database already stores `country_code` and `currency_code` per business, so the foundation exists.

## Consequences
- The money module is generic. It takes a tax rate and settings (from the pack through `vatSettingsFor`) and formats with a locale tag passed in, never a built-in one.
- Screens ask the pack for labels ("Province", "VAT number"), region lists and validators instead of importing South African constants.
- **Issued documents snapshot the country and the rules used** (country code, tax rate, price-entry mode, wording that mattered), so a rule change never rewrites history. Quote and invoice tables include these columns from the start.
- A country with no pack is an error, never a silent fallback to South African rules.
- Not yet pluggable, and listed in `docs/locales/README.md`: the app's `lang` attribute, the signup default of ZA, South African wording in the browser tests. Interface language and translation are a separate decision.
- Adding a country is a checklist (`docs/locales/README.md`), not a refactor.
