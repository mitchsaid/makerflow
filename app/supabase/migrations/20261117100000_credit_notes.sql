-- Credit notes, slice I4 (docs/plans/credit-notes.md): the way an issued invoice is corrected. The invoice never changes;
-- a credit note lowers what is owed on it.
--
-- SECURITY-SENSITIVE: money, a tax document that must never change, gapless numbering, two new tables with row-level
-- security, a new service-role-only security-definer function, and replaced payment and totals functions. Needs human
-- review before it is applied to any hosted project.
--
-- HOW IT WORKS
-- * A credit note is for ONE invoice and credits some of its items: for each, a quantity (0 allowed, for a price change)
--   and an amount, each up to what is left of that item after earlier credit notes. The server works out each item's
--   limits from the invoice's document and sends them with the lines; the database checks that the limits an item is given
--   never change from one credit note to the next and that its running totals stay within them, and (the rule it can check
--   on its own) that THE TOTAL CREDITED NEVER PASSES THE INVOICE'S TOTAL.
-- * issue_credit_note is SERVER ONLY (service role). It takes the invoice's row lock (the one payments take), so credit
--   notes and payments on one invoice happen one at a time, takes the next credit note number INSIDE the same transaction
--   (a failure leaves no gap), and stores the document.
-- * Credit notes and their lines are append-only for every path (no grants, triggers that refuse update, delete and
--   truncate), and the business cannot be deleted while it has invoices (so none while it has credit notes).
-- * What is owing on an invoice is now: total - credited - paid. The payment function and trigger and Home's totals use that.

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  number text not null check (char_length(btrim(number)) between 1 and 40),
  invoice_id uuid not null,
  invoice_number text not null,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  issue_date date not null,
  reason text not null check (reason in ('returned', 'cancelled', 'price', 'discount', 'damaged', 'other')),
  explanation text not null check (char_length(btrim(explanation)) between 1 and 500),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  net_cents bigint not null check (net_cents >= 0),
  vat_cents bigint not null check (vat_cents >= 0),
  gross_cents bigint not null check (gross_cents > 0),
  -- Everything the document shows. The PDF is drawn from this and nothing else.
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  issued_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint credit_notes_org_id_unique unique (organisation_id, id),
  constraint credit_notes_number_unique unique (organisation_id, number),
  constraint credit_notes_invoice_id_unique unique (invoice_id, id),
  constraint credit_notes_invoice_same_org
    foreign key (organisation_id, invoice_id) references public.invoices (organisation_id, id),
  constraint credit_notes_money_adds_up check (net_cents + vat_cents = gross_cents)
);

create index credit_notes_invoice_idx on public.credit_notes (invoice_id, issue_date);

create table public.credit_note_lines (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  credit_note_id uuid not null,
  invoice_id uuid not null,
  -- Which item of the invoice's document (its position in the document's lines).
  line_index integer not null check (line_index >= 0),
  quantity_milli bigint not null check (quantity_milli >= 0),
  amount_cents bigint not null check (amount_cents > 0),
  -- What the invoice's item allowed in all, as the server worked it out; the same on every credit note for the item.
  line_limit_quantity_milli bigint not null check (line_limit_quantity_milli >= 0),
  line_limit_amount_cents bigint not null check (line_limit_amount_cents > 0),
  constraint credit_note_lines_one_per_item unique (credit_note_id, line_index),
  constraint credit_note_lines_within_limits check (quantity_milli <= line_limit_quantity_milli and amount_cents <= line_limit_amount_cents),
  constraint credit_note_lines_note_same_invoice
    foreign key (invoice_id, credit_note_id) references public.credit_notes (invoice_id, id),
  constraint credit_note_lines_note_same_org
    foreign key (organisation_id, credit_note_id) references public.credit_notes (organisation_id, id)
);

create index credit_note_lines_invoice_idx on public.credit_note_lines (invoice_id, line_index);

-- Issued means final.
create function public.credit_notes_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- (Read through jsonb: the same function guards the lines table, which has no issued_by.)
  if tg_table_name = 'credit_notes' and tg_op = 'UPDATE'
     and (to_jsonb(new) ->> 'issued_by') is null and (to_jsonb(old) ->> 'issued_by') is not null
     and (to_jsonb(new) - 'issued_by') = (to_jsonb(old) - 'issued_by') then
    return new;
  end if;
  raise exception 'a credit note cannot be changed or deleted' using errcode = '55000';
end;
$$;

revoke execute on function public.credit_notes_immutable() from public, anon, authenticated;

create trigger credit_notes_immutable
  before update or delete on public.credit_notes
  for each row execute function public.credit_notes_immutable();
create trigger credit_note_lines_immutable
  before update or delete on public.credit_note_lines
  for each row execute function public.credit_notes_immutable();
create trigger credit_notes_no_truncate
  before truncate on public.credit_notes
  for each statement execute function public.invoices_no_truncate();
create trigger credit_note_lines_no_truncate
  before truncate on public.credit_note_lines
  for each statement execute function public.invoices_no_truncate();

-- The credit rules hold for every insert, not only through issue_credit_note: the total credited never passes the
-- invoice's total, and an item's running quantity and amount stay within its limits, which never change between notes.
create function public.credit_notes_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  credited bigint;
begin
  select * into inv from public.invoices where id = new.invoice_id and organisation_id = new.organisation_id for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  select coalesce(sum(gross_cents), 0) into credited from public.credit_notes where invoice_id = inv.id;
  if new.gross_cents > inv.gross_cents - credited then
    raise exception 'that is more than is left to credit on the invoice' using errcode = '22003';
  end if;
  return new;
end;
$$;

create function public.credit_note_lines_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior record;
begin
  select coalesce(sum(quantity_milli), 0) as q, coalesce(sum(amount_cents), 0) as a,
         min(line_limit_quantity_milli) as min_lq, max(line_limit_quantity_milli) as max_lq,
         min(line_limit_amount_cents) as min_la, max(line_limit_amount_cents) as max_la, count(*) as n
    into prior from public.credit_note_lines where invoice_id = new.invoice_id and line_index = new.line_index;
  if prior.n > 0 and (prior.min_lq <> new.line_limit_quantity_milli or prior.max_lq <> new.line_limit_quantity_milli
                      or prior.min_la <> new.line_limit_amount_cents or prior.max_la <> new.line_limit_amount_cents) then
    raise exception 'what an item allows cannot change between credit notes' using errcode = '22023';
  end if;
  if prior.q + new.quantity_milli > new.line_limit_quantity_milli or prior.a + new.amount_cents > new.line_limit_amount_cents then
    raise exception 'that is more than is left to credit on the item' using errcode = '22003';
  end if;
  return new;
end;
$$;

revoke execute on function public.credit_notes_check() from public, anon, authenticated;
revoke execute on function public.credit_note_lines_check() from public, anon, authenticated;

create trigger credit_notes_check
  before insert on public.credit_notes
  for each row execute function public.credit_notes_check();
create trigger credit_note_lines_check
  before insert on public.credit_note_lines
  for each row execute function public.credit_note_lines_check();

-- Members read. Nobody writes directly: no insert, update or delete grant.
revoke all on public.credit_notes, public.credit_note_lines from anon, authenticated;
grant select on public.credit_notes, public.credit_note_lines to authenticated;

alter table public.credit_notes enable row level security;
alter table public.credit_note_lines enable row level security;

create policy credit_notes_select_members on public.credit_notes for select to authenticated
  using (public.is_org_member(organisation_id));
create policy credit_note_lines_select_members on public.credit_note_lines for select to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.credit_notes
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));
create policy session_required on public.credit_note_lines
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- issue_credit_note. SERVER ONLY (service role). The server has already checked, with the person's own session, that the
-- invoice is theirs.
--
-- p_lines: [{"index", "quantityMilli", "amountCents", "limitQuantityMilli", "limitAmountCents"}, ...], one for each item
-- credited. p_snapshot is the credit note's document with "number" still empty; its "creditNote" block names the invoice
-- (number and day) and its totals are the credit's own.
--
-- Errors: P0002 the invoice is not found; 22023 the reason, explanation, day, lines or document do not fit, or an item's
-- limits differ from earlier credit notes'; 22003 an item or the invoice would be credited for more than it allows;
-- 23514 the money does not add up; 40001 another credit note was issued meanwhile and this one's VAT must be worked out
-- again (the server reads the invoice again and retries).
-- Returns the new credit note's id and number.
-- ---------------------------------------------------------------------------
create function public.issue_credit_note(
  p_org uuid,
  p_invoice_id uuid,
  p_actor uuid,
  p_issue_date date,
  p_reason text,
  p_explanation text,
  p_lines jsonb,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  l jsonb;
  idx integer;
  q bigint;
  a bigint;
  lq bigint;
  la bigint;
  prior record;
  line_count integer;
  amounts bigint := 0;
  credited bigint;
  credited_subtotal bigint;
  net bigint;
  vat bigint;
  gross bigint;
  num text;
  snap jsonb;
  cid uuid;
begin
  if p_reason is null or p_reason not in ('returned', 'cancelled', 'price', 'discount', 'damaged', 'other') then
    raise exception 'unknown reason' using errcode = '22023';
  end if;
  if p_explanation is null or char_length(btrim(p_explanation)) not between 1 and 500 then
    raise exception 'a credit note needs a short explanation' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'the credit note document is missing' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 200 then
    raise exception 'a credit note needs at least one item' using errcode = '22023';
  end if;

  select * into inv from public.invoices where id = p_invoice_id and organisation_id = p_org for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  -- A day or two ahead covers a time zone ahead of the database's; before the invoice makes no sense.
  if p_issue_date is null or p_issue_date < inv.issue_date or p_issue_date > current_date + 2 then
    raise exception 'the credit note day does not fit the invoice' using errcode = '22023';
  end if;
  if (select count(distinct (x ->> 'index')) from jsonb_array_elements(p_lines) x) <> jsonb_array_length(p_lines) then
    raise exception 'an item can be credited once in a credit note' using errcode = '22023';
  end if;

  line_count := jsonb_array_length(inv.snapshot -> 'lines');
  for l in select * from jsonb_array_elements(p_lines) loop
    idx := (l ->> 'index')::integer;
    q := (l ->> 'quantityMilli')::bigint;
    a := (l ->> 'amountCents')::bigint;
    lq := (l ->> 'limitQuantityMilli')::bigint;
    la := (l ->> 'limitAmountCents')::bigint;
    if idx is null or idx < 0 or idx >= line_count or q is null or q < 0 or a is null or a <= 0
       or lq is null or lq < 0 or la is null or la <= 0 then
      raise exception 'a credited item does not fit the invoice' using errcode = '22023';
    end if;
    select coalesce(sum(quantity_milli), 0) as q, coalesce(sum(amount_cents), 0) as a,
           min(line_limit_quantity_milli) as min_lq, max(line_limit_quantity_milli) as max_lq,
           min(line_limit_amount_cents) as min_la, max(line_limit_amount_cents) as max_la, count(*) as n
      into prior from public.credit_note_lines where invoice_id = inv.id and line_index = idx;
    if prior.n > 0 and (prior.min_lq <> lq or prior.max_lq <> lq or prior.min_la <> la or prior.max_la <> la) then
      raise exception 'what an item allows cannot change between credit notes' using errcode = '22023';
    end if;
    if prior.q + q > lq or prior.a + a > la then
      raise exception 'that is more than is left to credit on the item' using errcode = '22003';
    end if;
    amounts := amounts + a;
  end loop;

  net := (p_snapshot -> 'totals' ->> 'netCents')::bigint;
  vat := (p_snapshot -> 'totals' ->> 'vatCents')::bigint;
  gross := (p_snapshot -> 'totals' ->> 'grossCents')::bigint;
  if net is null or vat is null or gross is null or net < 0 or vat < 0 or gross <= 0 or net + vat <> gross
     or (p_snapshot -> 'totals' ->> 'subtotalCents')::bigint is distinct from amounts then
    raise exception 'the credit note money does not add up' using errcode = '23514';
  end if;

  select coalesce(sum(gross_cents), 0), coalesce(sum((snapshot -> 'totals' ->> 'subtotalCents')::bigint), 0)
    into credited, credited_subtotal from public.credit_notes where invoice_id = inv.id;
  if gross > inv.gross_cents - credited then
    raise exception 'that is more than is left to credit on the invoice' using errcode = '22003';
  end if;
  -- Crediting the last of the invoice's amounts must credit exactly the rest of its total: the VAT of this note was worked
  -- out from the credit notes the server could see, and another one may have been issued since. 40001: read again and retry.
  if credited_subtotal + amounts = (inv.snapshot -> 'totals' ->> 'subtotalCents')::bigint
     and credited + gross <> inv.gross_cents then
    raise exception 'the invoice changed while this credit note was being made' using errcode = '40001';
  end if;

  if (p_snapshot #>> '{creditNote,invoiceNumber}') is distinct from inv.number
     or (p_snapshot #>> '{creditNote,invoiceDate}')::date is distinct from inv.issue_date
     or (p_snapshot ->> 'issueDate')::date is distinct from p_issue_date then
    raise exception 'the document does not match the invoice and day' using errcode = '22023';
  end if;

  -- The number is taken here, inside this transaction, so a failure anywhere above or below gives none back.
  num := public.issue_document_number(p_org, 'credit_note');
  snap := jsonb_set(p_snapshot, '{number}', to_jsonb(num));

  insert into public.credit_notes (
    organisation_id, number, invoice_id, invoice_number, customer_name, issue_date, reason, explanation,
    currency_code, net_cents, vat_cents, gross_cents, snapshot, issued_by
  ) values (
    p_org, num, inv.id, inv.number, inv.customer_name, p_issue_date, p_reason, btrim(p_explanation),
    inv.currency_code, net, vat, gross, snap, p_actor
  ) returning id into cid;

  insert into public.credit_note_lines (
    organisation_id, credit_note_id, invoice_id, line_index, quantity_milli, amount_cents,
    line_limit_quantity_milli, line_limit_amount_cents
  )
  select p_org, cid, inv.id, (x ->> 'index')::integer, (x ->> 'quantityMilli')::bigint, (x ->> 'amountCents')::bigint,
         (x ->> 'limitQuantityMilli')::bigint, (x ->> 'limitAmountCents')::bigint
    from jsonb_array_elements(p_lines) x;

  return jsonb_build_object('id', cid, 'number', num);
end;
$$;

revoke execute on function public.issue_credit_note(uuid, uuid, uuid, date, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.issue_credit_note(uuid, uuid, uuid, date, text, text, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- What is owing is now: total - credited - paid. The same functions as before (20261116100000_invoice_payments.sql),
-- with the credit taken off.
-- ---------------------------------------------------------------------------
create or replace function public.invoice_payments_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.invoice_payments%rowtype;
  gross bigint;
  credited bigint;
  paid bigint;
begin
  if new.reverses_id is not null then
    select * into original from public.invoice_payments where id = new.reverses_id;
    if original.reverses_id is not null then
      raise exception 'a reversal cannot be reversed' using errcode = '22023';
    end if;
    if original.amount_cents <> new.amount_cents then
      raise exception 'a reversal must be for the amount of the payment it undoes' using errcode = '22023';
    end if;
    return new;
  end if;
  select i.gross_cents into gross from public.invoices i where i.id = new.invoice_id;
  select coalesce(sum(c.gross_cents), 0) into credited from public.credit_notes c where c.invoice_id = new.invoice_id;
  select coalesce(sum(case when reverses_id is null then amount_cents else -amount_cents end), 0)
    into paid from public.invoice_payments where invoice_id = new.invoice_id;
  if new.amount_cents > gross - credited - paid then
    raise exception 'that is more than what is owing' using errcode = '22003';
  end if;
  return new;
end;
$$;

create or replace function public.record_invoice_payment(
  p_org uuid,
  p_invoice_id uuid,
  p_actor uuid,
  p_amount_cents bigint,
  p_paid_on date,
  p_method text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  credited bigint;
  paid bigint;
  pid uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'a payment must be more than nothing' using errcode = '22023';
  end if;
  -- A day or two ahead covers a time zone ahead of the database's; further is a typo.
  if p_paid_on is null or p_paid_on > current_date + 2 then
    raise exception 'a payment cannot be dated in the future' using errcode = '22023';
  end if;

  -- The invoice's row lock serialises everyone paying or crediting this invoice. (Locking is not changing.)
  select * into inv from public.invoices where id = p_invoice_id and organisation_id = p_org for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(gross_cents), 0) into credited from public.credit_notes where invoice_id = inv.id;
  select coalesce(sum(case when reverses_id is null then amount_cents else -amount_cents end), 0)
    into paid from public.invoice_payments where invoice_id = inv.id;
  if p_amount_cents > inv.gross_cents - credited - paid then
    raise exception 'that is more than what is owing' using errcode = '22003';
  end if;

  insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, method, note, created_by)
  values (p_org, inv.id, p_amount_cents, p_paid_on, p_method, nullif(btrim(p_note), ''), p_actor)
  returning id into pid;

  return jsonb_build_object('id', pid, 'paidCents', paid + p_amount_cents,
                            'owingCents', inv.gross_cents - credited - paid - p_amount_cents);
end;
$$;

-- reverse_invoice_payment returns what is owing now: the same function as before (20261116100000_invoice_payments.sql),
-- with the credit taken off the figure it returns.
create or replace function public.reverse_invoice_payment(
  p_org uuid,
  p_payment_id uuid,
  p_actor uuid,
  p_on date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.invoice_payments%rowtype;
  inv public.invoices%rowtype;
  credited bigint;
  paid bigint;
  rid uuid;
begin
  if p_on is null or p_on > current_date + 2 then
    raise exception 'a reversal cannot be dated in the future' using errcode = '22023';
  end if;

  select * into pay from public.invoice_payments where id = p_payment_id and organisation_id = p_org;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  select * into inv from public.invoices where id = pay.invoice_id and organisation_id = p_org for update;

  if pay.reverses_id is not null then
    raise exception 'a reversal cannot be reversed; record the payment again' using errcode = '22023';
  end if;
  if exists (select 1 from public.invoice_payments where reverses_id = pay.id) then
    raise exception 'this payment has already been reversed' using errcode = '23505';
  end if;

  insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, method, note, reverses_id, created_by)
  values (p_org, pay.invoice_id, pay.amount_cents, p_on, pay.method, nullif(btrim(p_note), ''), pay.id, p_actor)
  returning id into rid;

  select coalesce(sum(gross_cents), 0) into credited from public.credit_notes where invoice_id = inv.id;
  select coalesce(sum(case when reverses_id is null then amount_cents else -amount_cents end), 0)
    into paid from public.invoice_payments where invoice_id = inv.id;
  return jsonb_build_object('id', rid, 'paidCents', paid, 'owingCents', inv.gross_cents - credited - paid);
end;
$$;

create or replace function public.invoice_owed_totals(p_org uuid, p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'count', count(*),
    'owingCents', coalesce(sum(owing), 0),
    'overdueCents', coalesce(sum(owing) filter (where due_date < p_today), 0))
  from (
    select i.due_date,
           i.gross_cents
           - coalesce((select sum(c.gross_cents) from public.credit_notes c where c.invoice_id = i.id), 0)
           - coalesce((select sum(case when p.reverses_id is null then p.amount_cents else -p.amount_cents end)
                         from public.invoice_payments p where p.invoice_id = i.id), 0) as owing
      from public.invoices i
     where i.organisation_id = p_org
  ) t
  where owing > 0;
$$;

-- ---------------------------------------------------------------------------
-- set_document_numbering now also sets the prefix and next number of CREDIT NOTES (as for invoices; the next number can
-- never go back to one already used). Same function as before (20261115100000_invoices.sql).
-- ---------------------------------------------------------------------------
create or replace function public.set_document_numbering(
  p_org uuid,
  p_doc_type text,
  p_prefix text,
  p_next_number integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  seq public.document_sequences%rowtype;
begin
  if not (select public.session_is_active()) then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not public.has_org_role(p_org, array['owner', 'admin']) then
    raise exception 'only owners and admins can change numbering' using errcode = '42501';
  end if;
  if p_doc_type not in ('quote', 'invoice', 'credit_note') then
    raise exception 'only quote, invoice and credit note numbering can be changed' using errcode = '22023';
  end if;

  insert into public.document_sequences (organisation_id, doc_type, prefix)
  values (p_org, p_doc_type, case p_doc_type when 'invoice' then 'INV-' when 'credit_note' then 'CN-' else 'QT-' end)
  on conflict (organisation_id, doc_type) do nothing;

  select * into seq from public.document_sequences
   where organisation_id = p_org and doc_type = p_doc_type
     for update;

  if p_next_number is null or p_next_number < 1 then
    raise exception 'the next number must be at least 1' using errcode = '22023';
  end if;
  if seq.last_issued_number is not null and p_next_number <= seq.last_issued_number then
    raise exception 'the next number must be higher than the last one used (%)', seq.last_issued_number
      using errcode = '22023';
  end if;

  update public.document_sequences
     set prefix = p_prefix, next_number = p_next_number
   where organisation_id = p_org and doc_type = p_doc_type;
end;
$$;
