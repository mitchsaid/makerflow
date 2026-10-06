-- What the business makes or sells, so the app can put the examples that fit first.
--
-- business_profiles.business_types:
--   null  = never asked
--   {}    = asked and skipped
--   {...} = the keys the maker ticked (the app owns the list of valid keys, so adding a type
--           needs no migration; the database only limits the size)
-- Same row-level security as the rest of the profile (members read; owners and admins change):
-- the existing policies cover the new column; only the update grant is new. No new table.
--
-- Small and plain: never used for marketing and not sent anywhere (docs/plans/business-type.md).

alter table public.business_profiles
  add column business_types text[]
    check (
      business_types is null
      or (
        cardinality(business_types) <= 10
        and octet_length(array_to_string(business_types, ',')) <= 300
      )
    );

grant update (business_types) on public.business_profiles to authenticated;
