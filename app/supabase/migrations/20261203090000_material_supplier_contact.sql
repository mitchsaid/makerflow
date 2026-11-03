-- A material's supplier can have contact details: an optional email address and an optional phone number
-- (docs/plans/material-supplier-contact.md). Plain optional text, like `supplier`: stored as NULL when empty, never as ''.
-- The app checks the shape (an email address, a phone number) with the same checks as a customer's; the database only
-- keeps them to a sane size. No new table, no new policy: the table's own row-level security and `session_required`
-- policy already cover every column, and the new columns follow the existing column-level grants (insert and update by
-- a member of the business, no delete).
--
-- HUMAN REVIEW: a migration (two nullable columns and their grants; nothing is rewritten).

alter table public.materials
  add column supplier_email text check (supplier_email is null or char_length(btrim(supplier_email)) between 3 and 254),
  add column supplier_phone text check (supplier_phone is null or char_length(btrim(supplier_phone)) between 1 and 40);

grant insert (supplier_email, supplier_phone) on public.materials to authenticated;
grant update (supplier_email, supplier_phone) on public.materials to authenticated;
