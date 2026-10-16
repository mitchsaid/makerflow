-- A customer's delivery address as structured parts, like their main address, with "same as the address above" as the
-- default (docs/plans/quote-form-feedback-2.md, slice 2).
--
-- * delivery_same_as_main (default true): the customer is delivered to at their main address.
-- * delivery_address_line1, _line2, delivery_city, delivery_region, delivery_postal_code: used only when it is false.
--   The shape follows the country (the locale pack decides the labels and the region list), the same as the main address.
-- * The old single free-text column (delivery_address) is kept as a backup and is no longer read or written by the app.
--   A customer that had one keeps it: it is carried into delivery_address_line1 (newlines turned into ", ") with
--   "same as above" off, so nothing is lost and the maker can tidy it into parts. A later clean-up migration drops the
--   old column once this has been checked on hosted data.

alter table public.customers
  add column delivery_same_as_main boolean not null default true,
  add column delivery_address_line1 text
    -- Up to 400: a carried-over free-text address fits; the form itself allows 120.
    check (delivery_address_line1 is null or char_length(delivery_address_line1) between 1 and 400),
  add column delivery_address_line2 text
    check (delivery_address_line2 is null or char_length(delivery_address_line2) between 1 and 120),
  add column delivery_city text
    check (delivery_city is null or char_length(delivery_city) between 1 and 80),
  add column delivery_region text
    check (delivery_region is null or char_length(delivery_region) between 1 and 80),
  add column delivery_postal_code text
    check (delivery_postal_code is null or char_length(delivery_postal_code) between 1 and 20),
  -- "Same as above" carries no separate address.
  add constraint customers_delivery_same_has_no_parts check (
    not delivery_same_as_main
    or (delivery_address_line1 is null and delivery_address_line2 is null and delivery_city is null
        and delivery_region is null and delivery_postal_code is null)
  );

-- Carry over what is already there.
update public.customers
set delivery_same_as_main = false,
    delivery_address_line1 = left(
      btrim(regexp_replace(regexp_replace(delivery_address, E'\\s*\\n\\s*', ', ', 'g'), E'\\s+', ' ', 'g')), 400)
where delivery_address is not null
  and btrim(delivery_address) <> '';

grant insert (
  delivery_same_as_main, delivery_address_line1, delivery_address_line2, delivery_city, delivery_region, delivery_postal_code
) on public.customers to authenticated;
grant update (
  delivery_same_as_main, delivery_address_line1, delivery_address_line2, delivery_city, delivery_region, delivery_postal_code
) on public.customers to authenticated;
