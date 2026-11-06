-- Recurring invoices (docs/plans/recurring.md, slice 1): a REPEAT makes a new invoice DRAFT on a schedule, for the maker
-- to check and issue. Quotes and jobs follow in later slices on the same table.
--
-- SECURITY-SENSITIVE: a new table with row-level security, new columns with grants on invoice_drafts, and a new
-- service-role-only security-definer function that writes invoice drafts without a signed-in person (the daily run).
-- Needs human review before it is applied to any hosted project. NOTHING here issues an invoice, takes an invoice number
-- or changes an issued invoice: a repeat only ever makes a draft, and issuing stays the maker's act (issue_invoice_from_draft,
-- unchanged). Money is not stored on a repeat: it keeps the invoice FORM (as an invoice draft does) and the server works
-- every total out again when the draft is saved and when it is issued.
--
-- * recurrences: the form to repeat, the schedule (frequency week/month/year, every 1 to 12, the starting day, "last
--   day of the month"), an optional end (a day, or a number of times, at most 100), and where it stands (next day due, how
--   many it has made, paused with a reason). A business has at most 25. Members read, create, change and stop (delete)
--   their business's repeats under their own session; they can never write how many it has made or when it last ran.
-- * invoice_drafts.recurrence_id: which repeat made a draft. Only the run function sets it (members' grants do not
--   include it); stopping a repeat leaves the drafts it made and clears the link.
-- * run_recurrence (SERVER ONLY, the service role): called by the daily run for one repeat that the server found due.
--   It locks the repeat, makes sure it is still due on the day the server read (so two runs, or a change made meanwhile,
--   make one draft and never two), writes the draft with the repeat's customer and theme, and moves the repeat on. A
--   business that already has 100 drafts gets the repeat PAUSED with the reason, not an error and not a lost repeat.
-- * pause_recurrence_with_reason (SERVER ONLY): the run pauses a repeat it cannot make (an item that is no longer valid).

create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind text not null default 'invoice' check (kind in ('invoice')),
  customer_id uuid,
  -- The invoice form to repeat, checked and worked out again by the server each time it is used.
  form jsonb not null check (jsonb_typeof(form) = 'object' and pg_column_size(form) <= 200000),
  theme_id uuid,
  theme_starter text check (theme_starter is null or theme_starter in ('classic', 'modern', 'warm', 'bold', 'soft')),
  frequency text not null check (frequency in ('week', 'month', 'year')),
  every integer not null default 1 check (every between 1 and 12),
  starts_on date not null,
  -- Monthly only: the last day of each month, whatever its length.
  last_day boolean not null default false,
  ends_on date,
  max_runs integer check (max_runs is null or max_runs between 1 and 100),
  -- The next day it is due; null once it has finished (its end passed, or it made its last one).
  next_run_on date,
  paused_at timestamptz,
  paused_reason text check (paused_reason is null or char_length(paused_reason) <= 300),
  -- Written only by the run (never by members).
  run_count integer not null default 0 check (run_count between 0 and 100),
  last_run_on date,
  -- How many due days went by without a draft the last time it ran (an outage, or a long pause).
  last_skipped integer not null default 0 check (last_skipped >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrences_org_id_unique unique (organisation_id, id),
  constraint recurrences_last_day_monthly check (not last_day or frequency = 'month'),
  constraint recurrences_ends_after_start check (ends_on is null or ends_on >= starts_on),
  -- A reason only goes with a pause (a pause the maker chose has none).
  constraint recurrences_reason_needs_pause check (paused_at is not null or paused_reason is null),
  constraint recurrences_theme_one_of check (theme_id is null or theme_starter is null),
  constraint recurrences_customer_same_org
    foreign key (organisation_id, customer_id) references public.customers (organisation_id, id) on delete cascade,
  constraint recurrences_theme_fk
    foreign key (organisation_id, theme_id) references public.quote_themes (organisation_id, id)
    on delete set null (theme_id)
);

create index recurrences_org_idx on public.recurrences (organisation_id, created_at desc);
-- The daily run finds what is due.
create index recurrences_due_idx on public.recurrences (next_run_on) where next_run_on is not null and paused_at is null;

create trigger recurrences_set_updated_at
  before update on public.recurrences
  for each row execute function public.set_updated_at();

-- At most 25 repeats a business.
create function public.recurrences_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.recurrences where organisation_id = new.organisation_id) >= 25 then
    raise exception 'a business can keep at most 25 repeats' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke execute on function public.recurrences_limit() from public, anon, authenticated;

create trigger recurrences_limit
  before insert on public.recurrences
  for each row execute function public.recurrences_limit();

revoke all on public.recurrences from anon, authenticated;
grant select, delete on public.recurrences to authenticated;
grant insert (organisation_id, kind, customer_id, form, theme_id, theme_starter, frequency, every, starts_on, last_day, ends_on, max_runs, next_run_on, created_by)
  on public.recurrences to authenticated;
grant update (customer_id, form, theme_id, theme_starter, frequency, every, starts_on, last_day, ends_on, max_runs, next_run_on, paused_at, paused_reason)
  on public.recurrences to authenticated;

alter table public.recurrences enable row level security;

create policy recurrences_select_members on public.recurrences for select to authenticated
  using (public.is_org_member(organisation_id));

create policy recurrences_insert_members on public.recurrences for insert to authenticated
  with check (public.is_org_member(organisation_id) and (created_by is null or created_by = (select auth.uid())));

create policy recurrences_update_members on public.recurrences for update to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy recurrences_delete_members on public.recurrences for delete to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.recurrences
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- Which repeat made a draft. Set only by run_recurrence: it is not in the members' insert or update grants.
alter table public.invoice_drafts
  add column recurrence_id uuid references public.recurrences (id) on delete set null;

create index invoice_drafts_recurrence_idx on public.invoice_drafts (organisation_id, recurrence_id) where recurrence_id is not null;

-- ---------------------------------------------------------------------------
-- run_recurrence. SERVER ONLY (service role). The server found this repeat due in its business's own time zone, worked out
-- the form for the new draft (today's dates, the usual gap to the due day) and the day it is due next, and passes
-- them with the day it read the repeat as due (p_expected_due).
--
-- Returns the new draft's id, or null when nothing was made: the repeat is paused, finished, not yet due, or changed
-- since the server read it (the next run reads it afresh), or the business has 100 drafts already (then it is paused
-- with that reason). Errors: P0002 the repeat is not found for that business.
-- ---------------------------------------------------------------------------
create function public.run_recurrence(
  p_org uuid,
  p_id uuid,
  p_today date,
  p_expected_due date,
  p_form jsonb,
  p_next date,
  p_skipped integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recurrences;
  v_draft uuid;
  v_next date := p_next;
begin
  select * into r from public.recurrences where id = p_id and organisation_id = p_org for update;
  if not found then
    raise exception 'repeat not found' using errcode = 'P0002';
  end if;
  if r.paused_at is not null or r.next_run_on is null or r.next_run_on > p_today or r.next_run_on <> p_expected_due then
    return null;
  end if;
  if jsonb_typeof(p_form) <> 'object' or p_skipped < 0 then
    raise exception 'the draft''s form is not usable' using errcode = '22023';
  end if;
  -- A repeat never makes more than 100 (the table's own limit on run_count).
  if r.run_count + 1 >= 100 then
    v_next := null;
  end if;

  begin
    insert into public.invoice_drafts (organisation_id, customer_id, form, theme_id, theme_starter, created_by, recurrence_id)
    values (r.organisation_id, r.customer_id, p_form, r.theme_id, r.theme_starter, r.created_by, r.id)
    returning id into v_draft;
  exception when sqlstate '54000' then
    update public.recurrences
       set paused_at = now(), paused_reason = 'You already have 100 invoice drafts. Send or discard some, then resume this repeat.'
     where id = r.id;
    return null;
  end;

  update public.recurrences
     set run_count = run_count + 1, last_run_on = p_today, last_skipped = p_skipped, next_run_on = v_next
   where id = r.id;
  return v_draft;
end;
$$;

revoke all on function public.run_recurrence(uuid, uuid, date, date, jsonb, date, integer) from public, anon, authenticated;
grant execute on function public.run_recurrence(uuid, uuid, date, date, jsonb, date, integer) to service_role;

-- ---------------------------------------------------------------------------
-- pause_recurrence_with_reason. SERVER ONLY. The run pauses a repeat it cannot make (the form no longer checks out), so
-- the maker is told why instead of the repeat failing every day. Only a repeat that is running is paused.
-- ---------------------------------------------------------------------------
create function public.pause_recurrence_with_reason(p_org uuid, p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 300 then
    raise exception 'a reason is needed, up to 300 characters' using errcode = '22023';
  end if;
  update public.recurrences
     set paused_at = coalesce(paused_at, now()), paused_reason = p_reason
   where id = p_id and organisation_id = p_org and paused_at is null;
end;
$$;

revoke all on function public.pause_recurrence_with_reason(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pause_recurrence_with_reason(uuid, uuid, text) to service_role;
