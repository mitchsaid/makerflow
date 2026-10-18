-- Credit notes (docs/plans/credit-notes.md; migration 20261117100000): issued only by the server-only issue_credit_note,
-- numbered with no gaps inside the same transaction, within what each item and the invoice allow (including across
-- several credit notes), never changed or deleted, readable by members of the business only; and what is owing on an
-- invoice (payments, Home's totals) takes the credit off. Plain SQL, one transaction, rolled back.

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
    'needed_by', null, 'quote_discount_kind', 'none', 'quote_discount_value', 0,
    'notes', null, 'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 100000, 'vat_cents', 15000, 'gross_cents', 115000)
$f$;

-- The credit note's document, as the server would build it: amounts is what the lines add up to.
create function pg_temp.cn_snap(inv_number text, inv_date date, issued date, subtotal bigint, net bigint, vat bigint)
returns jsonb language sql as $f$
  select jsonb_build_object(
    'issueDate', issued::text, 'number', '',
    'creditNote', jsonb_build_object('invoiceNumber', inv_number, 'invoiceDate', inv_date::text),
    'totals', jsonb_build_object('subtotalCents', subtotal, 'netCents', net, 'vatCents', vat, 'grossCents', net + vat))
$f$;

create function pg_temp.line(idx int, qty bigint, amount bigint, lim_q bigint, lim_a bigint) returns jsonb language sql as $f$
  select jsonb_build_object('index', idx, 'quantityMilli', qty, 'amountCents', amount, 'limitQuantityMilli', lim_q, 'limitAmountCents', lim_a)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000035a1';
  b uuid := '00000000-0000-4000-8000-0000000035b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  q uuid;
  q_b uuid;
  inv uuid;
  inv_b uuid;
  made jsonb;
  made2 jsonb;
  cn1 uuid;
  n integer;
  snap jsonb;
  d date := current_date;
begin
  insert into auth.users (id, email) values (a, 'sa35@example.test'), (b, 'sb35@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi') returning id into cust;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(cust), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 100000)));
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  q_b := public.save_quote_draft(org_b, null, pg_temp.quote_json(null), jsonb_build_array(
    jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Shelf', 'quantity_milli', 1000, 'unit_price_cents', 1000)));
  reset role;

  -- An invoice of R1 150 (two items, put in directly: the invoice tests cover issuing one) and another business's.
  insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_id, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
  values (org_a, 'INV-9101', q, 1, cust, 'Thandi', d - 5, d + 9, 'ZAR', 100000, 15000, 115000,
          jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('name', 'Shelf'), jsonb_build_object('name', 'Sign'))))
  returning id into inv;
  insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
  values (org_b, 'INV-9102', q_b, 1, 'Other', d - 5, d + 9, 'ZAR', 1000, 0, 1000, jsonb_build_object('lines', jsonb_build_array(jsonb_build_object('name', 'x'))))
  returning id into inv_b;

  snap := pg_temp.cn_snap('INV-9101', d - 5, d, 50000, 43478, 6522);

  ----------------------------------------------------------------------
  -- What does not fit is refused, and takes no number
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.issue_credit_note(org_b, inv, b, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), snap);
    raise exception 'another business credited this invoice';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'nonsense', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), snap);
    raise exception 'an unknown reason was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', '   ', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), snap);
    raise exception 'a credit note with no explanation was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', '[]'::jsonb, snap);
    raise exception 'a credit note with no items was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d - 6, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), pg_temp.cn_snap('INV-9101', d - 5, d - 6, 50000, 43478, 6522));
    raise exception 'a credit note before the invoice was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d + 30, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), pg_temp.cn_snap('INV-9101', d - 5, d + 30, 50000, 43478, 6522));
    raise exception 'a credit note dated far ahead was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(5, 1000, 50000, 1000, 100000)), snap);
    raise exception 'an item the invoice does not have was credited';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 500, 25000, 1000, 100000), pg_temp.line(0, 500, 25000, 1000, 100000)), snap);
    raise exception 'an item was credited twice in one note';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 0, 1000, 100000)), snap);
    raise exception 'a credit of nothing was accepted';
  exception when sqlstate '22023' then null;
  end;
  -- The money must add up, and the lines must make the document's subtotal.
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), pg_temp.cn_snap('INV-9101', d - 5, d, 50000, 43478, 6000) || '{"totals": {"subtotalCents": 50000, "netCents": 43478, "vatCents": 6000, "grossCents": 50000}}'::jsonb);
    raise exception 'money that does not add up was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 40000, 1000, 100000)), snap);
    raise exception 'lines that do not make the subtotal were accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 50000, 1000, 100000)), pg_temp.cn_snap('INV-OTHER', d - 5, d, 50000, 43478, 6522));
    raise exception 'a document naming another invoice was accepted';
  exception when sqlstate '22023' then null;
  end;
  -- More than the item allows, and more than the invoice's total.
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 2000, 50000, 1000, 100000)), snap);
    raise exception 'more than the item''s quantity was credited';
  exception when sqlstate '22003' or check_violation then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'returned', 'x', jsonb_build_array(pg_temp.line(0, 1000, 120000, 1000, 120000)),
      pg_temp.cn_snap('INV-9101', d - 5, d, 120000, 104348, 15652));
    raise exception 'more than the invoice''s total was credited';
  exception when sqlstate '22003' then null;
  end;
  reset role;
  assert (select count(*) from public.credit_notes where organisation_id in (org_a, org_b)) = 0, 'a refused credit note was kept';
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'credit_note') is null,
    'a refused credit note used up a number';

  ----------------------------------------------------------------------
  -- Issuing: the next number, the lines, the document
  ----------------------------------------------------------------------
  set local role service_role;
  made := public.issue_credit_note(org_a, inv, a, d, 'returned', '  Two came back cracked  ',
    jsonb_build_array(pg_temp.line(0, 1000, 50000, 2000, 80000)), snap);
  reset role;
  cn1 := (made ->> 'id')::uuid;
  assert made ->> 'number' = 'CN-0001', 'the first credit note number is wrong';
  assert (select snapshot ->> 'number' from public.credit_notes where id = cn1) = 'CN-0001', 'the number is not in the document';
  assert (select explanation from public.credit_notes where id = cn1) = 'Two came back cracked', 'the explanation was not tidied';
  assert (select gross_cents from public.credit_notes where id = cn1) = 50000
     and (select invoice_number from public.credit_notes where id = cn1) = 'INV-9101'
     and (select customer_name from public.credit_notes where id = cn1) = 'Thandi', 'the credit note row is wrong';
  assert (select count(*) from public.credit_note_lines where credit_note_id = cn1) = 1, 'the lines were not kept';

  -- A second note: the same item again, within what is left; the item's limits must not change; going over is refused.
  set local role service_role;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'price', 'x', jsonb_build_array(pg_temp.line(0, 0, 10000, 2000, 90000)),
      pg_temp.cn_snap('INV-9101', d - 5, d, 10000, 8696, 1304));
    raise exception 'an item''s limits changed between credit notes';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'price', 'x', jsonb_build_array(pg_temp.line(0, 0, 30001, 2000, 80000)),
      pg_temp.cn_snap('INV-9101', d - 5, d, 30001, 26088, 3913));
    raise exception 'more than was left on the item was credited';
  exception when sqlstate '22003' then null;
  end;
  made2 := public.issue_credit_note(org_a, inv, a, d, 'price', 'Agreed a lower price', jsonb_build_array(pg_temp.line(0, 1000, 30000, 2000, 80000)),
    pg_temp.cn_snap('INV-9101', d - 5, d, 30000, 26087, 3913));
  assert made2 ->> 'number' = 'CN-0002', 'credit note numbers were not sequential';
  -- The quantity left on the item is now gone: 1 + 1 of 2.
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'price', 'x', jsonb_build_array(pg_temp.line(0, 1000, 100, 2000, 80000)),
      pg_temp.cn_snap('INV-9101', d - 5, d, 100, 87, 13));
    raise exception 'more than the item''s quantity was credited across notes';
  exception when sqlstate '22003' then null;
  end;
  -- The invoice's total: 115000 - 50000 - 30000 = 35000 left; 35001 is refused, 35000 is fine.
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'other', 'x', jsonb_build_array(pg_temp.line(1, 0, 35001, 0, 35001)),
      pg_temp.cn_snap('INV-9101', d - 5, d, 35001, 30436, 4565));
    raise exception 'more than the invoice''s total was credited across notes';
  exception when sqlstate '22003' then null;
  end;
  reset role;
  assert (select last_issued_number from public.document_sequences where organisation_id = org_a and doc_type = 'credit_note') = 2,
    'refused credit notes used up numbers';

  ----------------------------------------------------------------------
  -- What is owing takes the credit off: payments and Home's totals
  ----------------------------------------------------------------------
  set local role service_role;
  begin
    perform public.record_invoice_payment(org_a, inv, a, 35001, d, null, null);
    raise exception 'a payment passed what is owing after the credit';
  exception when sqlstate '22003' then null;
  end;
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on) values (org_a, inv, 35001, d);
    raise exception 'a payment inserted directly passed what is owing after the credit';
  exception when sqlstate '22003' then null;
  end;
  made := public.record_invoice_payment(org_a, inv, a, 20000, d, null, null);
  assert (made ->> 'owingCents')::bigint = 15000, 'owing after a payment and credits is wrong';
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  made := public.invoice_owed_totals(org_a, d - 100);
  assert (made ->> 'count')::integer = 1 and (made ->> 'owingCents')::bigint = 15000, 'Home''s owing ignores the credit: ' || made::text;
  reset role;

  ----------------------------------------------------------------------
  -- Numbering can be set like the others; the next number never goes back
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  perform public.set_document_numbering(org_a, 'credit_note', 'CR/', 500);
  begin
    perform public.set_document_numbering(org_a, 'credit_note', 'CR/', 2);
    raise exception 'credit note numbering went back';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_document_numbering(org_a, 'receipt', 'R-', 1);
    raise exception 'an unknown document type was accepted';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  set local role service_role;
  made := public.issue_credit_note(org_a, inv, a, d, 'other', 'The rest', jsonb_build_array(pg_temp.line(1, 0, 35000, 0, 35000)),
    pg_temp.cn_snap('INV-9101', d - 5, d, 35000, 30435, 4565));
  reset role;
  assert made ->> 'number' = 'CR/0500', 'the continued number is wrong';

  ----------------------------------------------------------------------
  -- Nobody writes directly, changes one or deletes one; only the server issues
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.credit_notes (organisation_id, number, invoice_id, invoice_number, customer_name, issue_date, reason, explanation, currency_code, net_cents, vat_cents, gross_cents, snapshot)
    values (org_a, 'CN-9', inv, 'INV-9101', 'X', d, 'other', 'x', 'ZAR', 1, 0, 1, '{}'::jsonb);
    raise exception 'a member wrote a credit note directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.credit_notes set explanation = 'changed';
    raise exception 'a member changed a credit note';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.credit_notes;
    raise exception 'a member deleted a credit note';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.issue_credit_note(org_a, inv, a, d, 'other', 'x', '[]'::jsonb, '{}'::jsonb);
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    update public.credit_notes set gross_cents = 1, net_cents = 1, vat_cents = 0 where id = cn1;
    raise exception 'an issued credit note was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.credit_notes where id = cn1;
    raise exception 'an issued credit note was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    update public.credit_note_lines set amount_cents = 1 where credit_note_id = cn1;
    raise exception 'a credit note line was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.credit_note_lines where credit_note_id = cn1;
    raise exception 'a credit note line was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    truncate public.credit_notes cascade;
    raise exception 'the credit notes were truncated';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.invoices where id = inv;
    raise exception 'an invoice with credit notes was deleted';
  exception when sqlstate '55000' then null;
  end;
  -- Forgetting a deleted login is the one allowed change.
  update public.credit_notes set issued_by = null where id = cn1;
  assert (select issued_by from public.credit_notes where id = cn1) is null, 'the issuer could not be forgotten';

  ----------------------------------------------------------------------
  -- Members of the business read; nobody else does; a session is required
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.credit_notes;
  assert n = 3, 'a member cannot read the credit notes';
  select count(*) into n from public.credit_note_lines;
  assert n = 3, 'a member cannot read the credit note lines';
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.credit_notes;
  assert n = 0, 'another business can read credit notes';
  select count(*) into n from public.credit_note_lines;
  assert n = 0, 'another business can read credit note lines';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.credit_notes;
  assert n = 0, 'a login with no active session can read credit notes';
  reset role;

  raise notice 'credit note tests passed';
end
$$;

rollback;
