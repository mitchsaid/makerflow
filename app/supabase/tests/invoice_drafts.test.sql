-- Invoice drafts and invoices with no quote (docs/plans/invoice-i3.md, I3b and I3c; migration 20261119100000): drafts
-- are private working state members keep, change and discard; issue_invoice_from_draft (server only) numbers an invoice
-- gaplessly inside its own transaction, with or without a quote, and removes the draft. Plain SQL, one transaction,
-- rolled back.

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

-- The document the server would build from a draft: a customer, an item, totals, the dates and the due day.
create function pg_temp.draft_doc(issued date, due date) returns jsonb language sql as $f$
  select jsonb_build_object(
    'number', '', 'version', 1, 'issueDate', issued::text, 'currencyCode', 'ZAR',
    'customer', jsonb_build_object('name', 'Thandi'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Shelf', 'quantityMilli', 1000, 'lineTotalCents', 100000)),
    'totals', jsonb_build_object('netCents', 100000, 'vatCents', 15000, 'grossCents', 115000),
    'bankDetails', jsonb_build_array(jsonb_build_object('label', 'Bank', 'value', 'FNB')),
    'invoice', jsonb_build_object('dueDate', due::text))
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000034a1';
  b uuid := '00000000-0000-4000-8000-0000000034b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  q uuid;
  q_draft uuid;
  q_same uuid;
  stamp timestamptz;
  stamp_q timestamptz;
  num text;
  d1 uuid;
  d2 uuid;
  d3 uuid;
  dq uuid;
  made jsonb;
  made2 jsonb;
  before_n integer;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa34@example.test'), (b, 'sb34@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi') returning id into cust;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  q_draft := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  -- q is sent and accepted; q_draft stays a draft.
  set local role service_role;
  select updated_at, number into stamp, num from public.quotes where id = q;
  perform public.send_quote(org_a, q, a, 'marked', stamp, pg_temp.snap(num, 1), 1, 1, 1);
  perform public.record_quote_outcome(org_a, q, a, 'accepted', date '2026-10-05', 'phone', null);
  reset role;

  ----------------------------------------------------------------------
  -- Members keep drafts of their own business: with a quote that is accepted, or none
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.invoice_drafts (organisation_id, customer_id, form, created_by)
    values (org_a, cust, '{"lines": []}'::jsonb, a) returning id into d1;
  insert into public.invoice_drafts (organisation_id, quote_id, quote_version, customer_id, form, created_by)
    values (org_a, q, 1, cust, '{"lines": []}'::jsonb, a) returning id into dq;
  -- One draft per quote.
  begin
    insert into public.invoice_drafts (organisation_id, quote_id, quote_version, form) values (org_a, q, 1, '{}'::jsonb);
    raise exception 'a second draft for the same quote was made';
  exception when unique_violation then null;
  end;
  -- A quote that is only a draft, or does not exist, cannot be adjusted.
  begin
    insert into public.invoice_drafts (organisation_id, quote_id, quote_version, form) values (org_a, q_draft, 1, '{}'::jsonb);
    raise exception 'a draft was linked to a quote that is not accepted';
  exception when insufficient_privilege then null;
  end;
  -- A quote link and the version it started from come together.
  begin
    insert into public.invoice_drafts (organisation_id, quote_id, form) values (org_a, q, '{}'::jsonb);
    raise exception 'a draft had a quote and no version';
  exception when check_violation then null;
  end;
  begin
    insert into public.invoice_drafts (organisation_id, quote_version, form) values (org_a, 1, '{}'::jsonb);
    raise exception 'a draft had a version and no quote';
  exception when check_violation then null;
  end;
  -- The form is an object, and not an enormous one.
  begin
    insert into public.invoice_drafts (organisation_id, form) values (org_a, '[]'::jsonb);
    raise exception 'a draft held something that is not an object';
  exception when check_violation then null;
  end;
  begin
    insert into public.invoice_drafts (organisation_id, form) values (org_a, jsonb_build_object('x', repeat('y', 250000)));
    raise exception 'an enormous draft was accepted';
  exception when check_violation then null;
  end;
  -- Made in someone else's name is refused.
  begin
    insert into public.invoice_drafts (organisation_id, form, created_by) values (org_a, '{}'::jsonb, b);
    raise exception 'a draft was made in someone else''s name';
  exception when insufficient_privilege then null;
  end;
  -- It can be changed, but never moved to another business or another quote.
  update public.invoice_drafts set form = '{"note": "changed"}'::jsonb where id = d1;
  assert (select form ->> 'note' from public.invoice_drafts where id = d1) = 'changed', 'a draft was not changed';
  assert (select updated_at from public.invoice_drafts where id = d1) > (select created_at from public.invoice_drafts where id = d1) - interval '1 second', 'updated_at did not move';
  begin
    update public.invoice_drafts set quote_id = null where id = dq;
    raise exception 'a draft was moved off its quote';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invoice_drafts set quote_version = 5 where id = dq;
    raise exception 'a draft''s quote version was changed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invoice_drafts set organisation_id = org_b where id = d1;
    raise exception 'a draft was moved to another business';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees and changes nothing; nobody without a session does either
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.invoice_drafts) = 0, 'another business could read drafts';
  update public.invoice_drafts set form = '{"x": 1}'::jsonb where id = d1;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed a draft';
  delete from public.invoice_drafts where id = d1;
  get diagnostics n = row_count;
  assert n = 0, 'another business discarded a draft';
  begin
    insert into public.invoice_drafts (organisation_id, form) values (org_a, '{}'::jsonb);
    raise exception 'another business made a draft in this one';
  exception when insufficient_privilege then null;
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert (select count(*) from public.invoice_drafts) = 0, 'drafts were readable without a session';
  begin
    insert into public.invoice_drafts (organisation_id, form) values (org_a, '{}'::jsonb);
    raise exception 'a draft was made without a session';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Issuing is for the server only
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, now(), date '2026-10-20', date '2026-11-03', null, pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'));
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Refused issues leave no number, no invoice, and the draft where it was
  ----------------------------------------------------------------------
  select updated_at into stamp from public.invoice_drafts where id = d1;
  set local role service_role;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp - interval '1 second', date '2026-10-20', date '2026-11-03', null, pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'));
    raise exception 'a draft that changed was issued';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_b, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', null, pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'));
    raise exception 'another business''s draft was issued';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, gen_random_uuid(), true, stamp, date '2026-10-20', date '2026-11-03', null, pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'));
    raise exception 'a document made for another customer was issued';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-10-19', null, pg_temp.draft_doc(date '2026-10-20', date '2026-10-19'));
    raise exception 'a due day before the invoice day was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-21', date '2026-11-03', null, pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'));
    raise exception 'dates that differ from the document were accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'), '{customer}', '{}'::jsonb));
    raise exception 'an invoice with no customer was issued';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'), '{lines}', '[]'::jsonb));
    raise exception 'an invoice with no items was issued';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'), '{currencyCode}', '"USD"'));
    raise exception 'an invoice in another currency was issued';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', null,
      jsonb_set(pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'), '{totals,vatCents}', '14999'));
    raise exception 'money that does not add up was issued';
  exception when sqlstate '23514' then null;
  end;
  reset role;
  assert (select count(*) from public.invoices where organisation_id in (org_a, org_b)) = 0, 'a refused issue left an invoice';
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') is null,
    'a refused issue used up a number';
  assert (select count(*) from public.invoice_drafts where id = d1) = 1, 'a refused issue removed the draft';

  -- A draft that started from an older version of its quote is refused (the quote was reopened and sent again).
  update public.invoice_drafts set quote_version = 2 where id = dq;
  select updated_at into stamp_q from public.invoice_drafts where id = dq;
  set local role service_role;
  begin
    perform public.issue_invoice_from_draft(org_a, dq, a, cust, true, stamp_q, date '2026-10-21', date '2026-11-04', null, pg_temp.draft_doc(date '2026-10-21', date '2026-11-04'));
    raise exception 'a draft from an older version of its quote was issued';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  update public.invoice_drafts set quote_version = 1 where id = dq;
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') is null,
    'a refused issue used up a number';

  ----------------------------------------------------------------------
  -- An invoice with no quote: numbered, the draft gone, no quote and no costing, not adjusted
  ----------------------------------------------------------------------
  set local role service_role;
  made := public.issue_invoice_from_draft(org_a, d1, a, cust, true, stamp, date '2026-10-20', date '2026-11-03', '  Thanks!  ',
    pg_temp.draft_doc(date '2026-10-20', date '2026-11-03'), 'Payment reference');
  reset role;
  assert (select count(*) from public.invoice_drafts where id = d1) = 0, 'the draft was kept after it was issued';
  assert (select quote_id is null and quote_version is null and costing is null and adjusted = false and note = 'Thanks!' and gross_cents = 115000
            from public.invoices where id = (made ->> 'id')::uuid), 'the invoice with no quote is not as expected';
  assert (select snapshot ->> 'number' from public.invoices where id = (made ->> 'id')::uuid) = made ->> 'number', 'the number is not in the document';
  assert (select snapshot -> 'bankDetails' -> 1 ->> 'value' from public.invoices where id = (made ->> 'id')::uuid) = made ->> 'number',
    'the payment reference is not the number';
  assert (select count(*) from public.invoice_events where invoice_id = (made ->> 'id')::uuid and kind = 'issued' and actor_id = a) = 1, 'no issued event';
  before_n := (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice');

  -- Issued means final, the same as every invoice.
  begin
    update public.invoices set net_cents = 1 where id = (made ->> 'id')::uuid;
    raise exception 'an invoice with no quote was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.invoices where id = (made ->> 'id')::uuid;
    raise exception 'an invoice with no quote was deleted';
  exception when sqlstate '55000' then null;
  end;

  ----------------------------------------------------------------------
  -- An invoice adjusted from an accepted quote: linked, with the latest version, marked adjusted; a quote can have only one
  ----------------------------------------------------------------------
  select updated_at into stamp from public.invoice_drafts where id = dq;
  set local role service_role;
  made2 := public.issue_invoice_from_draft(org_a, dq, a, cust, true, stamp, date '2026-10-21', date '2026-11-04', null,
    pg_temp.draft_doc(date '2026-10-21', date '2026-11-04'));
  reset role;
  assert (select quote_id = q and quote_version = 1 and adjusted and costing is null from public.invoices where id = (made2 ->> 'id')::uuid), 'the adjusted invoice is not as expected';
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') = before_n + 1,
    'the numbers are not one after the other';
  assert (select count(*) from public.invoice_drafts where id = dq) = 0, 'the adjusted draft was kept';

  -- Not changed from the quote as agreed: the server says so, and the invoice is not marked adjusted.
  perform pg_temp.as_user(a);
  set local role authenticated;
  q_same := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  reset role;
  set local role service_role;
  select updated_at, number into stamp, num from public.quotes where id = q_same;
  perform public.send_quote(org_a, q_same, a, 'marked', stamp, pg_temp.snap(num, 1), 1, 1, 1);
  perform public.record_quote_outcome(org_a, q_same, a, 'accepted', date '2026-10-05', 'phone', null);
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.invoice_drafts (organisation_id, quote_id, quote_version, customer_id, form, created_by)
    values (org_a, q_same, 1, cust, '{}'::jsonb, a) returning id into d3;
  reset role;
  select updated_at into stamp from public.invoice_drafts where id = d3;
  set local role service_role;
  made2 := public.issue_invoice_from_draft(org_a, d3, a, cust, false, stamp, date '2026-10-21', date '2026-11-04', null, pg_temp.draft_doc(date '2026-10-21', date '2026-11-04'));
  reset role;
  assert (select quote_id = q_same and adjusted = false from public.invoices where id = (made2 ->> 'id')::uuid), 'an unchanged invoice was marked adjusted';
  before_n := before_n + 1;

  -- The quote is invoiced: the strict way refuses it, and so does a new draft being issued.
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.invoice_drafts (organisation_id, quote_id, quote_version, customer_id, form) values (org_a, q, 1, cust, '{}'::jsonb) returning id into d2;
    -- (Allowed to be saved: the quote is still accepted. Issuing is what refuses.)
  end;
  reset role;
  select updated_at into stamp from public.invoice_drafts where id = d2;
  set local role service_role;
  begin
    perform public.issue_invoice_from_draft(org_a, d2, a, cust, true, stamp, date '2026-10-22', date '2026-11-05', null, pg_temp.draft_doc(date '2026-10-22', date '2026-11-05'));
    raise exception 'a second invoice was issued for a quote';
  exception when sqlstate '23505' then null;
  end;
  reset role;
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'invoice') = before_n + 1,
    'a refused second invoice used up a number';
  assert (select count(*) from public.invoice_drafts where id = d2) = 1, 'a refused issue removed the draft';

  ----------------------------------------------------------------------
  -- The pair rules on invoices hold even for the database owner
  ----------------------------------------------------------------------
  begin
    insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
    values (org_a, 'X-1', null, 1, 'X', date '2026-10-20', date '2026-11-03', 'ZAR', 1, 0, 1, '{}'::jsonb);
    raise exception 'an invoice had a version and no quote';
  exception when check_violation then null;
  end;
  begin
    insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot, adjusted)
    values (org_a, 'X-2', null, null, 'X', date '2026-10-20', date '2026-11-03', 'ZAR', 1, 0, 1, '{}'::jsonb, true);
    raise exception 'an invoice with no quote was marked adjusted';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- At most 100 drafts a business
  ----------------------------------------------------------------------
  delete from public.invoice_drafts where organisation_id = org_a;
  -- Even in one statement of 150 rows, the cap holds.
  begin
    insert into public.invoice_drafts (organisation_id, form) select org_a, '{}'::jsonb from generate_series(1, 150);
    raise exception 'a statement made more than 100 drafts';
  exception when sqlstate '54000' then null;
  end;
  assert (select count(*) from public.invoice_drafts where organisation_id = org_a) = 0, 'a refused bulk insert left drafts';
  insert into public.invoice_drafts (organisation_id, form) select org_a, '{}'::jsonb from generate_series(1, 100);
  begin
    insert into public.invoice_drafts (organisation_id, form) values (org_a, '{}'::jsonb);
    raise exception 'a 101st draft was kept';
  exception when sqlstate '54000' then null;
  end;
  -- Another business has its own 100.
  insert into public.invoice_drafts (organisation_id, form) values (org_b, '{}'::jsonb);
end
$$;

rollback;
