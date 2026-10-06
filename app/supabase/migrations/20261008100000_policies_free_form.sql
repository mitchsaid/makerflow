-- Policies lose their fixed headings: a policy is a title and some wording, nothing more.
--
-- * policies.kind (one of five headings) is no longer required or limited. The column stays, empty
--   for new policies, so nothing a business wrote is lost; the app no longer reads or writes it.
-- * The library used to be ordered by heading, then sort_order. So that every business's list reads
--   the same as before, sort_order is renumbered once in that old order (per business, 0, 1, 2 ...).
-- * quotes.policies (the quote's own copy) and the policy snapshots may still carry a "kind" in
--   older rows; it is ignored.
-- No new table, no change to who can read or write: the existing policies and grants are untouched.

alter table public.policies drop constraint policies_kind_check;
alter table public.policies alter column kind drop not null;

with ranked as (
  select id,
    row_number() over (
      partition by organisation_id
      order by
        case kind
          when 'changes' then 0
          when 'cancellation' then 1
          when 'variations' then 2
          when 'client_responsibilities' then 3
          when 'liability_aftercare' then 4
          else 5
        end,
        sort_order,
        title
    ) - 1 as n
  from public.policies
)
update public.policies p set sort_order = r.n from ranked r where p.id = r.id;

drop index public.policies_org_kind_idx;
create index policies_org_order_idx on public.policies (organisation_id, sort_order);
