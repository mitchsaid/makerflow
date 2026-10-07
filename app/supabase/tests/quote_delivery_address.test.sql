-- Quote delivery address: saved with the draft, kept by an older payload, trimmed, limited to 400
-- characters, and never readable across businesses. Plain SQL, one transaction, rolled back.

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
    'customer_id', null, 'issue_date', '2026-10-12', 'valid_until', '2026-10-26',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000015a1';
  b uuid := '00000000-0000-4000-8000-0000000015b1';
  org_a uuid;
  org_b uuid;
  q uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'da@example.test'), (b, 'db@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;

  -- No address by default, and an older payload (no key) means none.
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select delivery_address is null from public.quotes where id = q), 'no address should mean null';

  -- Saved with the draft, with its line breaks, trimmed.
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json(jsonb_build_object('delivery_address', E'  22 Jacaranda Avenue\nParkhurst  ')), '[]'::jsonb);
  assert (select delivery_address = E'22 Jacaranda Avenue\nParkhurst' from public.quotes where id = q),
    'the address was not saved, or not trimmed';

  -- An older app (no key) saving the draft leaves the address alone.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select delivery_address = E'22 Jacaranda Avenue\nParkhurst' from public.quotes where id = q),
    'a payload without the key changed the address';

  -- An explicit null clears it too (unlike a missing key, which keeps it).
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"delivery_address":null}'), '[]'::jsonb);
  assert (select delivery_address is null from public.quotes where id = q), 'an explicit null did not clear the address';
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json(jsonb_build_object('delivery_address', 'Back again')), '[]'::jsonb);

  -- An empty or blank address clears it.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"delivery_address":"   "}'), '[]'::jsonb);
  assert (select delivery_address is null from public.quotes where id = q), 'a blank address was kept';

  -- At most 400 characters.
  perform public.save_quote_draft(org_a, q,
    pg_temp.quote_json(jsonb_build_object('delivery_address', repeat('x', 400))), '[]'::jsonb);
  begin
    perform public.save_quote_draft(org_a, q,
      pg_temp.quote_json(jsonb_build_object('delivery_address', repeat('x', 401))), '[]'::jsonb);
    raise exception 'FAIL: an address over 400 characters was saved';
  exception when check_violation then null;
  end;

  -- A new quote can start with one.
  q := public.save_quote_draft(org_a, null,
    pg_temp.quote_json('{"delivery_address":"The gate at the back"}'), '[]'::jsonb);
  assert (select delivery_address = 'The gate at the back' from public.quotes where id = q), 'a new quote did not take the address';
  reset role;

  -- Another business cannot see it, or change it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.quotes where delivery_address is not null) = 0, 'another business can read addresses';
  update public.quotes set delivery_address = 'hijacked' where id = q;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed an address';
  begin
    perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{"delivery_address":"hijacked"}'), '[]'::jsonb);
    raise exception 'FAIL: a non-member saved a draft of another business';
  exception when insufficient_privilege or no_data_found then null;
  end;
  reset role;
  assert (select delivery_address = 'The gate at the back' from public.quotes where id = q), 'the address was changed';

  raise notice 'quote delivery address tests passed';
end
$$;

rollback;
