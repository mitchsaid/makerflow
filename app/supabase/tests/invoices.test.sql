-- Invoices (docs/plans/invoices-and-payments.md, slice I1; migration 20261115100000): issued only by the server-only
-- issue_invoice, from an accepted quote's latest sent version, numbered gaplessly inside the same transaction,
-- never changed or deleted, readable by members of the business only, with the quote's private costing copied.
-- Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(customer uuid) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', customer, 'issue_date', '2026-10-02', 'valid_until', '2026-10-16',
    'needed_by', '2026-11-20', 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

create function pg_temp.snap(num text, ver integer) returns jsonb language sql as $f$
  select jsonb_build_object(
    'number', num, 'version', ver, 'issueDate', '2026-10-02',
    'customer', jsonb_build_object('name', 'Thandi'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Shelf', 'quantityMilli', 1000, 'lineTotalCents', 100000)),
    'totals', jsonb_build_object('netCents', 100000, 'vatCents', 15000, 'grossCents', 115000),
    'bankDetails', jsonb_build_array(jsonb_build_object('label', 'Bank', 'value', 'FNB')))
$f$;

-- The document the server would build from that version's snapshot.
create function pg_temp.invoice_doc(base jsonb, issued date, due date) returns jsonb language sql as $f$
  select jsonb_set(jsonb_set(base - 'number', '{issueDate}', to_jsonb(issued::text)),
                   '{invoice}', jsonb_build_object('dueDate', due::text, 'quoteNumber', base ->> 'number'))
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000033a1';
  b uuid := '00000000-0000-4000-8000-0000000033b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  q uuid;
  q2 uuid;
  q3 uuid;
  stamp timestamptz;
  num text;
  base jsonb;
  made jsonb;
  made2 jsonb;
  frozen jsonb := '{"schema": 1, "items": [{"name": "Shelf", "revenueCents": 100000, "costCents": 40000}]}'::jsonb;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa33@example.test'), (b, 'sb33@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi') returning id into cust;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  q2 := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  q3 := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  -- Send q and q2 (q2 stays "sent", q is then accepted).
  set local role service_role;
  select updated_at, number into stamp, num from public.quotes where id = q;
  perform public.send_quote(org_a, q, a, 'marked', stamp, pg_temp.snap(num, 1), 1, 1, 1, frozen);
  select updated_at, number into stamp, num from public.quotes where id = q2;
  perform public.send_quote(org_a, q2, a, 'marked', stamp, pg_temp.snap(num, 1), 1, 1, 1);
  reset role;

  ----------------------------------------------------------------------
  -- Only an accepted quote with a sent version can be invoiced
  ----------------------------------------------------------------------
  select number into num from public.quotes where id = q;
  base := pg_temp.snap(num, 1);
  set local role service_role;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'));
    raise exception 'a quote that is only sent was invoiced';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.issue_invoice(org_a, q3, a, date '2026-10-20', date '2026-11-03', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'));
    raise exception 'a draft was invoiced';
  exception when sqlstate 'P0002' then null;
  end;
  perform public.record_quote_outcome(org_a, q, a, 'accepted', date '2026-10-05', 'phone', null);
  perform public.record_quote_outcome(org_a, q2, a, 'accepted', date '2026-10-05', 'phone', null);

  ----------------------------------------------------------------------
  -- What does not fit is refused, and takes no number
  ----------------------------------------------------------------------
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-10-19', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-10-19'));
    raise exception 'a due day before the invoice day was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'), '{totals,grossCents}', '999999'));
    raise exception 'totals that differ from the quote were accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'), '{lines,0,lineTotalCents}', '5'));
    raise exception 'lines that differ from the quote were accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-21', date '2026-11-03', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'));
    raise exception 'dates that disagree with the document were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'), '{customer}', 'null'::jsonb));
    raise exception 'an invoice with no customer was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice(org_b, q, b, date '2026-10-20', date '2026-11-03', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'));
    raise exception 'another business invoiced this quote';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  assert (select count(*) from public.invoices where organisation_id in (org_a, org_b)) = 0, 'a refused issue left an invoice';
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') is null,
    'a refused issue used up a number';

  ----------------------------------------------------------------------
  -- Issuing: the next number, the reference line, the costing, the event
  ----------------------------------------------------------------------
  set local role service_role;
  made := public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', '  Thanks!  ',
    pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'), 'Payment reference');
  made2 := public.issue_invoice(org_a, q2, a, date '2026-10-21', date '2026-11-04', null,
    pg_temp.invoice_doc(pg_temp.snap((select number from public.quotes where id = q2), 1), date '2026-10-21', date '2026-11-04'));
  reset role;
  assert made ->> 'number' = 'INV-0001' and made2 ->> 'number' = 'INV-0002', 'invoice numbers were not sequential';
  assert (select count(*) from public.invoices where organisation_id = org_a) = 2, 'both invoices were not kept';
  assert (select snapshot ->> 'number' from public.invoices where id = (made ->> 'id')::uuid) = 'INV-0001', 'the number is not in the document';
  assert (select snapshot -> 'bankDetails' -> 1 from public.invoices where id = (made ->> 'id')::uuid)
    = '{"label": "Payment reference", "value": "INV-0001"}'::jsonb, 'the payment reference was not added';
  assert jsonb_array_length((select snapshot -> 'bankDetails' from public.invoices where id = (made2 ->> 'id')::uuid)) = 1,
    'a reference was added when none was asked for';
  assert (select costing from public.invoices where id = (made ->> 'id')::uuid) = frozen, 'the quote''s costing was not copied';
  assert (select costing from public.invoices where id = (made2 ->> 'id')::uuid) is null, 'a costing appeared from nowhere';
  assert not ((select snapshot from public.invoices where id = (made ->> 'id')::uuid) ? 'costing'), 'the costing leaked into the document';
  assert (select gross_cents from public.invoices where organisation_id = org_a and number = 'INV-0001') = 115000
     and (select customer_name from public.invoices where organisation_id = org_a and number = 'INV-0001') = 'Thandi'
     and (select note from public.invoices where organisation_id = org_a and number = 'INV-0001') = 'Thanks!'
     and (select quote_version from public.invoices where organisation_id = org_a and number = 'INV-0001') = 1, 'the invoice row is wrong';
  assert (select count(*) from public.invoice_events where invoice_id = (made ->> 'id')::uuid and kind = 'issued' and actor_id = a) = 1,
    'the issue was not logged';

  -- One invoice per quote.
  set local role service_role;
  begin
    perform public.issue_invoice(org_a, q, a, date '2026-10-20', date '2026-11-03', null, pg_temp.invoice_doc(base, date '2026-10-20', date '2026-11-03'));
    raise exception 'a second invoice for the same quote was made';
  exception when sqlstate '23505' then null;
  end;
  reset role;
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') = 2,
    'a refused second invoice used up a number';

  -- An invoiced quote keeps its answer.
  set local role service_role;
  begin
    perform public.record_quote_outcome(org_a, q, a, 'reopened', null, null, null);
    raise exception 'an invoiced quote was reopened';
  exception when sqlstate '55007' then null;
  end;
  reset role;
  assert (select status from public.quotes where id = q) = 'accepted', 'a refused reopen changed the quote';

  ----------------------------------------------------------------------
  -- Nobody can write one directly, or change one, or delete one
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
    values (org_a, 'INV-9999', q3, 1, 'X', date '2026-10-20', date '2026-11-03', 'ZAR', 1, 0, 1, '{}'::jsonb);
    raise exception 'a member wrote an invoice directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invoices set due_date = date '2027-01-01';
    raise exception 'a member changed an invoice';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.invoices;
    raise exception 'a member deleted an invoice';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.issue_invoice(org_a, q3, a, date '2026-10-20', date '2026-11-03', null, '{}'::jsonb);
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  reset role;
  -- Even the database owner cannot (the trigger), except to forget a deleted login.
  begin
    update public.invoices set net_cents = 1 where id = (made ->> 'id')::uuid;
    raise exception 'an issued invoice was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.invoices where id = (made ->> 'id')::uuid;
    raise exception 'an issued invoice was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.invoice_events;
    raise exception 'an invoice''s history was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.invoice_events set kind = 'issued', created_at = now() - interval '1 day';
    raise exception 'an invoice''s history was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.organisations where id = org_a;
    raise exception 'a business with invoices was deleted';
  exception when foreign_key_violation then null;
  end;
  -- Forgetting a deleted login is the one allowed change.
  update public.invoices set issued_by = null where id = (made ->> 'id')::uuid;
  assert (select issued_by from public.invoices where id = (made ->> 'id')::uuid) is null, 'the issuer could not be forgotten';

  ----------------------------------------------------------------------
  -- Members of the business read; nobody else does; a session is required
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.invoices;
  assert n = 2, 'a member cannot read the invoices';
  assert (select costing from public.invoices where organisation_id = org_a and number = 'INV-0001') = frozen, 'a member cannot read the costing';
  select count(*) into n from public.invoice_events;
  assert n = 2, 'a member cannot read the history';
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.invoices;
  assert n = 0, 'another business can read invoices';
  select count(*) into n from public.invoice_events;
  assert n = 0, 'another business can read the history';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.invoices;
  assert n = 0, 'a login with no active session can read invoices';
  select count(*) into n from public.invoice_events;
  assert n = 0, 'a login with no active session can read the history';
  reset role;

  raise notice 'invoice tests passed';
end
$$;

rollback;
