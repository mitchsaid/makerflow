-- Ways to pay: every member reads, ONLY owners write, another business sees nothing, at most 20 a business,
-- and the per-quote list of ways left off. Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

create function pg_temp.quote_json(extra jsonb) returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', null, 'issue_date', '2026-10-07', 'valid_until', '2026-10-21',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000013a1';  -- owner of org A
  b uuid := '00000000-0000-4000-8000-0000000013b1';  -- owner of org B
  c uuid := '00000000-0000-4000-8000-0000000013c1';  -- staff in A
  d uuid := '00000000-0000-4000-8000-0000000013d1';  -- admin in A
  org_a uuid;
  org_b uuid;
  pm uuid;
  pm2 uuid;
  q uuid;
begin
  insert into auth.users (id, email) values
    (a, 'pa@example.test'), (b, 'pb@example.test'), (c, 'pc@example.test'), (d, 'pd@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff'), (org_a, d, 'admin');

  ----------------------------------------------------------------------
  -- The owner writes
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.payment_methods (organisation_id, kind, name, details)
  values (org_a, 'link', 'Pay by card', '{"url":"https://pay.example.test/a"}') returning id into pm;
  insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'collection', 'Cash on collection') returning id into pm2;
  assert (select on_new_quotes from public.payment_methods where id = pm), 'a way is not on new quotes by default';
  update public.payment_methods set name = 'Pay online', on_new_quotes = false where id = pm;
  assert (select name from public.payment_methods where id = pm) = 'Pay online', 'the owner could not change a way';

  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'Bad Kind', 'x');
    raise exception 'FAIL: a kind that is not a slug was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'link', '   ');
    raise exception 'FAIL: an empty name was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.payment_methods set details = '[]'::jsonb where id = pm;
    raise exception 'FAIL: details that are not an object were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.payment_methods set details = jsonb_build_object('x', repeat('y', 2100)) where id = pm;
    raise exception 'FAIL: oversized details were accepted';
  exception when check_violation then null;
  end;
  begin
    update public.payment_methods set organisation_id = org_b where id = pm;
    raise exception 'FAIL: a way moved to another business';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Admins and staff read them but cannot add, change or remove
  ----------------------------------------------------------------------
  perform pg_temp.as_user(d);
  set local role authenticated;
  assert (select count(*) from public.payment_methods where organisation_id = org_a) = 2, 'an admin cannot read them';
  update public.payment_methods set name = 'Fraud' where id = pm;
  assert (select name from public.payment_methods where id = pm) = 'Pay online', 'an admin changed a way';
  delete from public.payment_methods where id = pm;
  assert (select count(*) from public.payment_methods where id = pm) = 1, 'an admin removed a way';
  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'link', 'Fraud');
    raise exception 'FAIL: an admin added a way to pay';
  exception when insufficient_privilege then null;
  end;
  reset role;

  perform pg_temp.as_user(c);
  set local role authenticated;
  assert (select count(*) from public.payment_methods where organisation_id = org_a) = 2, 'staff cannot read them';
  update public.payment_methods set name = 'Fraud' where id = pm;
  assert (select name from public.payment_methods where id = pm) = 'Pay online', 'staff changed a way';
  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'link', 'Fraud');
    raise exception 'FAIL: staff added a way to pay';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees nothing and changes nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.payment_methods) = 0, 'another business can read the ways to pay';
  update public.payment_methods set name = 'Fraud' where id = pm;
  delete from public.payment_methods where id = pm;
  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'link', 'Fraud');
    raise exception 'FAIL: another business added a way to pay';
  exception when insufficient_privilege then null;
  end;
  reset role;
  assert (select name from public.payment_methods where id = pm) = 'Pay online', 'another business changed a way';

  ----------------------------------------------------------------------
  -- At most 20 a business; the owner can remove one
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  for i in 3..20 loop
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'other', 'Way ' || i);
  end loop;
  begin
    insert into public.payment_methods (organisation_id, kind, name) values (org_a, 'other', 'One too many');
    raise exception 'FAIL: a 21st way to pay was accepted';
  exception when program_limit_exceeded then null;
  end;
  delete from public.payment_methods where id = pm2;
  assert (select count(*) from public.payment_methods where organisation_id = org_a) = 19, 'the owner could not remove a way';
  reset role;

  ----------------------------------------------------------------------
  -- The per-quote list of ways left off: empty by default, carried by the save function, kept when a payload lacks it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select hidden_payment_methods from public.quotes where id = q) = '{}', 'ways are hidden by default';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(jsonb_build_object('hidden_payment_methods', jsonb_build_array(pm))), '[]'::jsonb);
  assert (select hidden_payment_methods from public.quotes where id = q) = array[pm], 'the hidden ways were not saved';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select hidden_payment_methods from public.quotes where id = q) = array[pm], 'a payload without the key changed the hidden ways';
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"hidden_payment_methods": []}'), '[]'::jsonb);
  assert (select hidden_payment_methods from public.quotes where id = q) = '{}', 'the hidden ways could not be cleared';
  reset role;

  raise notice 'payment methods tests passed';
end
$$;

rollback;
