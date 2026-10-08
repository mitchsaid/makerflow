-- A product's usual VAT treatment: standard-rated (the default), zero-rated or exempt. A quote item
-- made from the product starts with it (the item keeps its own copy and can be changed).
--
-- SECURITY-SENSITIVE: a new column and grants on products (money and tax data). Needs human review
-- before this is applied to any hosted project. Same row-level security as the rest of the table.

alter table public.products
  add column vat_status text not null default 'standard' check (vat_status in ('standard', 'zero', 'exempt'));

grant insert (vat_status), update (vat_status) on public.products to authenticated;
