-- Jobs: the status moves freely, and any job can be deleted (founder, 2026-10-27: "choosing the status should be some
-- kind of dropdown", "do you really need both [cancel and delete]?"; answers: delete only, with a confirmation; free
-- moves, as the prototype's dropdown had). docs/plans/ux-pass-3.md, slice 2.
--
-- SECURITY-SENSITIVE: this changes what the server-only functions that change and delete jobs allow. They still run
-- ONLY on the server's own key (service_role); the app checks the person first (owners and admins delete). Needs
-- human review before it is applied to any hosted project.
--
-- * move_job_status: a job moves between Not started, Making, Ready, Out for delivery (delivery jobs only) and Done in
--   any direction (each move is still logged with who and when). Cancelling is no longer a move: nothing offers it and
--   nothing new becomes cancelled. A job that was already cancelled can still come back to Not started (while its quote
--   is still the accepted version it was made from, as before), or be deleted.
-- * delete_job: any status. The job's items and log go with it, as before; the quote and any invoice are untouched.
--   (Numbers are the highest plus one, so deleting the newest frees its number.)
-- Errors as before: P0002 the job is not found, or the move is not allowed; 22023 an unknown status; 23505 restoring
-- when the quote has another job.

create or replace function public.move_job_status(p_org uuid, p_job_id uuid, p_actor uuid, p_to text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
  q public.quotes%rowtype;
  qid uuid;
  allowed boolean;
begin
  if p_to not in ('not_started', 'in_progress', 'ready', 'out_for_delivery', 'done') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  -- The quote is locked first (as creating a job does), so a restore and a reopen of the quote cannot cross.
  select quote_id into qid from public.jobs where id = p_job_id and organisation_id = p_org;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  if qid is not null then
    select * into q from public.quotes where id = qid and organisation_id = p_org for update;
  end if;
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  -- A cancelled job (from before cancelling went) comes back only while its quote is still the accepted version it was
  -- made from. (A job made without a quote has nothing to check.)
  if j.status = 'cancelled' and p_to = 'not_started' and j.quote_id is not null
     and (q.status <> 'accepted' or q.version <> j.quote_version) then
    raise exception 'the quote has changed since this job was made' using errcode = 'P0002';
  end if;

  allowed := case
    when j.status = 'cancelled' then p_to = 'not_started'
    when p_to = j.status then false
    when p_to = 'out_for_delivery' then j.fulfilment = 'delivery'
    else true
  end;
  if not allowed then
    raise exception 'that move is not allowed from %', j.status using errcode = 'P0002';
  end if;

  update public.jobs set status = p_to where id = j.id;
  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, j.id, 'status', j.status, p_to, p_actor);
  return p_to;
end;
$$;

create or replace function public.delete_job(p_org uuid, p_job_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.jobs%rowtype;
begin
  select * into j from public.jobs where id = p_job_id and organisation_id = p_org for update;
  if not found then
    raise exception 'job not found' using errcode = 'P0002';
  end if;
  delete from public.jobs where id = j.id;
  return j.number;
end;
$$;
