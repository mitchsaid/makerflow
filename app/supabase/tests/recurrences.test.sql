-- Recurring invoices (docs/plans/recurring.md, slice 1): row-level security on repeats, what members can and cannot
-- write, the limits, and the daily run's function (one draft per due day, never an issued invoice, paused rather than
-- lost when the business is full). Plain SQL, one transaction, rolled back.

begin;

create function pg_temp.as_user(uid uuid) returns void language plpgsql as $f$
declare sid uuid := md5('session-' || uid::text)::uuid;
begin
  insert into auth.sessions (id, user_id) values (sid, uid) on conflict do nothing;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'session_id', sid)::text, true);
end
$f$;

do $$
declare
  a uuid := '00000000-0000-4000-8000-0000000035a1';
  b uuid := '00000000-0000-4000-8000-0000000035b1';
  org_a uuid;
  org_b uuid;
  cust_a uuid;
  cust_b uuid;
  r1 uuid;
  r2 uuid;
  made uuid;
  made2 uuid;
  n integer;
  invoices_before integer;
begin
  insert into auth.users (id, email) values (a, 'ra35@example.test'), (b, 'rb35@example.test');
  perform pg_temp.as_user(b);
  set local role authenticated;
  org_b := public.ensure_organisation('B Co');
  insert into public.customers (organisation_id, name) values (org_b, 'Other') returning id into cust_b;
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  org_a := public.ensure_organisation('A Co');
  insert into public.customers (organisation_id, name) values (org_a, 'Thandi') returning id into cust_a;

  ----------------------------------------------------------------------
  -- A member keeps repeats of their own business
  ----------------------------------------------------------------------
  insert into public.recurrences (organisation_id, customer_id, form, frequency, every, starts_on, next_run_on, created_by)
    values (org_a, cust_a, '{"lines": []}'::jsonb, 'month', 1, date '2026-11-15', date '2026-11-15', a) returning id into r1;

  -- Not for another business, not with another business's customer, not as someone else.
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on) values (org_b, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15');
    raise exception 'FAIL: a repeat for another business was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.recurrences (organisation_id, customer_id, form, frequency, starts_on, next_run_on) values (org_a, cust_b, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15');
    raise exception 'FAIL: another business''s customer was accepted';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on, created_by) values (org_a, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15', b);
    raise exception 'FAIL: a repeat as someone else was accepted';
  exception when insufficient_privilege then null;
  end;

  -- The checks on the schedule.
  begin
    insert into public.recurrences (organisation_id, form, frequency, every, starts_on, next_run_on) values (org_a, '{}'::jsonb, 'week', 13, date '2026-11-15', date '2026-11-15');
    raise exception 'FAIL: every 13 weeks was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on) values (org_a, '{}'::jsonb, 'day', date '2026-11-15', date '2026-11-15');
    raise exception 'FAIL: a daily repeat was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on, last_day) values (org_a, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15', true);
    raise exception 'FAIL: last day of the month on a weekly repeat was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on, ends_on) values (org_a, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15', date '2026-11-01');
    raise exception 'FAIL: an end before the start was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on, max_runs) values (org_a, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15', 101);
    raise exception 'FAIL: 101 times was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on) values (org_a, '[]'::jsonb, 'week', date '2026-11-15', date '2026-11-15');
    raise exception 'FAIL: a form that is not an object was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.recurrences set paused_reason = 'because' where id = r1;
    raise exception 'FAIL: a reason without a pause was accepted';
  exception when check_violation then null;
  end;

  -- A member cannot write what only the run writes.
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on, run_count) values (org_a, '{}'::jsonb, 'week', date '2026-11-15', date '2026-11-15', 5);
    raise exception 'FAIL: a member set the run count';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.recurrences set run_count = 50 where id = r1;
    raise exception 'FAIL: a member changed the run count';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.recurrences set last_run_on = date '2026-11-01' where id = r1;
    raise exception 'FAIL: a member changed when it last ran';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invoice_drafts set recurrence_id = r1 where false;
    raise exception 'FAIL: a member may write a draft''s recurrence_id';
  exception when insufficient_privilege then null;
  end;

  -- A member can pause, resume and change the schedule.
  update public.recurrences set paused_at = now(), paused_reason = null where id = r1;
  update public.recurrences set paused_at = null where id = r1;
  update public.recurrences set every = 2, next_run_on = date '2026-11-20' where id = r1;
  update public.recurrences set every = 1, next_run_on = date '2026-11-15' where id = r1;
  reset role;

  ----------------------------------------------------------------------
  -- Another business sees and changes nothing
  ----------------------------------------------------------------------
  perform pg_temp.as_user(b);
  set local role authenticated;
  assert (select count(*) from public.recurrences) = 0, 'another business can see repeats';
  update public.recurrences set paused_at = now() where id = r1;
  delete from public.recurrences where id = r1;
  reset role;
  assert (select count(*) from public.recurrences where id = r1 and paused_at is null) = 1, 'another business changed or deleted a repeat';

  -- No session, no access.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  assert (select count(*) from public.recurrences) = 0, 'repeats can be read without a session';
  reset role;

  ----------------------------------------------------------------------
  -- The run: members cannot call it, the server can
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  begin
    perform public.run_recurrence(org_a, r1, date '2026-11-15', date '2026-11-15', '{"lines": []}'::jsonb, date '2026-12-15', 0);
    raise exception 'FAIL: a member ran a repeat';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pause_recurrence_with_reason(org_a, r1, 'because');
    raise exception 'FAIL: a member paused a repeat with the server function';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into invoices_before from public.invoices where organisation_id = org_a;
  set local role service_role;

  -- Not yet due: nothing is made.
  assert public.run_recurrence(org_a, r1, date '2026-11-14', date '2026-11-15', '{"lines": []}'::jsonb, date '2026-12-15', 0) is null, 'a repeat that is not due made a draft';
  -- Due: one draft, linked, with the repeat's customer, and the repeat moves on.
  made := public.run_recurrence(org_a, r1, date '2026-11-15', date '2026-11-15', '{"lines": [], "note": "x"}'::jsonb, date '2026-12-15', 0);
  assert made is not null, 'a due repeat made nothing';
  -- Run again the same day (a second run, or a retry): still one.
  assert public.run_recurrence(org_a, r1, date '2026-11-15', date '2026-11-15', '{"lines": []}'::jsonb, date '2026-12-15', 0) is null, 'a repeat made two drafts in a day';
  -- Another business's id for the same repeat: not found.
  begin
    perform public.run_recurrence(org_b, r1, date '2026-11-15', date '2026-11-15', '{}'::jsonb, date '2026-12-15', 0);
    raise exception 'FAIL: a repeat ran under another business';
  exception when sqlstate 'P0002' then null;
  end;
  reset role;

  assert (select recurrence_id = r1 and customer_id = cust_a and organisation_id = org_a and created_by = a from public.invoice_drafts where id = made), 'the draft is not linked or not the repeat''s';
  assert (select form ->> 'note' from public.invoice_drafts where id = made) = 'x', 'the draft does not have the form it was given';
  assert (select run_count = 1 and last_run_on = date '2026-11-15' and next_run_on = date '2026-12-15' and last_skipped = 0 from public.recurrences where id = r1), 'the repeat did not move on';
  -- Never an invoice, never a number.
  assert (select count(*) from public.invoices where organisation_id = org_a) = invoices_before, 'a repeat issued an invoice';

  -- A repeat that went unnoticed for a while makes one draft and says how many due days went by.
  set local role service_role;
  made2 := public.run_recurrence(org_a, r1, date '2027-02-20', date '2026-12-15', '{"lines": []}'::jsonb, date '2027-03-15', 2);
  assert made2 is not null, 'a late repeat made nothing';
  reset role;
  assert (select run_count = 2 and last_skipped = 2 and next_run_on = date '2027-03-15' from public.recurrences where id = r1), 'a late repeat was not recorded';

  -- A change made after the server read it (the due day moved) makes nothing; the next run reads it afresh.
  set local role service_role;
  assert public.run_recurrence(org_a, r1, date '2027-03-15', date '2027-03-01', '{"lines": []}'::jsonb, date '2027-04-15', 0) is null, 'a repeat changed meanwhile still ran';
  reset role;

  -- Paused: nothing is made. Resumed: it is.
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.recurrences set paused_at = now() where id = r1;
  reset role;
  set local role service_role;
  assert public.run_recurrence(org_a, r1, date '2027-03-15', date '2027-03-15', '{"lines": []}'::jsonb, date '2027-04-15', 0) is null, 'a paused repeat ran';
  -- The server pauses one it cannot make, with the reason; a reason is needed.
  begin
    perform public.pause_recurrence_with_reason(org_a, r1, '  ');
    raise exception 'FAIL: a pause with no reason was accepted';
  exception when sqlstate '22023' then null;
  end;
  reset role;
  perform pg_temp.as_user(a);
  set local role authenticated;
  update public.recurrences set paused_at = null where id = r1;
  reset role;
  set local role service_role;
  perform public.pause_recurrence_with_reason(org_a, r1, 'An item on it is no longer valid.');
  reset role;
  assert (select paused_at is not null and paused_reason = 'An item on it is no longer valid.' from public.recurrences where id = r1), 'the server could not pause a repeat';

  -- Its last run: at 100 it stops (no next day).
  update public.recurrences set paused_at = null, paused_reason = null, run_count = 99, next_run_on = date '2027-04-15' where id = r1;
  set local role service_role;
  perform public.run_recurrence(org_a, r1, date '2027-04-15', date '2027-04-15', '{"lines": []}'::jsonb, date '2027-05-15', 0);
  reset role;
  assert (select run_count = 100 and next_run_on is null from public.recurrences where id = r1), 'a repeat did not stop at 100';

  ----------------------------------------------------------------------
  -- A business with 100 drafts: the repeat is paused with the reason, not lost
  ----------------------------------------------------------------------
  insert into public.recurrences (organisation_id, customer_id, form, frequency, starts_on, next_run_on, created_by)
    values (org_a, cust_a, '{"lines": []}'::jsonb, 'week', date '2027-05-01', date '2027-05-01', a) returning id into r2;
  select count(*) into n from public.invoice_drafts where organisation_id = org_a;
  insert into public.invoice_drafts (organisation_id, form) select org_a, '{}'::jsonb from generate_series(1, 100 - n);
  set local role service_role;
  assert public.run_recurrence(org_a, r2, date '2027-05-01', date '2027-05-01', '{"lines": []}'::jsonb, date '2027-05-08', 0) is null, 'a repeat made a draft over the limit';
  reset role;
  assert (select paused_at is not null and paused_reason like '%100 invoice drafts%' and run_count = 0 and next_run_on = date '2027-05-01' from public.recurrences where id = r2), 'a full business did not pause the repeat with its reason';

  ----------------------------------------------------------------------
  -- Stopping a repeat leaves what it made, and clears the link
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  delete from public.recurrences where id = r1;
  reset role;
  assert (select count(*) from public.invoice_drafts where id = made and recurrence_id is null) = 1, 'stopping a repeat removed its drafts or kept the link';

  ----------------------------------------------------------------------
  -- At most 25 repeats a business
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.recurrences where organisation_id = org_a;
  for i in 1 .. (25 - n) loop
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on) values (org_a, '{}'::jsonb, 'year', date '2027-01-01', date '2027-01-01');
  end loop;
  begin
    insert into public.recurrences (organisation_id, form, frequency, starts_on, next_run_on) values (org_a, '{}'::jsonb, 'year', date '2027-01-01', date '2027-01-01');
    raise exception 'FAIL: a 26th repeat was accepted';
  exception when sqlstate '54000' then null;
  end;
  reset role;

  -- A deleted customer takes its repeats with it (private working state, like its drafts).
  delete from public.customers where id = cust_a;
  assert (select count(*) from public.recurrences where customer_id = cust_a) = 0, 'a deleted customer left repeats behind';

  raise notice 'recurrences tests passed';
end
$$;

rollback;
