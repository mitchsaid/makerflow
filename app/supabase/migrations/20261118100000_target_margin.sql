-- The margin a maker aims for (docs/plans/costing-slice-c.md; founder, 2026-10-22: "costing slice C: target margin and
-- price hints").
--
-- Money-adjacent, a new column with a column grant on the business profile. Needs human review before it is applied to
-- any hosted project. It changes no existing data and no function.
--
-- * business_profiles.target_margin_bp: the margin the business aims for, in basis points (100 to 9900: 1% to 99%), or
--   null when it has not said. Owners and admins change it through the existing profile update policy and a column
--   grant, exactly like labour_rate_cents. It is used by the app to say where a product or a quote stands and to
--   suggest a price; nothing is stored or frozen from it (a sent quote is judged against the target as it is now).

alter table public.business_profiles
  add column target_margin_bp integer check (target_margin_bp is null or target_margin_bp between 100 and 9900);
grant update (target_margin_bp) on public.business_profiles to authenticated;
