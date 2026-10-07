-- Quote designs: which of the five designs a quote uses, the business's brand colour, and what a
-- maker changed from a design's own look.
--
-- SECURITY-SENSITIVE (new columns with grants on tables with row-level security). Needs human review
-- before it is applied to any hosted project. Decisions in docs/plans/quote-looks.md.
--
-- * business_profiles.brand_color ('#rrggbb' or null), default_design and default_design_options:
--   what a quote uses unless it says otherwise. Owners and admins change them (the existing profile
--   policy), under Quotes and invoices.
-- * quotes.design and quotes.design_options: this quote's own choice. Null means "follow the
--   business's default", worked out when the quote is previewed or sent. Only a draft can change
--   (the existing update policy): a sent version stores the finished look in its snapshot.
-- * The options are a small object of known choices. The database only checks that it is an object of
--   a sane size; the app drops anything it does not recognise (lib/quotes/designs.ts).
-- No new table. Existing row-level security and session_required cover the new columns.

alter table public.business_profiles
  add column brand_color text
    check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$'),
  add column default_design text
    check (default_design is null or default_design in ('classic', 'modern', 'warm', 'bold', 'soft')),
  add column default_design_options jsonb not null default '{}'::jsonb
    check (jsonb_typeof(default_design_options) = 'object' and octet_length(default_design_options::text) <= 600);

grant update (brand_color, default_design, default_design_options) on public.business_profiles to authenticated;

alter table public.quotes
  add column design text
    check (design is null or design in ('classic', 'modern', 'warm', 'bold', 'soft')),
  add column design_options jsonb
    check (design_options is null or (jsonb_typeof(design_options) = 'object' and octet_length(design_options::text) <= 600));

grant update (design, design_options) on public.quotes to authenticated;
