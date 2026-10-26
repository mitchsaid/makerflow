-- Delete a job (founder, 2026-10-26: "Can't deletion just release the number in the sequence?").
--
-- SECURITY-SENSITIVE: this is the first function that deletes jobs. Like the others that change jobs it runs ONLY on
-- the server's own key (service_role); nobody can call it, or delete from the tables, with a person's session. The app
-- checks the person is an owner or admin of the business before it calls it. Needs human review before it is applied
-- to any hosted project.
--
-- * Only a job that has not been started, or was cancelled, can be deleted: a job that is being made, is ready, out for
--   delivery or done keeps its record (cancel it first if it was a mistake).
-- * The job's items and its activity log go with it (they already cascade). Nothing else points at a job: quotes and
--   invoices keep their own copies and do not refer to it.
-- * The job's number is simply free again when it was the newest (numbers are the highest number plus one, so an older
--   one leaves a gap, which is fine: a job is not a legal document). The quote can get a new job again.
-- Errors: P0002 the job is not found, or its status does not allow deleting it.

create function public.delete_job(p_org uuid, p_job_id uuid)
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
  if j.status not in ('not_started', 'cancelled') then
    raise exception 'a job that is % cannot be deleted', j.status using errcode = 'P0002';
  end if;
  delete from public.jobs where id = j.id;
  return j.number;
end;
$$;

revoke execute on function public.delete_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_job(uuid, uuid) to service_role;
