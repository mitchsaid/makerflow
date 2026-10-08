-- Quote themes: a business's own saved looks for its quotes (and, later, invoices), replacing the
-- first designs' "pick a default and override it" columns.
--
-- SECURITY-SENSITIVE (a new table with row-level security and role-based write policies, new
-- columns with grants on tables with row-level security). Needs human review before it is applied
-- to any hosted project. Decisions in docs/plans/quote-themes.md.
--
-- * public.quote_themes: a named, whole look (a spec: every part has a value) per business. Every
--   member can read them (they pick one for a quote); only owners and admins create, change and
--   delete them (it is the business's look, like its logo). At most 30 per business, a spec of at most
--   2 KB; the app keeps only the choices it knows (lib/quotes/themes.ts).
-- * The five starter themes ship with the app, not as rows. quotes.theme_starter and
--   business_profiles.default_theme_starter name one; theme_id names a business theme (same business,
--   by composite foreign key). At most one of the two is set; neither means "follow the default" on a
--   quote, and "Classic" for the business default. Deleting a theme in use clears the reference (its
--   drafts follow the default; sent versions carry their finished look in their snapshot).
-- * Drops the first designs' columns: quotes.design and design_options, business_profiles.brand_color,
--   default_design and default_design_options.
-- Existing row-level security and session_required cover the new columns.

alter table public.quotes
  drop column design,
  drop column design_options;

alter table public.business_profiles
  drop column brand_color,
  drop column default_design,
  drop column default_design_options;

create table public.quote_themes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  spec jsonb not null
    check (jsonb_typeof(spec) = 'object' and octet_length(spec::text) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_themes_org_id_unique unique (organisation_id, id)
);

create index quote_themes_org_idx on public.quote_themes (organisation_id, created_at);

create trigger quote_themes_set_updated_at
  before update on public.quote_themes
  for each row execute function public.set_updated_at();

-- At most 30 themes a business (counted under the caller's own access, which sees them all).
create function public.quote_themes_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- One insert at a time per business, so two at once cannot both pass the count.
  perform pg_advisory_xact_lock(hashtextextended(new.organisation_id::text, 0));
  if (select count(*) from public.quote_themes where organisation_id = new.organisation_id) >= 30 then
    raise exception 'a business can have at most 30 themes' using errcode = '54000';
  end if;
  return new;
end
$$;

-- Only the trigger runs it (nobody calls it).
revoke all on function public.quote_themes_limit() from public, anon, authenticated;

create trigger quote_themes_limit
  before insert on public.quote_themes
  for each row execute function public.quote_themes_limit();

-- The business can never be changed after creation.
revoke all on public.quote_themes from anon, authenticated;
grant select, delete on public.quote_themes to authenticated;
grant insert (organisation_id, name, spec) on public.quote_themes to authenticated;
grant update (name, spec) on public.quote_themes to authenticated;

alter table public.quote_themes enable row level security;

create policy quote_themes_select_members
  on public.quote_themes for select to authenticated
  using (public.is_org_member(organisation_id));

create policy quote_themes_insert_admins
  on public.quote_themes for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner', 'admin']));

create policy quote_themes_update_admins
  on public.quote_themes for update to authenticated
  using (public.has_org_role(organisation_id, array['owner', 'admin']))
  with check (public.has_org_role(organisation_id, array['owner', 'admin']));

create policy quote_themes_delete_admins
  on public.quote_themes for delete to authenticated
  using (public.has_org_role(organisation_id, array['owner', 'admin']));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.quote_themes
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- A quote's theme, and the business's default
-- ---------------------------------------------------------------------------

alter table public.quotes
  add column theme_id uuid,
  add column theme_starter text
    check (theme_starter is null or theme_starter in ('classic', 'modern', 'warm', 'bold', 'soft')),
  add constraint quotes_theme_one_of check (theme_id is null or theme_starter is null),
  add constraint quotes_theme_fk
    foreign key (organisation_id, theme_id) references public.quote_themes (organisation_id, id)
    on delete set null (theme_id);

-- Only a draft can change (the existing update policy): a sent version keeps its finished look.
grant update (theme_id, theme_starter) on public.quotes to authenticated;

alter table public.business_profiles
  add column default_theme_id uuid,
  add column default_theme_starter text
    check (default_theme_starter is null or default_theme_starter in ('classic', 'modern', 'warm', 'bold', 'soft')),
  add constraint business_profiles_theme_one_of check (default_theme_id is null or default_theme_starter is null),
  add constraint business_profiles_theme_fk
    foreign key (organisation_id, default_theme_id) references public.quote_themes (organisation_id, id)
    on delete set null (default_theme_id);

grant update (default_theme_id, default_theme_starter) on public.business_profiles to authenticated;
