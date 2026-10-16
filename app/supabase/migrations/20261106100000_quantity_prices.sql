-- Quantity prices (docs/plans/quantity-prices-and-steps.md, slice 1): a product can lower its price when more is
-- ordered. Each row says "from this quantity, this percent off" the item's own price (the product's, or the chosen
-- variation's); the options and extras on an item are not reduced. On a quote the item's price follows the quantity
-- until the maker types their own, so the database stores only the rows: a quote line keeps the price it was given.
--
-- SECURITY-SENSITIVE: new table with row-level security and column grants, and a new SECURITY INVOKER function.
-- Needs human review before it is applied to any hosted project. Nothing existing is changed or dropped.
--
-- * product_price_breaks: one row per quantity step. from_quantity_milli is thousandths of the unit, like quote item
--   quantities (a break "from 10" is 10000). percent_off_bp is hundredths of a percent (1000 is 10%), above 0 and
--   below 100%. A quantity appears once per product. At most 10 rows per product.
-- * save_product_layers: saves a product exactly as save_product does, then the layers that came after it. This
--   slice adds p_price_breaks (null leaves them as they are; a list replaces them). It wraps save_product so the
--   large function is not replaced again, and everything stays in one transaction, under the person's own access.
-- ---------------------------------------------------------------------------

create table public.product_price_breaks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  product_id uuid not null,
  from_quantity_milli bigint not null check (from_quantity_milli between 1 and 9999999999),
  percent_off_bp integer not null check (percent_off_bp between 1 and 9999),
  created_at timestamptz not null default now(),
  constraint product_price_breaks_org_id_unique unique (organisation_id, id),
  constraint product_price_breaks_quantity_unique unique (product_id, from_quantity_milli),
  constraint product_price_breaks_product_same_org
    foreign key (organisation_id, product_id) references public.products (organisation_id, id)
    on delete cascade
);

create index product_price_breaks_product_idx on public.product_price_breaks (organisation_id, product_id, from_quantity_milli);

-- A product has at most 10 quantity prices.
create function public.product_price_breaks_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('product_price_breaks:' || new.product_id::text, 0));
  if (select count(*) from public.product_price_breaks where product_id = new.product_id) >= 10 then
    raise exception 'a product can have at most 10 quantity prices' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.product_price_breaks_limit() from public, anon, authenticated;

create trigger product_price_breaks_limit
  before insert on public.product_price_breaks
  for each row execute function public.product_price_breaks_limit();

-- Members manage them, like products. They can be removed: a quote line keeps its own price.
revoke all on public.product_price_breaks from anon, authenticated;
grant select, delete on public.product_price_breaks to authenticated;
grant insert (organisation_id, product_id, from_quantity_milli, percent_off_bp) on public.product_price_breaks to authenticated;
grant update (from_quantity_milli, percent_off_bp) on public.product_price_breaks to authenticated;

alter table public.product_price_breaks enable row level security;

create policy product_price_breaks_select_members
  on public.product_price_breaks for select to authenticated
  using (public.is_org_member(organisation_id));

create policy product_price_breaks_insert_members
  on public.product_price_breaks for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy product_price_breaks_update_members
  on public.product_price_breaks for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy product_price_breaks_delete_members
  on public.product_price_breaks for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.product_price_breaks
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- save_product_layers
--
-- p_price_breaks: null leaves the product's quantity prices as they are; a list ([{from_quantity_milli,
-- percent_off_bp}, ...]) replaces them. Errors: 22023 when the list is not valid; 54000 when it has more than 10 rows;
-- 23505 when a quantity is repeated; everything save_product raises.
-- ---------------------------------------------------------------------------
create function public.save_product_layers(
  p_org uuid,
  p_product_id uuid,
  p_product jsonb,
  p_variations jsonb,
  p_options jsonb default null,
  p_extras jsonb default null,
  p_price_breaks jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pid uuid;
  b jsonb;
begin
  if p_price_breaks is not null then
    if jsonb_typeof(p_price_breaks) <> 'array' then
      raise exception 'quantity prices must be a list' using errcode = '22023';
    end if;
    if jsonb_array_length(p_price_breaks) > 10 then
      raise exception 'a product can have at most 10 quantity prices' using errcode = '54000';
    end if;
    for b in select * from jsonb_array_elements(p_price_breaks) loop
      if jsonb_typeof(b) <> 'object'
         or (b ->> 'from_quantity_milli') is null or (b ->> 'from_quantity_milli') !~ '^[0-9]{1,10}$'
         or (b ->> 'percent_off_bp') is null or (b ->> 'percent_off_bp') !~ '^[0-9]{1,4}$' then
        raise exception 'a quantity price is not valid' using errcode = '22023';
      end if;
    end loop;
  end if;

  pid := public.save_product(p_org, p_product_id, p_product, p_variations, p_options, p_extras);

  if p_price_breaks is not null then
    delete from public.product_price_breaks where product_id = pid and organisation_id = p_org;
    insert into public.product_price_breaks (organisation_id, product_id, from_quantity_milli, percent_off_bp)
    select p_org, pid, (e.value ->> 'from_quantity_milli')::bigint, (e.value ->> 'percent_off_bp')::integer
      from jsonb_array_elements(p_price_breaks) with ordinality as e(value, ord)
     order by e.ord;
  end if;

  return pid;
end;
$$;

revoke execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_product_layers(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
