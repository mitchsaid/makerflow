-- Materials (docs/plans/costs-and-recipes.md, slice 1): what a business buys to make things. A material is bought
-- in a quantity at a price (flour: 12.5 kg for R187,50); what one unit costs is worked out from that, never stored
-- as a rounded cent. Nothing uses materials yet: the process on a product (slice 2) will.
--
-- * unit: one of a fixed list (mass, volume, length, count). Amounts convert only within the same kind of
--   unit; the conversions live in the app (lib/materials/units).
-- * bought_quantity_milli: thousandths of the unit (12,5 kg is 12500), like quote item quantities.
-- * price_cents: what was paid for that quantity, whole cents.
-- * vat_treatment: for a VAT-registered business, what the price paid includes: 'included', 'excluded', or
--   'none' (no VAT was charged, say a supplier who is not a VAT vendor). A business that is not registered
--   always has 'none': the price paid is the cost. The cost without VAT, which margins are worked out on, is
--   derived in the app from this and the locale pack's rate.
-- * Names are unique per business (ignoring case and spaces) among materials that are not archived.
-- * Materials are ARCHIVED, never deleted: processes and jobs will refer to them. There is no delete grant.
--
-- SECURITY-SENSITIVE: new table with row-level security and column grants. Needs human review before it is
-- applied to any hosted project.

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text not null check (unit in ('mg', 'g', 'kg', 'ml', 'l', 'mm', 'cm', 'm', 'each', 'dozen')),
  bought_quantity_milli bigint not null check (bought_quantity_milli between 1 and 9999999999),
  price_cents bigint not null check (price_cents between 0 and 99999999999),
  vat_treatment text not null default 'none' check (vat_treatment in ('included', 'excluded', 'none')),
  -- Optional text is stored as NULL when empty, never as ''.
  supplier text check (supplier is null or char_length(btrim(supplier)) between 1 and 120),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- So later tables (the process of a product) can point at a material OF THEIR OWN business.
  constraint materials_org_id_unique unique (organisation_id, id)
);

create index materials_org_name_idx on public.materials (organisation_id, name);
create unique index materials_org_name_unique
  on public.materials (organisation_id, lower(btrim(name))) where archived_at is null;

create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

-- A business can keep a large but limited number of materials (a sign something has gone wrong beyond it).
create function public.materials_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('materials:' || new.organisation_id::text, 0));
  if (select count(*) from public.materials where organisation_id = new.organisation_id) >= 2000 then
    raise exception 'a business can have at most 2000 materials' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.materials_limit() from public, anon, authenticated;

create trigger materials_limit
  before insert on public.materials
  for each row execute function public.materials_limit();

-- No delete, and the organisation can never be changed after creation.
revoke all on public.materials from anon, authenticated;
grant select on public.materials to authenticated;
grant insert (organisation_id, name, unit, bought_quantity_milli, price_cents, vat_treatment, supplier)
  on public.materials to authenticated;
grant update (name, unit, bought_quantity_milli, price_cents, vat_treatment, supplier, archived_at)
  on public.materials to authenticated;

alter table public.materials enable row level security;

create policy materials_select_members
  on public.materials for select to authenticated
  using (public.is_org_member(organisation_id));

create policy materials_insert_members
  on public.materials for insert to authenticated
  with check (public.is_org_member(organisation_id));

create policy materials_update_members
  on public.materials for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.materials
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));
