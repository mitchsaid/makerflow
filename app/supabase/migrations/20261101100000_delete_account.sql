-- Delete my account (docs/plans/delete-account.md; founder, 2026-10-13): a person can delete their account, with a
-- typed confirmation in the app. This is the database half.
--
-- SECURITY-SENSITIVE and DESTRUCTIVE: a new service-role-only security-definer function that deletes whole businesses.
-- Needs human review before it is applied to any hosted project. The server calls it only for the signed-in person
-- (it reads the person from the session, never from anything the browser sends), after the typed email matched.
--
-- WHAT IT DOES, in one transaction
-- * Locks every business the person belongs to, then looks at who ELSE is in each one. (The person's own membership is
--   removed inside this same locked transaction, not later when the sign-in goes, so two people leaving the same
--   business at the same moment cannot both see the other still there and leave it with nobody: the second one to
--   get the lock finds it empty and deletes it.)
-- * Refuses (55006, naming the business) if the person is the ONLY OWNER of a business that has other people: nobody
--   would be left in charge. Handing over ownership is not built yet. Nothing is changed when it refuses.
-- * Deletes every business nobody else belongs to. Every table with an organisation_id cascades from the business, so
--   its quotes, jobs, customers, products, materials, terms, themes, settings and picture records all go, SENT QUOTES
--   INCLUDED. (docs/adr/0006 said deleting a business with sent quotes was refused until an erasure process existed:
--   this is that process. Sent quotes are not tax invoices; issued invoices and credit notes are different, see below.)
-- * Removes the person from the businesses that stay.
-- * Returns the ids of the deleted businesses and of their pictures, because the picture FILES live in storage, which
--   a database delete does not reach: the server removes them.
-- * Memberships, the profile and "Not now" records would go anyway when the sign-in is deleted (on delete cascade),
--   and the columns that point at the person on rows that stay (sent_by, created_by, actor_id) become empty (on delete
--   set null). The server deletes the sign-in after this function.
--
-- NOT HANDLED YET, ON PURPOSE: issued invoices and credit notes must never be deleted. None exist. The SQL test
-- (delete_account.test.sql) fails the day an invoices table is created, so this function gets reworked then.

create function public.delete_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  others integer;
  other_owners integer;
  deleted_orgs uuid[] := '{}';
  pictures jsonb := '[]'::jsonb;
begin
  if p_user is null then
    raise exception 'a person is needed' using errcode = '22023';
  end if;

  -- First check every business, so a refusal changes nothing. The business rows are locked (in a fixed order), so
  -- the people in them cannot change underneath this, and a second person leaving at the same time waits here.
  for m in
    select ms.organisation_id, ms.role, o.name
      from public.memberships ms
      join public.organisations o on o.id = ms.organisation_id
     where ms.user_id = p_user
     order by ms.organisation_id
       for update of o
  loop
    select count(*), count(*) filter (where role = 'owner')
      into others, other_owners
      from public.memberships
     where organisation_id = m.organisation_id and user_id <> p_user;
    if others > 0 and m.role = 'owner' and other_owners = 0 then
      raise exception 'the only owner of a business that has other people' using errcode = '55006', detail = m.name;
    end if;
  end loop;

  -- Then leave every business, deleting the ones nobody else is in.
  for m in
    select ms.organisation_id
      from public.memberships ms
     where ms.user_id = p_user
     order by ms.organisation_id
  loop
    select count(*) into others from public.memberships where organisation_id = m.organisation_id and user_id <> p_user;
    delete from public.memberships where organisation_id = m.organisation_id and user_id = p_user;
    if others = 0 then
      pictures := pictures || coalesce(
        (select jsonb_agg(jsonb_build_object('organisationId', i.organisation_id, 'id', i.id))
           from public.images i
          where i.organisation_id = m.organisation_id),
        '[]'::jsonb);
      -- A few links between a business's own tables do not cascade (a sent version points at its quote, a job at its
      -- quote and customer, a quote line at its product, and several tables at pictures), and the database refuses to
      -- delete a parent that a child still points at. Which of them gets in the way depends on the order the
      -- constraints were created, so the children go first here. The SQL test lists these links and fails if a new
      -- one appears, so this stays complete.
      update public.business_profiles set logo_image_id = null where organisation_id = m.organisation_id;
      delete from public.jobs where organisation_id = m.organisation_id;
      delete from public.quote_versions where organisation_id = m.organisation_id;
      delete from public.quotes where organisation_id = m.organisation_id;
      delete from public.customers where organisation_id = m.organisation_id;
      delete from public.products where organisation_id = m.organisation_id;
      delete from public.organisations where id = m.organisation_id;
      deleted_orgs := deleted_orgs || m.organisation_id;
    end if;
  end loop;

  return jsonb_build_object('organisations', to_jsonb(deleted_orgs), 'pictures', pictures);
end;
$$;

revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;
