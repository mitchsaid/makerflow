-- Quote outcomes: the maker records what their customer said (accepted, declined), withdraws a
-- quote, or changes an answer.
--
-- SECURITY-SENSITIVE: a new security-definer function that changes a quote's status.
-- Needs human review before this is applied to any hosted project.
--
-- HOW IT WORKS (decisions in docs/plans/quote-outcomes.md)
--
-- * The answer lives in the activity log. Each answer is an event ('accepted', 'declined',
--   'withdrawn', 'reopened') with the day, how the customer said it, and a note. The quote itself
--   only has its status; what a screen shows about the answer is the latest event.
-- * Only our server (the service role) can change the status, like send_quote and revise_quote.
--   The server has already checked, with the person's own session, that the quote is theirs.
-- * Allowed moves: sent -> accepted | declined | withdrawn, and accepted | declined -> sent
--   (reopened, so a different answer can be recorded). Withdrawn is final.

alter table public.quote_events
  add column on_date date,
  add column how text check (how is null or how in ('whatsapp', 'email', 'in_person', 'phone', 'other')),
  add column note text check (note is null or char_length(note) <= 500);

alter table public.quote_events drop constraint quote_events_kind_check;
alter table public.quote_events
  add constraint quote_events_kind_check
  check (kind in ('created', 'sent', 'revised', 'accepted', 'declined', 'withdrawn', 'reopened'));

-- The day and the way belong to an answer from the customer, and to nothing else; a note goes
-- with an answer or a withdrawal.
alter table public.quote_events
  add constraint quote_events_answer_details
  check (
    ((kind in ('accepted', 'declined')) = (on_date is not null and how is not null))
    and (kind in ('accepted', 'declined') or (on_date is null and how is null))
    and (note is null or kind in ('accepted', 'declined', 'withdrawn'))
  );

-- ---------------------------------------------------------------------------
-- record_quote_outcome. SERVER ONLY (service role).
--
-- p_outcome: 'accepted' | 'declined' | 'withdrawn' | 'reopened'.
-- p_on and p_how are required for accepted and declined (the server has already checked the day
-- is not in the future in the business's own time zone) and must be null otherwise.
-- Errors: P0002 the quote is not in a state that allows this; 22023 bad input.
-- Returns the new status.
-- ---------------------------------------------------------------------------

create function public.record_quote_outcome(
  p_org uuid,
  p_quote_id uuid,
  p_actor uuid,
  p_outcome text,
  p_on date,
  p_how text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes%rowtype;
  new_status text;
  note text := nullif(btrim(p_note), '');
begin
  if p_outcome not in ('accepted', 'declined', 'withdrawn', 'reopened') then
    raise exception 'unknown outcome' using errcode = '22023';
  end if;
  if (p_outcome in ('accepted', 'declined')) <> (p_on is not null and p_how is not null) then
    raise exception 'an answer needs a day and a way, and nothing else does' using errcode = '22023';
  end if;
  if p_outcome not in ('accepted', 'declined') and (p_on is not null or p_how is not null) then
    raise exception 'only an answer has a day and a way' using errcode = '22023';
  end if;
  if p_how is not null and p_how not in ('whatsapp', 'email', 'in_person', 'phone', 'other') then
    raise exception 'unknown way' using errcode = '22023';
  end if;
  if p_outcome = 'reopened' and note is not null then
    raise exception 'changing an answer takes no note' using errcode = '22023';
  end if;
  if note is not null and char_length(note) > 500 then
    raise exception 'the note is too long' using errcode = '22023';
  end if;

  select * into q from public.quotes
   where id = p_quote_id and organisation_id = p_org
     for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  if p_outcome = 'reopened' then
    if q.status not in ('accepted', 'declined') then
      raise exception 'only an accepted or declined quote can be reopened' using errcode = 'P0002';
    end if;
    new_status := 'sent';
  else
    if q.status <> 'sent' then
      raise exception 'only a sent quote can be answered or withdrawn' using errcode = 'P0002';
    end if;
    new_status := p_outcome;
  end if;

  update public.quotes set status = new_status where id = q.id;

  insert into public.quote_events (organisation_id, quote_id, version, kind, actor_id, on_date, how, note)
  values (p_org, q.id, q.version, p_outcome, p_actor, p_on, p_how, note);

  return new_status;
end;
$$;

revoke execute on function public.record_quote_outcome(uuid, uuid, uuid, text, date, text, text)
  from public, anon, authenticated;
grant execute on function public.record_quote_outcome(uuid, uuid, uuid, text, date, text, text)
  to service_role;
