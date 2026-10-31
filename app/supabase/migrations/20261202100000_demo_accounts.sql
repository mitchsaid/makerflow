-- Public demo accounts (docs/plans/demo-accounts.md; docs/product-brief.md, section 4a): a visitor tries MakerFlow
-- without signing up, in a private sandbox of their own. The sandbox is an ordinary business, flagged as a demo and
-- given an expiry, that belongs to an anonymous sign-in.
--
-- SECURITY-SENSITIVE (anonymous access, a new security-definer function, new columns that decide what a business
-- may do). Needs human review before it is applied to any hosted project.
--
-- * organisations.demo_kind / demo_expires_at: which sample business this is, and when it is thrown away. Both are
--   empty for a real business, or both set. Nobody can write them through the app: the table's only update grant is
--   the name (migration 20260929000000), and the one way to set them is create_demo_organisation below.
-- * create_demo_organisation(kind, name): callable only by a signed-in ANONYMOUS visitor (the session's own token
--   says so; the browser cannot claim it). It makes the visitor's one demo business (or returns the one they have),
--   through ensure_organisation, then flags it. A real person with an email address cannot make one, so this cannot
--   be used to flag a real business as a demo (and so make it deletable) or to get a free 6-hour sandbox beside a
--   real account. At most 300 demos are alive at a time, so a script cannot fill the database (errcode 54000).
-- * The sample content is built by the server, as the visitor, through the same tables and functions a maker uses
--   (lib/demo). Nothing here creates content.
-- * Cleaning up: the server deletes expired demos with delete_account (which refuses a business with issued invoices:
--   a demo never has one, see the plan) and then the anonymous sign-in.

alter table public.organisations
  add column demo_kind text check (demo_kind is null or demo_kind in ('baker', 'woodworker', 'seamstress', 'ceramicist')),
  add column demo_expires_at timestamptz,
  add constraint organisations_demo_consistent check ((demo_kind is null) = (demo_expires_at is null));

create index organisations_demo_expiry_idx on public.organisations (demo_expires_at) where demo_expires_at is not null;

create function public.create_demo_organisation(p_kind text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Only an anonymous visitor: the claim comes from the verified token, not from anything the browser sends.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then
    raise exception 'a demo is for visitors who have not signed in' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('baker', 'woodworker', 'seamstress', 'ceramicist') then
    raise exception 'unknown kind of demo' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('demo:' || uid::text, 0));

  -- The visitor already has a demo: it is theirs.
  select m.organisation_id into org
    from public.memberships m
    join public.organisations o on o.id = m.organisation_id
   where m.user_id = uid and o.demo_kind is not null
   order by m.created_at
   limit 1;
  if org is not null then
    return org;
  end if;

  if (select count(*) from public.organisations where demo_expires_at > now()) >= 300 then
    raise exception 'too many demos at the moment' using errcode = '54000';
  end if;

  org := public.ensure_organisation(p_name);
  update public.organisations
     set demo_kind = p_kind, demo_expires_at = now() + interval '6 hours'
   where id = org and demo_kind is null;
  return org;
end;
$$;

revoke all on function public.create_demo_organisation(text, text) from public, anon;
grant execute on function public.create_demo_organisation(text, text) to authenticated;
