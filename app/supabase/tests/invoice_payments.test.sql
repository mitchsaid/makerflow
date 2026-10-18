-- Invoice payments (docs/plans/invoices-and-payments.md, slice I2; migration 20261116100000): written only by the
-- server-only record_invoice_payment and reverse_invoice_payment, append-only for every path, never more than the invoice
-- total (even from two payments at once, by the invoice's row lock), a mistake undone by a reversal, readable by members
-- of the business only. Plain SQL, one transaction, rolled back.

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

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000034a1';
  b uuid := '00000000-0000-4000-8000-0000000034b1';
  org_a uuid;
  org_b uuid;
  cust uuid;
  q uuid;
  q_b uuid;
  inv uuid;
  inv_b uuid;
  p1 uuid;
  p2 uuid;
  r1 uuid;
  made jsonb;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'sa34@example.test'), (b, 'sb34@example.test');
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

  -- Two invoices with a quote each, put in directly (the invoice tests cover issuing them).
  insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_id, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
  values (org_a, 'INV-9001', q, 1, cust, 'Thandi', '2026-10-20', '2026-11-03', 'ZAR', 100000, 15000, 115000, '{}'::jsonb) returning id into inv;
  insert into public.invoices (organisation_id, number, quote_id, quote_version, customer_name, issue_date, due_date, currency_code, net_cents, vat_cents, gross_cents, snapshot)
  values (org_b, 'INV-9002', q_b, 1, 'Other', '2026-10-20', '2026-11-03', 'ZAR', 1000, 0, 1000, '{}'::jsonb) returning id into inv_b;

  ----------------------------------------------------------------------
  -- Recording: the amount, the day, the invoice's own business
  ----------------------------------------------------------------------
  set local role service_role;
  made := public.record_invoice_payment(org_a, inv, a, 40000, current_date, 'eft', '  Deposit  ');
  p1 := (made ->> 'id')::uuid;
  assert (made ->> 'paidCents')::bigint = 40000 and (made ->> 'owingCents')::bigint = 75000, 'the balance after a payment is wrong';
  begin
    perform public.record_invoice_payment(org_a, inv, a, 0, current_date, null, null);
    raise exception 'a payment of nothing was recorded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_invoice_payment(org_a, inv, a, -5, current_date, null, null);
    raise exception 'a negative payment was recorded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_invoice_payment(org_a, inv, a, 100, current_date + 30, null, null);
    raise exception 'a payment dated far ahead was recorded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.record_invoice_payment(org_a, inv, a, 100, current_date, 'bitcoin', null);
    raise exception 'an unknown way to pay was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.record_invoice_payment(org_a, inv_b, a, 100, current_date, null, null);
    raise exception 'another business''s invoice took a payment';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.record_invoice_payment(org_b, inv, b, 100, current_date, null, null);
    raise exception 'another business paid this invoice';
  exception when sqlstate 'P0002' then null;
  end;
  -- Never more than what is owing.
  begin
    perform public.record_invoice_payment(org_a, inv, a, 75001, current_date, null, null);
    raise exception 'an overpayment was recorded';
  exception when sqlstate '22003' then null;
  end;
  reset role;
  assert (select count(*) from public.invoice_payments where invoice_id = inv) = 1, 'a refused payment left an entry';
  assert (select note from public.invoice_payments where id = p1) = 'Deposit', 'the note was not tidied';

  -- Paying it off exactly is fine; nothing more fits after.
  set local role service_role;
  made := public.record_invoice_payment(org_a, inv, a, 75000, current_date - 1, null, null);
  p2 := (made ->> 'id')::uuid;
  assert (made ->> 'owingCents')::bigint = 0, 'paid in full still owes something';
  begin
    perform public.record_invoice_payment(org_a, inv, a, 1, current_date, null, null);
    raise exception 'a payment on a paid invoice was recorded';
  exception when sqlstate '22003' then null;
  end;

  ----------------------------------------------------------------------
  -- Reversing: once, for the same amount, restoring what is owing; a reversal cannot be reversed
  ----------------------------------------------------------------------
  made := public.reverse_invoice_payment(org_a, p2, a, current_date, 'Bounced');
  r1 := (made ->> 'id')::uuid;
  assert (made ->> 'paidCents')::bigint = 40000 and (made ->> 'owingCents')::bigint = 75000, 'a reversal did not restore what is owing';
  begin
    perform public.reverse_invoice_payment(org_a, p2, a, current_date, null);
    raise exception 'a payment was reversed twice';
  exception when sqlstate '23505' then null;
  end;
  begin
    perform public.reverse_invoice_payment(org_a, r1, a, current_date, null);
    raise exception 'a reversal was reversed';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.reverse_invoice_payment(org_b, p1, b, current_date, null);
    raise exception 'another business reversed a payment';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.reverse_invoice_payment(org_a, gen_random_uuid(), a, current_date, null);
    raise exception 'a payment that does not exist was reversed';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;
  assert (select amount_cents from public.invoice_payments where id = r1) = 75000
     and (select reverses_id from public.invoice_payments where id = r1) = p2
     and (select note from public.invoice_payments where id = r1) = 'Bounced', 'the reversal entry is wrong';
  -- The database itself refuses a reversal that points at another invoice's payment, or a second one for a payment.
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, reverses_id)
    values (org_b, inv_b, 40000, current_date, p1);
    raise exception 'a reversal of another invoice''s payment was inserted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, reverses_id)
    values (org_a, inv, 75000, current_date, p2);
    raise exception 'a second reversal was inserted';
  exception when unique_violation then null;
  end;

  -- Even a direct insert (the server key) cannot break the money rules.
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, reverses_id)
    values (org_a, inv, 74999, current_date, p1);
    raise exception 'a reversal for a different amount was inserted';
  exception when sqlstate '22023' then null;
  end;
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, reverses_id)
    values (org_a, inv, 75000, current_date, r1);
    raise exception 'a reversal of a reversal was inserted';
  exception when sqlstate '22023' then null;
  end;
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on) values (org_a, inv, 75001, current_date);
    raise exception 'an overpayment was inserted directly';
  exception when sqlstate '22003' then null;
  end;

  ----------------------------------------------------------------------
  -- Home's totals: only what is still owing, and what of it is overdue; only the person's own business
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  made := public.invoice_owed_totals(org_a, date '2026-10-01');
  assert made = '{"count": 1, "owingCents": 75000, "overdueCents": 0}'::jsonb, 'the totals owed are wrong: ' || made::text;
  made := public.invoice_owed_totals(org_a, date '2026-12-01');
  assert (made ->> 'overdueCents')::bigint = 75000, 'the overdue amount is wrong';
  made := public.invoice_owed_totals(org_b, date '2026-10-01');
  assert (made ->> 'count')::integer = 0, 'another business''s invoices were counted';
  reset role;

  ----------------------------------------------------------------------
  -- Nobody writes directly, changes an entry or deletes one; only the server runs the functions
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on) values (org_a, inv, 1, current_date);
    raise exception 'a member wrote a payment directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invoice_payments set amount_cents = 1;
    raise exception 'a member changed a payment';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.invoice_payments;
    raise exception 'a member deleted a payment';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_invoice_payment(org_a, inv, a, 1, current_date, null, null);
    raise exception 'a member called the server-only function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reverse_invoice_payment(org_a, p1, a, current_date, null);
    raise exception 'a member called the server-only reversal';
  exception when insufficient_privilege then null;
  end;
  reset role;
  begin
    update public.invoice_payments set amount_cents = 1 where id = p1;
    raise exception 'a payment entry was changed';
  exception when sqlstate '55000' then null;
  end;
  begin
    delete from public.invoice_payments where id = p1;
    raise exception 'a payment entry was deleted';
  exception when sqlstate '55000' then null;
  end;
  begin
    truncate public.invoice_payments;
    raise exception 'the payments were truncated';
  exception when sqlstate '55000' then null;
  end;
  -- Forgetting a deleted login is the one allowed change.
  update public.invoice_payments set created_by = null where id = p1;
  assert (select created_by from public.invoice_payments where id = p1) is null, 'the recorder could not be forgotten';

  ----------------------------------------------------------------------
  -- Members of the business read; nobody else does; a session is required
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.invoice_payments;
  assert n = 3, 'a member cannot read the payments';
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  select count(*) into n from public.invoice_payments;
  assert n = 0, 'another business can read payments';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.invoice_payments;
  assert n = 0, 'a login with no active session can read payments';
  reset role;

  raise notice 'invoice payment tests passed';
end
$$;

rollback;
