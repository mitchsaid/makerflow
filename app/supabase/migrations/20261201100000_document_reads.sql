-- A count of documents read by the AI reader (docs/plans/import-onboarding.md, slice 2): "start with an invoice or
-- quote" sends one document to an AI service to fill in the business details. A read costs real money, so each one is
-- written down BEFORE it is made, and the database refuses more than a few an hour for one person and a few a day for
-- one business. The document itself is never stored, and nothing about its content is recorded here.
--
-- SECURITY-SENSITIVE (a new table with row-level security, and the guard on spending). Needs human review before it is
-- applied to any hosted project.
--
-- * Write-only for the app, like feedback: a signed-in member adds a row for their own business as themselves; nobody
--   can read, change or delete rows through the app (no select, update or delete grant).
-- * At most 5 in an hour for one person and 20 in a day for one business (errcode 54000, which the app turns into
--   "you have reached today's limit").
-- * The person's account going away keeps the count but not the person (user_id becomes null); the business going
--   away removes its rows.

create table public.document_reads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index document_reads_org_created_idx on public.document_reads (organisation_id, created_at desc);
create index document_reads_user_created_idx on public.document_reads (user_id, created_at desc) where user_id is not null;

create function public.document_reads_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Two reads at the same moment must not both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('document_reads:' || new.organisation_id::text, 0));
  if new.user_id is not null
     and (select count(*) from public.document_reads r where r.user_id = new.user_id and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many documents read in an hour' using errcode = '54000';
  end if;
  if (select count(*) from public.document_reads r where r.organisation_id = new.organisation_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many documents read in a day' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function public.document_reads_limit() from public, anon, authenticated;

create trigger document_reads_limit
  before insert on public.document_reads
  for each row execute function public.document_reads_limit();

revoke all on public.document_reads from anon, authenticated;
grant insert (organisation_id, user_id) on public.document_reads to authenticated;

alter table public.document_reads enable row level security;

-- A member adds a read for their own business, as themselves. There is no select, update or delete policy.
create policy document_reads_insert_members on public.document_reads
  for insert to authenticated
  with check (public.is_org_member(organisation_id) and user_id = (select auth.uid()));

create policy session_required on public.document_reads
  as restrictive for all to authenticated
  using ((select public.session_is_active()))
  with check ((select public.session_is_active()));
