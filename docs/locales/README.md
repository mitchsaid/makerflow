# Locale packs: country-specific rules

The product starts in South Africa and is meant to support other countries later. So **every rule that depends on the country lives in a locale pack**, selected by the business's country code, and every research note about such a rule lives in that country's folder here.

## The pattern
| What | Where |
|---|---|
| The pack (code): tax, money style, address shape, document wording and requirements | `app/src/lib/locale/<cc>.ts`, typed by `LocalePack` in `app/src/lib/locale/types.ts` |
| The registry (which countries exist, lookup by country code) | `app/src/lib/locale/index.ts` (`getLocalePack`) |
| The research behind each rule, with sources and how confident we are | `docs/locales/<cc>/` (South Africa: `docs/locales/za/vat-and-documents.md`) |
| Which country a business belongs to | `business_profiles.country_code` (ISO 3166-1, already in the database; currency in `currency_code`) |
| Decision record | `docs/adr/0004-locale-packs.md` |

## What belongs in a pack
- Tax: its name, registration number format and label, the standard rate, the invoice threshold (South Africa: R5 000), the wording that must appear when prices include tax.
- Document wording and titles ("Quotation", "This quotation is not a tax invoice").
- What the business must provide before it can send a quote or issue an invoice.
- Address shape: region label (province, state ...), the list of regions, the postal code rule.
- Default currency and the locale tag used to format money, numbers and dates.

## What does NOT belong in a pack
Anything true everywhere: the money arithmetic (`app/src/lib/money`), the order of calculation, sequential gapless numbering, immutability of issued documents, row-level security. Those stay generic. The money module knows nothing about any country; it receives the tax rate and settings from the pack.

## Rules for working with packs
1. **No country-specific rule outside a pack.** If a screen or function needs to know a rate, a wording, a threshold or a format, it asks the business's pack (`getLocalePack(profile.countryCode)`).
2. **Issued documents snapshot the country and the rules used** (country code, tax rate, price-entry mode, wording that mattered). A later change to a pack never alters a document already issued. (Applies from the quotes slice onward; quotes and invoices store these fields.)
3. **Unsupported countries fail loudly** (`UnsupportedCountryError`), never fall back to South African rules.
4. **Every pack has tests** and a research note with its sources; claims are marked verified or unverified.

## Adding a country (checklist)
1. Write `app/src/lib/locale/<cc>.ts` exporting a `LocalePack`; register it in `app/src/lib/locale/index.ts`.
2. Write `docs/locales/<cc>/` notes: tax and invoice rules, quotation rules, consumer-law rules that bite, the minimum business details, with sources and confidence.
3. Add unit tests for the pack (validators, wording, requirements).
4. Check the database: `country_code` is already stored; allow the new code where the signup flow offers a country; add any country-specific constraints as additive migrations only.
5. Browser tests for the visible differences (labels, region list, wording).
6. Translation is a separate decision: this pack governs rules and formats, not the interface language.

## Known places that still assume South Africa (not yet pluggable)
- `app/src/app/layout.tsx` sets `lang="en-ZA"` for the whole app.
- New businesses default to `country_code = 'ZA'` and `currency_code = 'ZAR'` (database defaults); signup has no country choice yet.
- The browser tests contain South African wording and data (provinces, VAT numbers).
- Sample text such as placeholders ("e.g. Sweet Nothings Confectionery") is not localised.
