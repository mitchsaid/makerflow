-- First-quote setup: what a new quote starts with for delivery or collection, and whether the
-- business has been through the two setup questions.
--
-- SECURITY-SENSITIVE: new columns and a column grant on business_profiles. Needs human review
-- before this is applied to any hosted project.
--
-- * usual_fulfilment: null (nothing chosen), 'collection' or 'delivery'. A new quote starts with it.
-- * quote_setup_at: null until an owner or admin answers or skips the setup card on the first
--   New quote (then the time). Businesses that already have a quote are marked as set up.
-- Owners and admins change both through the existing profile policy; the new grant covers the columns.
-- The deposit answer uses the existing default_deposit_* columns.

alter table public.business_profiles
  add column usual_fulfilment text check (usual_fulfilment is null or usual_fulfilment in ('collection', 'delivery')),
  add column quote_setup_at timestamptz;

grant update (usual_fulfilment, quote_setup_at) on public.business_profiles to authenticated;

update public.business_profiles bp
   set quote_setup_at = now()
 where exists (select 1 from public.quotes q where q.organisation_id = bp.organisation_id);
