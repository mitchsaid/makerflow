-- Jobs: ready, out for delivery and done mean everything is made (founder, 2026-10-28: "when it's marked as ready for
-- delivery, or out for delivery, or done, the items should be considered made"). docs/plans/ux-pass-3.md.
--
-- SECURITY-SENSITIVE: this changes what the server-only function that moves a job's status writes. It still runs ONLY on
-- the server's own key (service_role) and checks the job belongs to the business, as before. It now also sets every item
-- of the job to made in full (job_items.made_milli = quantity_milli) and every production step to done in full
-- (job_item_steps.done_milli = the item's quantity) when the job is moved to Ready, Out for delivery or Done. Moving back
-- to Not started or Making leaves the counts as they then are (nothing is lowered). Needs human review before it is
-- applied to any hosted project.

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
  -- Ready, out for delivery and done mean the work is made: every item counts as made, and every step as done, so the
  -- job never says it is finished with things still left to make (founder, 2026-10-28). Going back to making leaves them
  -- as they now are.
  if p_to in ('ready', 'out_for_delivery', 'done') then
    update public.job_item_steps s set done_milli = i.quantity_milli
      from public.job_items i
      where s.job_item_id = i.id and i.job_id = j.id and s.done_milli <> i.quantity_milli;
    update public.job_items set made_milli = quantity_milli where job_id = j.id and made_milli <> quantity_milli;
  end if;
  insert into public.job_events (organisation_id, job_id, kind, from_status, to_status, actor_id)
  values (p_org, j.id, 'status', j.status, p_to, p_actor);
  return p_to;
end;
$$;
