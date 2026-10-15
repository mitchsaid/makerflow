-- "Your usual" for the quote form (docs/plans/quote-form-feedback.md, slice B). Needs human review (a business
-- profile column, a widened check on the deposit default and an update grant).
--
-- * business_profiles.default_description: the introduction a new quote starts with, set from a quote ("Save as my
--   usual") or under Quotes and invoices, like the sign-off and "other ways to pay" that already work this way.
-- * business_profiles.default_deposit_kind may now be 'ask': the business decides the deposit on every quote, so a
--   new quote opens with the deposit choice in front of them and nothing chosen. The value stays 0, like 'none'.
--
-- Only these two columns change. A quote still stores a real deposit or none; nothing about a sent quote changes.
-- Owners and admins set the usuals (the existing business_profiles update policy already limits who can).

alter table public.business_profiles
  add column default_description text
    check (default_description is null or char_length(default_description) between 1 and 2000);

alter table public.business_profiles drop constraint business_profiles_default_deposit_kind_check;
alter table public.business_profiles
  add constraint business_profiles_default_deposit_kind_check
    check (default_deposit_kind in ('none', 'percent', 'fixed', 'ask')),
  add constraint business_profiles_deposit_ask_is_zero
    check (default_deposit_kind <> 'ask' or default_deposit_value = 0);

grant update (default_description) on public.business_profiles to authenticated;
