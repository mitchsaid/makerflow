-- Feedback from the people using the app (docs/plans/feedback-button.md): a short message from the "Send feedback" sheet,
-- with where they were and what they were using, so a problem can be found.
--
-- SECURITY-SENSITIVE (a new table with row-level security that holds a person's words and, if they agree, their email
-- address). Needs human review before it is applied to any hosted project.
--
-- * Write-only for the app: a signed-in member can add feedback for their own business as themselves, and nobody can read,
--   change or delete it through the app (no select, update or delete grant). It is read by the people who run MakerFlow,
--   in the Supabase dashboard or with the service key (docs/runbooks/reading-feedback.md).
-- * A person can send at most 10 in an hour, so a stuck button or a script cannot fill the table.
-- * The person's account going away keeps the message but not the person: user_id becomes null (the foreign key) and a
--   trigger then clears the email address; the business going away removes the feedback.
--   (Deleting an account does not need to know about this table.)

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null default 'other' check (kind in ('problem', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  -- Where they were (a path in the app), and what they were using, so a problem can be found.
  page text check (page is null or char_length(page) <= 300),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  viewport text check (viewport is null or viewport ~ '^[0-9]{2,5}x[0-9]{2,5}$'),
  -- The address to reply to: only when they said we may.
  contact_email text check (contact_email is null or char_length(contact_email) <= 320),
  created_at timestamptz not null default now()
);

create index feedback_org_created_idx on public.feedback (organisation_id, created_at desc);

-- At most 10 an hour for one person.
create function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
     and (select count(*) from public.feedback f where f.user_id = new.user_id and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too much feedback in an hour' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.feedback_rate_limit() from public, anon, authenticated;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();

-- When the person's account is deleted, the foreign key clears user_id: the email to reach them goes with it.
create function public.feedback_forget_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.contact_email := null;
  end if;
  return new;
end;
$$;

revoke all on function public.feedback_forget_person() from public, anon, authenticated;

create trigger feedback_forget_person
  before update on public.feedback
  for each row execute function public.feedback_forget_person();

revoke all on public.feedback from anon, authenticated;
grant insert (organisation_id, user_id, kind, message, page, user_agent, viewport, contact_email) on public.feedback to authenticated;

alter table public.feedback enable row level security;

-- A member adds feedback for their own business, as themselves. There is no select, update or delete policy.
create policy feedback_insert_members on public.feedback
  for insert to authenticated
  with check (public.is_org_member(organisation_id) and user_id = (select auth.uid()));

create policy session_required on public.feedback
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));
