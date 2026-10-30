-- Themes on invoice drafts: a draft can point at one of its business's themes or a starter (not both, not another
-- business's), deleting a theme clears the reference, a pick is stamped, and a new draft or quote starts with the
-- theme chosen last on either. Plain SQL, one transaction, rolled back.

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
  a uuid := '00000000-0000-4000-8000-0000000029a1';
  b uuid := '00000000-0000-4000-8000-0000000029b1';
  org_a uuid;
  org_b uuid;
  t uuid;
  tb uuid;
  d1 uuid;
  d2 uuid;
  d3 uuid;
  q1 uuid;
  q2 uuid;
begin
  insert into auth.users (id, email) values (a, 'ta29@example.test'), (b, 'tb29@example.test');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.quote_themes (organisation_id, name, spec) values (org_b, 'B look', '{"accent":"#000000"}') returning id into tb;
  reset role;

  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.quote_themes (organisation_id, name, spec) values (org_a, 'Market stall', '{"accent":"#b45309"}') returning id into t;

  -- Nothing chosen anywhere: a new draft follows nothing.
  insert into public.invoice_drafts (organisation_id, form, created_by) values (org_a, '{}'::jsonb, a) returning id into d1;
  assert (select theme_id is null and theme_starter is null and theme_picked_at is null from public.invoice_drafts where id = d1), 'a draft took a theme with nothing chosen';

  -- Choosing a starter is stamped as a pick; the next draft starts with it, without that being a pick.
  update public.invoice_drafts set theme_starter = 'warm' where id = d1;
  assert (select theme_picked_at is not null from public.invoice_drafts where id = d1), 'a pick was not stamped';
  insert into public.invoice_drafts (organisation_id, form, created_by) values (org_a, '{}'::jsonb, a) returning id into d2;
  assert (select theme_starter = 'warm' and theme_picked_at is null from public.invoice_drafts where id = d2), 'a new draft did not start with the last chosen theme';

  -- One shared default: a pick on a quote is the latest, and a new draft starts with it; and the other way round.
  q1 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  update public.quotes set theme_starter = 'bold' where id = q1;
  insert into public.invoice_drafts (organisation_id, form, created_by) values (org_a, '{}'::jsonb, a) returning id into d3;
  assert (select theme_starter = 'bold' from public.invoice_drafts where id = d3), 'a draft did not start with the theme last chosen on a quote';
  update public.invoice_drafts set theme_id = t, theme_starter = null where id = d3;
  q2 := public.save_quote_draft(org_a, null, pg_temp.quote_json(), '[]'::jsonb);
  assert (select theme_id = t from public.quotes where id = q2), 'a quote did not start with the theme last chosen on an invoice draft';

  -- A theme and a starter together are refused, as is another business's theme.
  begin
    update public.invoice_drafts set theme_starter = 'soft' where id = d3;  -- theme_id t is still set
    raise exception 'FAIL: a theme and a starter were both accepted';
  exception when check_violation then null;
  end;
  begin
    update public.invoice_drafts set theme_starter = null, theme_id = tb where id = d3;
    raise exception 'FAIL: another business''s theme was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.invoice_drafts set theme_starter = 'nonsense', theme_id = null where id = d3;
    raise exception 'FAIL: an unknown starter was accepted';
  exception when check_violation then null;
  end;

  -- Deleting a theme clears the reference.
  delete from public.quote_themes where id = t;
  assert (select theme_id is null and organisation_id = org_a from public.invoice_drafts where id = d3), 'a draft still points at a deleted theme (or lost its business)';
  reset role;

  -- Another business never inherits and sees none of it.
  perform pg_temp.as_user(b);
  set local role authenticated;
  insert into public.invoice_drafts (organisation_id, form, created_by) values (org_b, '{}'::jsonb, b) returning id into d1;
  assert (select theme_id is null and theme_starter is null from public.invoice_drafts where id = d1), 'another business''s theme was inherited';
  assert (select count(*) from public.invoice_drafts where id = d3) = 0, 'another business can see a draft';
  reset role;

  raise notice 'invoice draft themes tests passed';
end
$$;

rollback;
