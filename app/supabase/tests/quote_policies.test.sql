-- Quote policies: the library (readable by members, written by owners and admins only, never
-- deleted) and a quote's own copy. Plain SQL, one transaction, rolled back at the end.

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
    'customer_id', null, 'issue_date', '2026-10-06', 'valid_until', '2026-10-20',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0) || extra
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000011a1';
  b uuid := '00000000-0000-4000-8000-0000000011b1';
  c uuid := '00000000-0000-4000-8000-0000000011c1';
  org_a uuid;
  org_b uuid;
  pol uuid;
  q uuid;
begin
  insert into auth.users (id, email) values (a, 'pa@example.test'), (b, 'pb@example.test'), (c, 'pc@example.test');

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, c, 'staff');

  ----------------------------------------------------------------------
  -- The library: owners write, members read, other businesses see nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.policies (organisation_id, kind, title, body, include_by_default)
  values (org_a, 'cancellation', 'Cancellation', 'You pay the deposit and the cost of work done.', true)
  returning id into pol;
  update public.policies set title = 'If you cancel', sort_order = 1 where id = pol;
  assert (select title from public.policies where id = pol) = 'If you cancel', 'owner could not edit';
  update public.policies set archived_at = now() where id = pol;
  assert (select archived_at is not null from public.policies where id = pol), 'owner could not archive';

  begin
    insert into public.policies (organisation_id, kind, title, body) values (org_a, 'nonsense', 'x', 'y');
    raise exception 'FAIL: an unknown kind was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.policies (organisation_id, kind, title, body) values (org_a, 'changes', '', 'y');
    raise exception 'FAIL: an empty title was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.policies (organisation_id, kind, title, body) values (org_a, 'changes', 'x', repeat('y', 2001));
    raise exception 'FAIL: an over-long body was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.policies set organisation_id = org_b where id = pol;
    raise exception 'FAIL: a policy moved to another business';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.policies where id = pol;
    raise exception 'FAIL: a policy was deleted';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Staff can read it but not write it.
  perform pg_temp.as_user(c);
  set local role authenticated;
  assert (select count(*) from public.policies where organisation_id = org_a) = 1, 'staff cannot read the library';
  begin
    insert into public.policies (organisation_id, kind, title, body) values (org_a, 'changes', 'Mine', 'text');
    raise exception 'FAIL: staff added a policy';
  exception when insufficient_privilege then null;
  end;
  update public.policies set body = 'Hijacked' where id = pol;
  assert (select body from public.policies where id = pol) <> 'Hijacked', 'staff edited a policy';
  reset role;

  -- Another business sees nothing and cannot add to this one.
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.policies) = 0, 'another business can read the library';
  begin
    insert into public.policies (organisation_id, kind, title, body) values (org_a, 'changes', 'Mine', 'text');
    raise exception 'FAIL: another business added a policy';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- A quote's own copy
  ----------------------------------------------------------------------
  perform pg_temp.as_user(c);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null,
    pg_temp.quote_json(jsonb_build_object('policies',
      jsonb_build_array(jsonb_build_object('policy_id', pol, 'kind', 'cancellation', 'title', 'Cancellation', 'body', 'Edited for this quote')))),
    '[]'::jsonb);
  assert (select policies -> 0 ->> 'body' from public.quotes where id = q) = 'Edited for this quote',
    'the quote did not keep its own copy';

  -- Saving without the key clears them; the library is untouched by a quote.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json('{}'), '[]'::jsonb);
  assert (select jsonb_array_length(policies) from public.quotes where id = q) = 0, 'policies were not cleared';
  assert (select body from public.policies where id = pol) = 'You pay the deposit and the cost of work done.',
    'a quote changed the library';

  begin
    perform public.save_quote_draft(org_a, q,
      pg_temp.quote_json(jsonb_build_object('policies', (select jsonb_agg(jsonb_build_object('kind', 'changes', 'title', 't', 'body', 'b')) from generate_series(1, 13)))),
      '[]'::jsonb);
    raise exception 'FAIL: 13 policies on a quote were accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.save_quote_draft(org_a, q,
      pg_temp.quote_json(jsonb_build_object('policies', jsonb_build_object('not', 'a list'))), '[]'::jsonb);
    raise exception 'FAIL: policies that are not a list were accepted';
  exception when check_violation then null;
  end;
  reset role;

  ----------------------------------------------------------------------
  -- Once a quote is sent, its policies are frozen with it
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  declare
    cust uuid;
    sent uuid;
    stamp timestamptz;
    num text;
  begin
    insert into public.customers (organisation_id, name) values (org_a, 'A customer') returning id into cust;
    sent := public.save_quote_draft(org_a, null,
      pg_temp.quote_json(jsonb_build_object('customer_id', cust, 'policies',
        jsonb_build_array(jsonb_build_object('kind', 'changes', 'title', 'Changes', 'body', 'As sent')))),
      jsonb_build_array(jsonb_build_object('sort_order', 0, 'kind', 'custom', 'name', 'Cake',
        'quantity_milli', 1000, 'unit_price_cents', 1000)));
    reset role;
    select number, updated_at into num, stamp from public.quotes where id = sent;
    set local role service_role;
    perform public.send_quote(org_a, sent, a, 'marked', stamp, jsonb_build_object('number', num, 'version', 1), 1000, 0, 1000);
    reset role;
    perform pg_temp.as_user(a);
    set local role authenticated;
    update public.quotes set policies = '[]'::jsonb where id = sent;
    assert (select policies -> 0 ->> 'body' from public.quotes where id = sent) = 'As sent',
      'the policies of a sent quote were changed';
    begin
      perform public.save_quote_draft(org_a, sent, pg_temp.quote_json('{}'), '[]'::jsonb);
      raise exception 'FAIL: a sent quote was saved over';
    exception when no_data_found then null;
    end;
  end;
  reset role;

  raise notice 'quote policies tests passed';
end
$$;

rollback;
