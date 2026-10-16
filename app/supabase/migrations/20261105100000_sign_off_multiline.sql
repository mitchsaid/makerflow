-- The sign-off becomes a multi-line box (founder, 2026-10-16: "the text field size for sign off should be multiline").
-- Needs human review: two check constraints widened, nothing else.
--
-- * quotes.sign_off and business_profiles.default_sign_off may now be up to 500 characters (was 200), line breaks
--   included. The app limits it to 5 lines; the database only holds the length.
--
-- A quote that was sent keeps the sign-off it was sent with (its snapshot). No function changes: save_quote_draft and
-- the wording update only pass the text through.

alter table public.quotes drop constraint quotes_sign_off_check;
alter table public.quotes
  add constraint quotes_sign_off_check check (sign_off is null or char_length(sign_off) between 1 and 500);

alter table public.business_profiles drop constraint business_profiles_default_sign_off_check;
alter table public.business_profiles
  add constraint business_profiles_default_sign_off_check
    check (default_sign_off is null or char_length(default_sign_off) between 1 and 500);
