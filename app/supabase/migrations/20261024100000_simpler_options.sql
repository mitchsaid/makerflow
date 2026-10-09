-- Simpler options (founder 2026-10-09, docs/plans/product-choices.md, "Simpler options"):
--
-- * No more "once for the item line": every option's amount is added to each item. A charge for the
--   whole order (a setup or design fee, a box) is its own item on the quote.
-- * "Choose one" always needs a choice. To make it optional, the maker adds a choice like "None".
--
-- DATA / MONEY: changes stored options and how their amounts count. Needs human review before this is
-- applied to any hosted project. Sent versions (quote_versions snapshots) are frozen and keep what they
-- showed; drafts are priced again the next time they are saved.

-- Options charged once for the line are now charged for each item. The column stays (save_product
-- still writes it, as 'item'), but 'item' is the only value.
update public.product_option_groups set charge = 'item' where charge = 'line';
alter table public.product_option_groups drop constraint product_option_groups_charge_check;
alter table public.product_option_groups add constraint product_option_groups_charge_check check (charge = 'item');
comment on column public.product_option_groups.charge is
  'Always ''item'' since 20261024100000_simpler_options: an option''s amount is added to each item.';

-- "Choose one" always needs a choice.
update public.product_option_groups set required = true where kind = 'one' and not required;
alter table public.product_option_groups
  add constraint product_option_groups_one_required check (kind <> 'one' or required);

-- Quote items keep their own copy of the options chosen: those copied as "once for the line" become
-- "for each item", so a revision or a draft is priced the new way when it is next saved.
update public.quote_lines l
   set options = (
     select jsonb_agg(
              case when e ->> 'charge' = 'line' then jsonb_set(e, '{charge}', '"item"') else e end
              order by n)
       from jsonb_array_elements(l.options) with ordinality as x(e, n)
   )
 where l.options @> '[{"charge": "line"}]';
