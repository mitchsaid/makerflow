-- Simpler options (founder 2026-10-09, docs/plans/product-choices.md, "Simpler options"):
--
-- * No more "once for the item line": every option's amount is added to each item. A charge for the
--   whole order (a setup or design fee, a box) is its own item on the quote.
-- * "Choose one" always needs a choice. To make it optional, the maker adds a choice like "None".
--
-- DATA / MONEY: changes stored options and quote items. Needs human review before this is applied to any
-- hosted project. Nothing on a quote changes price:
-- * an extra charged once for an item line, already on a quote, becomes its own item (quantity 1, that
--   amount, the same VAT treatment) right after it, as the new rule says. One difference: if that item
--   had its own discount, the discount no longer covers the extra;
-- * sent versions (quote_versions snapshots) are frozen and keep what they showed.
-- What changes is the PRODUCTS: an option that was charged once ("Gift box +R30 once") is now added to
-- each item ("+R30 each") on new quotes.

-- ---------------------------------------------------------------------------
-- 1. Once-per-line extras already on quotes become their own items.
-- ---------------------------------------------------------------------------

-- Make room: the quotes concerned get their items' order spread out, well above any order in use
-- (orders are unique per quote, and checked row by row).
update public.quote_lines l
   set sort_order = 1000000 + l.sort_order * 101
 where l.quote_id in (select quote_id from public.quote_lines where options @> '[{"charge": "line"}]');

-- Each such extra, as an item right after the one it was on, in the order it was chosen.
insert into public.quote_lines (
  organisation_id, quote_id, sort_order, kind, product_id, name, quantity_milli, unit_price_cents,
  discount_kind, discount_value, vat_status, options
)
select l.organisation_id, l.quote_id, l.sort_order + x.n::integer, 'custom', null,
       left(btrim((x.e ->> 'group') || ': ' || coalesce(nullif(x.e ->> 'value', ''), x.e ->> 'text', '')), 200),
       1000, (x.e ->> 'amount_cents')::bigint, 'none', 0, l.vat_status, '[]'::jsonb
  from public.quote_lines l
  cross join lateral jsonb_array_elements(l.options) with ordinality as x(e, n)
 where l.options @> '[{"charge": "line"}]'
   and x.e ->> 'charge' = 'line';

-- The item keeps the rest of its options, in order.
update public.quote_lines l
   set options = coalesce((
     select jsonb_agg(x.e order by x.n)
       from jsonb_array_elements(l.options) with ordinality as x(e, n)
      where x.e ->> 'charge' is distinct from 'line'
   ), '[]'::jsonb)
 where l.options @> '[{"charge": "line"}]';

-- Number the items 0, 1, 2 ... again, in the new order.
update public.quote_lines l
   set sort_order = r.n
  from (
    select id, (row_number() over (partition by quote_id order by sort_order) - 1)::integer as n
      from public.quote_lines
     where sort_order >= 1000000
  ) r
 where l.id = r.id;

-- ---------------------------------------------------------------------------
-- 2. Options: added to each item.
-- ---------------------------------------------------------------------------

-- The column stays (save_product still writes it, as 'item'), but 'item' is the only value.
update public.product_option_groups set charge = 'item' where charge = 'line';
alter table public.product_option_groups drop constraint product_option_groups_charge_check;
alter table public.product_option_groups add constraint product_option_groups_charge_check check (charge = 'item');
comment on column public.product_option_groups.charge is
  'Always ''item'' since 20261024100000_simpler_options: an option''s amount is added to each item.';

-- ---------------------------------------------------------------------------
-- 3. "Choose one" always needs a choice. One that could be left empty gets a "None" choice (R0, on
--    every size when priced by size), so it can still be left as nothing.
-- ---------------------------------------------------------------------------

with optional as (
  select g.id, g.organisation_id, g.price_by_variation, g.product_id
    from public.product_option_groups g
   where g.kind = 'one' and not g.required
     and not exists (
       select 1 from public.product_option_values v where v.group_id = g.id and lower(btrim(v.name)) = 'none'
     )
     and (select count(*) from public.product_option_values v where v.group_id = g.id) < 50
),
added as (
  insert into public.product_option_values (organisation_id, group_id, name, price_cents, usual, sort_order)
  select o.organisation_id, o.id, 'None', 0, false,
         least(1000, coalesce((select max(v.sort_order) + 1 from public.product_option_values v where v.group_id = o.id), 0))
    from optional o
  returning id, group_id, organisation_id
)
insert into public.product_option_value_prices (organisation_id, value_id, variation_id, price_cents)
select a.organisation_id, a.id, pv.id, 0
  from added a
  join public.product_option_groups g on g.id = a.group_id
  join public.product_variations pv on pv.product_id = g.product_id and pv.organisation_id = g.organisation_id
 where g.price_by_variation;

update public.product_option_groups set required = true where kind = 'one' and not required;
alter table public.product_option_groups
  add constraint product_option_groups_one_required check (kind <> 'one' or required);
