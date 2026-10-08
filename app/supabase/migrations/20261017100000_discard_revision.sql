-- Discarding a revision: go back to the version that was sent, and drop the changes made since.
--
-- SECURITY-SENSITIVE: a replaced security-definer function, a new server-only function that
-- changes a quote's status and version, new columns on the activity log. Needs human review
-- before this is applied to any hosted project.
--
-- HOW IT WORKS (plan: docs/plans/quote-discard-revision.md)
--
-- * Revising a sent quote turns it back into an editable draft whose lines are the SAME rows that
--   were sent, so editing overwrites them. To be able to go back, the server hands revise_quote
--   the quote as it was (the form values it saves from, p_base) and the 'revised' event keeps it.
-- * Discarding is two steps by our server: it saves that stored copy over the draft with the
--   ordinary draft save (checked and priced like any other save), then calls
--   discard_quote_revision, which moves the quote back to 'sent' at the earlier version and logs
--   it. Only the server can call it (service role), like send_quote and revise_quote; the person's
--   own session has already proved the quote is theirs.
-- * The sent versions in quote_versions are never touched. Version numbers are reused: the next
--   revision is version N again, and no sent version N exists.
-- * Revisions started before this migration have no stored copy (has_base is false); they cannot be
--   discarded, and the screen does not offer it.

alter table public.quote_events
  add column base jsonb,
  add column has_base boolean generated always as (base is not null) stored;

alter table public.quote_events
  add constraint quote_events_base_check
  check (base is null or (kind = 'revised' and jsonb_typeof(base) = 'object' and pg_column_size(base) <= 200000));

alter table public.quote_events drop constraint quote_events_kind_check;
alter table public.quote_events
  add constraint quote_events_kind_check
  check (kind in ('created', 'sent', 'revised', 'accepted', 'declined', 'withdrawn', 'reopened', 'discarded'));

-- ---------------------------------------------------------------------------
-- revise_quote: now also keeps the quote as it was sent. SERVER ONLY.
-- ---------------------------------------------------------------------------

drop function public.revise_quote(uuid, uuid, uuid);

create function public.revise_quote(p_org uuid, p_quote_id uuid, p_actor uuid, p_base jsonb default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
begin
  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org and status = 'sent'
     for update;
  if not found then
    raise exception 'sent quote not found' using errcode = 'P0002';
  end if;
  if p_base is not null and jsonb_typeof(p_base) <> 'object' then
    raise exception 'the stored copy must be an object' using errcode = '22023';
  end if;

  update public.quotes set status = 'draft', version = q.version + 1 where id = q.id;

  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id, base)
  values (p_org, q.id, q.version + 1, 'revised', p_actor, p_base);

  return q.version + 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- discard_quote_revision: a revising draft goes back to the version that was sent. SERVER ONLY.
-- The server has already saved the stored copy over the draft. Returns the version it went back to.
-- Errors: P0002 the quote is not a revision, or has no sent version to go back to.
-- ---------------------------------------------------------------------------

create function public.discard_quote_revision(p_org uuid, p_quote_id uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
begin
  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org and status = 'draft' and version > 1
     for update;
  if not found then
    raise exception 'revising quote not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.quote_versions v
     where v.quote_id = q.id and v.organisation_id = p_org and v.version = q.version - 1
  ) then
    raise exception 'no sent version to go back to' using errcode = 'P0002';
  end if;

  update public.quotes set status = 'sent', version = q.version - 1 where id = q.id;

  -- Logged at the version that was dropped.
  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id)
  values (p_org, q.id, q.version, 'discarded', p_actor);

  return q.version - 1;
end;
$$;

revoke execute on function
  public.revise_quote(uuid, uuid, uuid, jsonb),
  public.discard_quote_revision(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function
  public.revise_quote(uuid, uuid, uuid, jsonb),
  public.discard_quote_revision(uuid, uuid, uuid)
  to service_role;
