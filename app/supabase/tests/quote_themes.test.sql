-- Quote themes: a business's saved looks are readable by its members and changed by owners and admins
-- only, never visible to another business, limited in number and size; a quote and the business default
-- can point at one (same business only) or at a starter; deleting a theme in use clears the reference.
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

create function pg_temp.quote_json() returns jsonb language sql as $f$
  select jsonb_build_object(
    'customer_id', null, 'issue_date', '2026-10-15', 'valid_until', '2026-10-29',
    'country_code', 'ZA', 'currency_code', 'ZAR',
    'net_cents', 0, 'vat_cents', 0, 'gross_cents', 0)
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000018a1';  -- owner of org A
  s uuid := '00000000-0000-4000-8000-0000000018a2';  -- staff in A
  b uuid := '00000000-0000-4000-8000-0000000018b1';  -- owner of org B
  org_a uuid;
  org_b uuid;
  t uuid;
  t2 uuid;
  tb uuid;
  q uuid;
  q2 uuid;
  q3 uuid;
  q4 uuid;
  q5 uuid;
  q6 uuid;
  n integer;
begin
  insert into auth.users (id, email) values (a, 'ta@example.test'), (s, 'ts@example.test'), (b, 'tb@example.test');
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  reset role;
  insert into public.memberships (organisation_id, user_id, role) values (org_a, s, 'staff');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.quote_themes (organisation_id, name, spec) values (org_b, 'B look', '{"accent":"#000000"}') returning id into tb;
  reset role;

  ----------------------------------------------------------------------
  -- Owners create, read, rename, change and delete themes
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Market stall', '{"accent":"#b45309","layout":"cards"}') returning id into t;
  update public.quote_themes set name = 'Market stall 2', spec = '{"accent":"#0f766e"}' where id = t;
  assert (select name = 'Market stall 2' and spec ->> 'accent' = '#0f766e' from public.quote_themes where id = t), 'theme not changed';

  -- Limits.
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, '', '{}');
    raise exception 'FAIL: an empty name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, repeat('x', 41), '{}');
    raise exception 'FAIL: a long name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'List', '[1]');
    raise exception 'FAIL: a spec that is not an object was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Big', jsonb_build_object('x', repeat('a', 2100)));
    raise exception 'FAIL: an oversized spec was accepted';
  exception when check_violation then null;
  end;
  -- The business cannot be moved.
  begin
    update public.quote_themes set organisation_id = org_b where id = t;
    raise exception 'FAIL: a theme was moved to another business';
  exception when insufficient_privilege then null;
  end;
  -- At most 30 a business.
  for i in 2..30 loop
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Theme ' || i, '{}');
  end loop;
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'One too many', '{}');
    raise exception 'FAIL: a 31st theme was accepted';
  exception when sqlstate '54000' then null;
  end;
  delete from public.quote_themes where name like 'Theme %';
  reset role;

  ----------------------------------------------------------------------
  -- Staff read but cannot write; another business sees nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(s);
  set local role authenticated;
  assert (select count(*) from public.quote_themes where id = t) = 1, 'staff cannot read the themes';
  begin
    insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Staff look', '{}');
    raise exception 'FAIL: staff created a theme';
  exception when insufficient_privilege then null;
  end;
  update public.quote_themes set name = 'Hacked' where id = t;
  get diagnostics n = row_count;
  assert n = 0, 'staff changed a theme';
  delete from public.quote_themes where id = t;
  get diagnostics n = row_count;
  assert n = 0, 'staff deleted a theme';
  reset role;

  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.quote_themes where id = t) = 0, 'another business can read a theme';
  update public.quote_themes set name = 'Hacked' where id = t;
  get diagnostics n = row_count;
  assert n = 0, 'another business changed a theme';
  delete from public.quote_themes where id = t;
  get diagnostics n = row_count;
  assert n = 0, 'another business deleted a theme';
  reset role;

  ----------------------------------------------------------------------
  -- A quote picks a theme (any member), a starter, or follows the default
  ----------------------------------------------------------------------
  perform pg_temp.as_user(s);
  set local role authenticated;
  q := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id is null and theme_starter is null from public.quotes where id = q), 'a new quote should follow the default';
  update public.quotes set theme_id = t where id = q;
  assert (select theme_id = t from public.quotes where id = q), 'theme not picked';
  -- Saving the draft's content again leaves the theme alone.
  perform public.save_quote_draft(org_a, q, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id = t from public.quotes where id = q), 'saving the draft changed its theme';
  update public.quotes set theme_id = null, theme_starter = 'bold' where id = q;
  assert (select theme_starter = 'bold' from public.quotes where id = q), 'starter not picked';
  begin
    update public.quotes set theme_starter = 'fancy' where id = q;
    raise exception 'FAIL: an unknown starter was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.quotes set theme_id = t where id = q;  -- a starter is still set
    raise exception 'FAIL: a theme and a starter were both accepted';
  exception when check_violation then null;
  end;
  -- Another business's theme cannot be used.
  begin
    update public.quotes set theme_starter = null, theme_id = tb where id = q;
    raise exception 'FAIL: another business''s theme was accepted';
  exception when foreign_key_violation then null;
  end;
  update public.quotes set theme_starter = null, theme_id = t where id = q;
  reset role;

  -- A sent quote's theme cannot change.
  update public.quotes set status = 'sent' where id = q;
  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.quotes set theme_id = null, theme_starter = 'soft' where id = q;
  get diagnostics n = row_count;
  assert n = 0, 'a sent quote''s theme was changed';
  reset role;

  ----------------------------------------------------------------------
  -- Deleting a theme clears what points at it; a new quote starts with the last theme chosen
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  -- q (above) now has theme t, chosen by the staff member: it is the latest pick in the business.
  delete from public.quote_themes where id = t;
  assert (select theme_id is null and organisation_id = org_a from public.quotes where id = q), 'a quote still points at a deleted theme (or lost its business)';
  reset role;

  -- No pick is left (the only theme was deleted): a new quote follows nothing.
  perform pg_temp.as_user(s);
  set local role authenticated;
  q2 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id is null and theme_starter is null and theme_picked_at is null from public.quotes where id = q2), 'a new quote took a theme with nothing chosen';

  -- Choosing a starter on it counts as the latest pick; the next new quote starts with it.
  update public.quotes set theme_starter = 'warm' where id = q2;
  assert (select theme_picked_at is not null from public.quotes where id = q2), 'a pick was not stamped';
  q3 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_starter = 'warm' and theme_picked_at is null from public.quotes where id = q3), 'a new quote did not start with the last chosen theme';

  -- The latest pick wins, whichever quote it was on; taking a theme at creation is not a pick.
  update public.quotes set theme_starter = 'bold' where id = q3;
  q4 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_starter = 'bold' from public.quotes where id = q4), 'the latest pick did not win';
  -- A theme of the business's own can be the last chosen too (an owner makes it, anyone picks it).
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Mine', '{}') returning id into t2;
  reset role;
  perform pg_temp.as_user(s);
  set local role authenticated;
  update public.quotes set theme_starter = null, theme_id = t2 where id = q2;
  assert (select theme_id = t2 and theme_picked_at is not null from public.quotes where id = q2), 'own theme not stamped';
  q4 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id = t2 from public.quotes where id = q4), 'a new quote did not start with the last chosen own theme';
  reset role;
  -- Deleting that theme: new quotes take the next most recent pick (never a dangling id).
  perform pg_temp.as_user(a);
  set local role authenticated;
  delete from public.quote_themes where id = t2;
  reset role;
  perform pg_temp.as_user(s);
  set local role authenticated;
  q5 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id is null and theme_starter = 'bold' from public.quotes where id = q5), 'a new quote points at a deleted theme, or missed the next pick';
  reset role;

  -- Another business's picks never reach this one.
  perform pg_temp.as_user(b);
  set local role authenticated;
  q6 := public.save_quote_draft(org_b, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id is null and theme_starter is null from public.quotes where id = q6), 'another business''s theme was inherited';
  reset role;

  raise notice 'quote themes tests passed';
end
$$;

rollback;
