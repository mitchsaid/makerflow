-- Delete my account (docs/plans/delete-account.md; founder, 2026-10-13): a person can delete their account, with a
-- typed confirmation in the app. This is the database half.
--
-- SECURITY-SENSITIVE and DESTRUCTIVE: a new service-role-only security-definer function that deletes whole businesses.
-- Needs human review before it is applied to any hosted project. The server calls it only for the signed-in person
-- (it reads the person from the session, never from anything the browser sends), after the typed email matched.
--
-- WHAT IT DOES, in one transaction
-- * Refuses (55006, naming the business) if the person is the ONLY OWNER of a business that has other people: nobody
--   would be left in charge. Handing over ownership is not built yet. Nothing is changed when it refuses.
-- * Deletes every business the person is the only member of. Every table with an organisation_id cascades from the
--   business, so its quotes, jobs, customers, products, materials, terms, themes, settings and picture records all go.
-- * Returns the ids of the deleted businesses and of their pictures, because the picture FILES live in storage, which
--   a database delete does not reach: the server removes them.
-- * Businesses with other people stay. The person's membership, profile and "Not now" records go when their sign-in is
--   deleted (on delete cascade), and the columns that point at the person on rows that stay (sent_by, created_by,
--   actor_id) become empty (on delete set null). The server deletes the sign-in after this function.
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
  member_count integer;
  owner_count integer;
  deleted_orgs uuid[] := '{}';
  pictures jsonb := '[]'::jsonb;
begin
  if p_user is null then
    raise exception 'a person is needed' using errcode = '22023';
  end if;

  -- First check every business, so a refusal changes nothing. The business rows are locked so the people in them
  -- cannot change underneath this.
  for m in
    select ms.organisation_id, ms.role, o.name
      from public.memberships ms
      join public.organisations o on o.id = ms.organisation_id
     where ms.user_id = p_user
     order by ms.organisation_id
       for update of o
  loop
    select count(*), count(*) filter (where role = 'owner')
      into member_count, owner_count
      from public.memberships
     where organisation_id = m.organisation_id;
    if member_count > 1 and m.role = 'owner' and owner_count = 1 then
      raise exception 'the only owner of a business that has other people' using errcode = '55006', detail = m.name;
    end if;
  end loop;

  -- Then delete the businesses nobody else belongs to.
  for m in
    select ms.organisation_id
      from public.memberships ms
     where ms.user_id = p_user
     order by ms.organisation_id
  loop
    select count(*) into member_count from public.memberships where organisation_id = m.organisation_id;
    if member_count = 1 then
      pictures := pictures || coalesce(
        (select jsonb_agg(jsonb_build_object('organisationId', i.organisation_id, 'id', i.id))
           from public.images i
          where i.organisation_id = m.organisation_id),
        '[]'::jsonb);
      -- A few links between a business's own tables do not cascade (a sent version points at its quote, a job at its
      -- quote and customer, a quote line at its product, and several tables at pictures), and the database would
      -- refuse to delete a parent that a child still points at. So the children go first, then the business takes the
      -- rest with it. The SQL test lists these links and fails if a new one appears, so this stays complete.
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
