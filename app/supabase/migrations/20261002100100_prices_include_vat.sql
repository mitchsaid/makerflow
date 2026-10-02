-- VAT price entry mode: does the business type its prices including VAT or excluding VAT?
-- Only meaningful for VAT-registered businesses (others never show VAT). Default is
-- "including", because quoted prices to the public must include VAT (VAT Act section 65;
-- see docs/locales/za/vat-and-documents.md). Owners and admins can change it, like the
-- rest of the business profile.
--
-- SECURITY-SENSITIVE: a new column on a table with row-level security and column grants.

alter table public.business_profiles
  add column prices_include_vat boolean not null default true;

grant update (prices_include_vat) on public.business_profiles to authenticated;
