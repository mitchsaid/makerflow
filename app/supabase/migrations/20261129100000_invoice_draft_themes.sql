-- Themes on invoice drafts (docs/plans/invoice-themes.md, slice 2): an invoice draft has a theme of its own, chosen
-- on its preview from the same library as a quote's, and a new quote or invoice starts with the theme chosen last,
-- on either (one shared default, as the founder asked, 2026-10-30).
--
-- SECURITY-SENSITIVE (new columns with grants and triggers on a table with row-level security, and a replaced
-- trigger function on quotes). Needs human review before it is applied to any hosted project. Nothing is
-- rewritten: existing drafts have no theme and keep following their quote's, or Classic, until one is chosen.
--
-- * invoice_drafts.theme_id / theme_starter: exactly as on quotes (at most one set; a theme of the SAME business by
--   composite foreign key; deleting a theme clears the reference; the starter must be a known key).
-- * invoice_drafts.theme_picked_at: when a theme was last chosen for the draft, set by a trigger when a theme
--   changes on an update (never by the app); copying a theme in at insert is not a choice.
-- * A new draft with no theme of its own takes the most recently chosen theme of the business, across its quotes
--   AND its invoice drafts; quotes_inherit_theme now looks across both too. (Reading only what the person can
--   already see: both functions are SECURITY INVOKER.)
-- * An issued invoice needs nothing here: its snapshot carries the finished look, so it is locked to it.

alter table public.invoice_drafts
  add column theme_id uuid,
  add column theme_starter text
    check (theme_starter is null or theme_starter in ('classic', 'modern', 'warm', 'bold', 'soft')),
  add column theme_picked_at timestamptz,
  add constraint invoice_drafts_theme_one_of check (theme_id is null or theme_starter is null),
  add constraint invoice_drafts_theme_fk
    foreign key (organisation_id, theme_id) references public.quote_themes (organisation_id, id)
    on delete set null (theme_id);

grant insert (theme_id, theme_starter) on public.invoice_drafts to authenticated;
grant update (theme_id, theme_starter) on public.invoice_drafts to authenticated;

create function public.invoice_drafts_theme_picked()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.theme_id is distinct from old.theme_id or new.theme_starter is distinct from old.theme_starter then
    -- Only a pick counts; a theme cleared because it was deleted (the foreign key does that) does not.
    if new.theme_id is not null or new.theme_starter is not null then
      new.theme_picked_at := clock_timestamp();
    end if;
  end if;
  return new;
end
$$;

-- The theme chosen last in a business, on a quote or an invoice draft.
create function public.invoice_drafts_inherit_theme()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.theme_id is null and new.theme_starter is null then
    select t.theme_id, t.theme_starter
      into new.theme_id, new.theme_starter
      from (
        select q.theme_id, q.theme_starter, q.theme_picked_at from public.quotes q where q.organisation_id = new.organisation_id
        union all
        select d.theme_id, d.theme_starter, d.theme_picked_at from public.invoice_drafts d where d.organisation_id = new.organisation_id
      ) t
     where t.theme_picked_at is not null
       and (t.theme_id is not null or t.theme_starter is not null)
     order by t.theme_picked_at desc
     limit 1;
  end if;
  return new;
end
$$;

create or replace function public.quotes_inherit_theme()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.theme_id is null and new.theme_starter is null then
    select t.theme_id, t.theme_starter
      into new.theme_id, new.theme_starter
      from (
        select q.theme_id, q.theme_starter, q.theme_picked_at from public.quotes q where q.organisation_id = new.organisation_id
        union all
        select d.theme_id, d.theme_starter, d.theme_picked_at from public.invoice_drafts d where d.organisation_id = new.organisation_id
      ) t
     where t.theme_picked_at is not null
       and (t.theme_id is not null or t.theme_starter is not null)
     order by t.theme_picked_at desc
     limit 1;
  end if;
  return new;
end
$$;

revoke all on function public.invoice_drafts_theme_picked() from public, anon, authenticated;
revoke all on function public.invoice_drafts_inherit_theme() from public, anon, authenticated;

create trigger invoice_drafts_theme_picked
  before update on public.invoice_drafts
  for each row execute function public.invoice_drafts_theme_picked();

create trigger invoice_drafts_inherit_theme
  before insert on public.invoice_drafts
  for each row execute function public.invoice_drafts_inherit_theme();
