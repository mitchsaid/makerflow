-- Document numbering: sequences per business and type, gapless on failure, no direct
-- writes, not callable by signed-in users. Rolled back at the end.

begin;

-- Test helper: a signed-in user has a real session, as in production.
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
  a uuid := '00000000-0000-4000-8000-0000000008a1';
  b uuid := '00000000-0000-4000-8000-0000000008b1';
  c uuid := '00000000-0000-4000-8000-0000000008c1';
  org_a uuid;
  org_b uuid;
  n int;
  num text;
begin
  insert into auth.users (id, email) values
    (a, 'da@example.test'), (b, 'db@example.test'), (c, 'dc@example.test');

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
  -- Numbers: per business, per type, formatted, in order
  ----------------------------------------------------------------------
  assert public.issue_document_number(org_a, 'quote') = 'QT-0001', 'first quote number';
  assert public.issue_document_number(org_a, 'quote') = 'QT-0002', 'second quote number';
  assert public.issue_document_number(org_a, 'invoice') = 'INV-0001', 'invoices count separately';
  assert public.issue_document_number(org_a, 'credit_note') = 'CN-0001', 'credit notes count separately';
  assert public.issue_document_number(org_b, 'quote') = 'QT-0001', 'another business starts at 1';
  assert public.issue_document_number(org_a, 'quote') = 'QT-0003', 'A continues independently of B';

  begin
    perform public.issue_document_number(org_a, 'receipt');
    raise exception 'FAIL: unknown document type was accepted';
  exception when invalid_parameter_value then null;
  end;

  ----------------------------------------------------------------------
  -- Gapless on failure: a rolled-back transaction gives its number back
  ----------------------------------------------------------------------
  begin
    num := public.issue_document_number(org_a, 'quote');
    assert num = 'QT-0004', 'number inside the failing block';
    raise exception 'something went wrong after taking the number' using errcode = 'P0001';
  exception when raise_exception then null;
  end;
  assert public.issue_document_number(org_a, 'quote') = 'QT-0004',
    'a failed attempt left a gap in the numbering';

  ----------------------------------------------------------------------
  -- Continuing from another system: prefix and next number can be set (as the owner of
  -- the database; the user-facing function arrives with the issuing slice)
  ----------------------------------------------------------------------
  update public.document_sequences
     set prefix = 'Q/', next_number = 12345, min_digits = 3
   where organisation_id = org_b and doc_type = 'quote';
  assert public.issue_document_number(org_b, 'quote') = 'Q/12345', 'continued numbering with a short prefix';
  assert (select last_issued_number from public.document_sequences
           where organisation_id = org_b and doc_type = 'quote') = 12345, 'last issued is recorded';

  begin
    update public.document_sequences set prefix = 'bad prefix!' where organisation_id = org_b;
    raise exception 'FAIL: a malformed prefix was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.document_sequences set next_number = 0 where organisation_id = org_b;
    raise exception 'FAIL: next number below 1 was accepted';
  exception when check_violation then null;
  end;

  ----------------------------------------------------------------------
  -- Access: members read their own business's sequences, nobody writes directly
  ----------------------------------------------------------------------
  perform pg_temp.as_user(a);
  set local role authenticated;
  select count(*) into n from public.document_sequences;
  assert n = 3, format('owner A should see their 3 sequences (quote, invoice, credit note), saw %s', n);
  select count(*) into n from public.document_sequences where organisation_id = org_b;
  assert n = 0, 'A can read B''s sequences';

  begin
    update public.document_sequences set next_number = 1 where organisation_id = org_a;
    raise exception 'FAIL: a user updated a sequence directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.document_sequences (organisation_id, doc_type, prefix) values (org_a, 'quote', 'X-');
    raise exception 'FAIL: a user inserted a sequence directly';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.document_sequences;
    raise exception 'FAIL: a user deleted sequences';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.issue_document_number(org_a, 'quote');
    raise exception 'FAIL: a signed-in user called the internal numbering function';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Staff can read the business's sequences (they will issue quotes later).
  perform pg_temp.as_user(c);
  set local role authenticated;
  select count(*) into n from public.document_sequences where organisation_id = org_a;
  assert n = 3, format('staff should see A''s 3 sequences, saw %s', n);
  reset role;

  -- Someone outside both businesses sees nothing; anon is denied.
  insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000008d1', 'dd@example.test');
  perform pg_temp.as_user('00000000-0000-4000-8000-0000000008d1');
  set local role authenticated;
  select count(*) into n from public.document_sequences;
  assert n = 0, 'a stranger can read sequences';
  reset role;

  set local role anon;
  begin
    perform count(*) from public.document_sequences;
    raise exception 'FAIL: anon could read sequences';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$$;

rollback;

\echo 'document sequence tests passed'
