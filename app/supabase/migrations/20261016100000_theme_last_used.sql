-- Themes: a new quote starts with the theme last chosen (no separate "usual theme" setting), and a
-- picture can be a quote's background.
--
-- SECURITY-SENSITIVE (a column with a trigger on a table with row-level security, columns dropped, a
-- check widened). Needs human review before it is applied to any hosted project. Decisions in
-- docs/plans/quote-themes.md.
--
-- * quotes.theme_picked_at: when a theme was last chosen for the quote (set by a trigger whenever
--   theme_id or theme_starter changes on an update; never by the app).
-- * A new quote with no theme of its own takes the theme of the business's most recently chosen one
--   (a before-insert trigger, security invoker: it only reads quotes the person can already see). Taking
--   a theme this way is not itself a choice, so it does not count as "last chosen".
-- * Drops business_profiles.default_theme_id and default_theme_starter.
-- * images.kind also allows 'background' (a full-page picture behind a quote).

alter table public.business_profiles
  drop column default_theme_id,
  drop column default_theme_starter;

alter table public.quotes add column theme_picked_at timestamptz;

create function public.quotes_theme_picked()
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

create function public.quotes_inherit_theme()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.theme_id is null and new.theme_starter is null then
    select q.theme_id, q.theme_starter
      into new.theme_id, new.theme_starter
      from public.quotes q
     where q.organisation_id = new.organisation_id
       and q.theme_picked_at is not null
       and (q.theme_id is not null or q.theme_starter is not null)
     order by q.theme_picked_at desc
     limit 1;
  end if;
  return new;
end
$$;

revoke all on function public.quotes_theme_picked() from public, anon, authenticated;
revoke all on function public.quotes_inherit_theme() from public, anon, authenticated;

create trigger quotes_theme_picked
  before update on public.quotes
  for each row execute function public.quotes_theme_picked();

create trigger quotes_inherit_theme
  before insert on public.quotes
  for each row execute function public.quotes_inherit_theme();

alter table public.images drop constraint images_kind_check;
alter table public.images
  add constraint images_kind_check check (kind in ('product', 'logo', 'background'));
