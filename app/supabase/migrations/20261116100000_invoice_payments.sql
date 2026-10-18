-- Invoice payments, slice I2 (docs/plans/invoices-and-payments.md): the money a customer has paid against an invoice.
--
-- SECURITY-SENSITIVE: money, a new table with row-level security, and two new service-role-only security-definer
-- functions. Needs human review before it is applied to any hosted project.
--
-- HOW IT WORKS
-- * A payment is an entry on an invoice: an amount (always more than nothing), the day it was received, how (optional)
--   and a note. Entries are APPEND-ONLY: nobody can change or delete one, the service role and definer functions
--   included (a trigger, like the invoices themselves). A mistake is fixed by a REVERSAL: a new entry that points at
--   the one it undoes (same invoice, same amount). One reversal per payment, and a reversal cannot itself be reversed
--   (enter the payment again instead).
-- * What has been paid = payments - reversals. It can never be more than the invoice total: record_invoice_payment
--   takes the invoice's row lock, so two payments made at the same moment cannot together overpay it.
-- * The invoice's status (unpaid, part paid, paid, overdue) is NOT stored; it is worked out from these entries and the
--   due day.
-- * Written only through record_invoice_payment and reverse_invoice_payment, which only our server (the service role)
--   can call, after it has checked with the person's own session that the invoice is theirs.

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  invoice_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  paid_on date not null,
  method text check (method is null or method in ('eft', 'cash', 'card', 'other')),
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  -- Set on a reversal: the payment it undoes.
  reverses_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoice_payments_org_id_unique unique (organisation_id, id),
  constraint invoice_payments_invoice_id_unique unique (invoice_id, id),
  constraint invoice_payments_invoice_same_org
    foreign key (organisation_id, invoice_id) references public.invoices (organisation_id, id),
  -- A reversal undoes a payment of the same invoice, once.
  constraint invoice_payments_reverses_same_invoice
    foreign key (invoice_id, reverses_id) references public.invoice_payments (invoice_id, id),
  constraint invoice_payments_one_reversal unique (reverses_id),
  constraint invoice_payments_not_itself check (reverses_id is null or reverses_id <> id)
);

create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id, paid_on, created_at);

create function public.invoice_payments_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The one change allowed: forgetting who recorded it when that person's login is deleted.
  if tg_op = 'UPDATE' and new.created_by is null and old.created_by is not null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  raise exception 'a payment entry cannot be changed or deleted; reverse it instead' using errcode = '55000';
end;
$$;

revoke execute on function public.invoice_payments_immutable() from public, anon, authenticated;

create trigger invoice_payments_immutable
  before update or delete on public.invoice_payments
  for each row execute function public.invoice_payments_immutable();
create trigger invoice_payments_no_truncate
  before truncate on public.invoice_payments
  for each statement execute function public.invoices_no_truncate();

-- Members read. Nobody writes directly: no insert, update or delete grant.
revoke all on public.invoice_payments from anon, authenticated;
grant select on public.invoice_payments to authenticated;

alter table public.invoice_payments enable row level security;

create policy invoice_payments_select_members on public.invoice_payments for select to authenticated
  using (public.is_org_member(organisation_id));

-- Same protection as every table (see docs/plans/session-bound-rls.md).
create policy session_required on public.invoice_payments
  as restrictive for all to authenticated
  using ((select public.session_is_active())) with check ((select public.session_is_active()));

-- ---------------------------------------------------------------------------
-- record_invoice_payment. SERVER ONLY (service role).
--
-- Errors: P0002 the invoice is not found; 22023 the amount is not more than nothing or the day is far in the future;
-- 22003 the payment is more than what is owing.
-- Returns the new entry's id and what has been paid and is owing now.
-- ---------------------------------------------------------------------------
create function public.record_invoice_payment(
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

  -- The invoice's row lock serialises everyone paying this invoice. (Locking is not changing: the invoice is untouched.)
  select * into inv from public.invoices where id = p_invoice_id and organisation_id = p_org for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(case when reverses_id is null then amount_cents else -amount_cents end), 0)
    into paid from public.invoice_payments where invoice_id = inv.id;
  if p_amount_cents > inv.gross_cents - paid then
    raise exception 'that is more than what is owing' using errcode = '22003';
  end if;

  insert into public.invoice_payments (organisation_id, invoice_id, amount_cents, paid_on, method, note, created_by)
  values (p_org, inv.id, p_amount_cents, p_paid_on, p_method, nullif(btrim(p_note), ''), p_actor)
  returning id into pid;

  return jsonb_build_object('id', pid, 'paidCents', paid + p_amount_cents, 'owingCents', inv.gross_cents - paid - p_amount_cents);
end;
$$;

revoke execute on function public.record_invoice_payment(uuid, uuid, uuid, bigint, date, text, text)
  from public, anon, authenticated;
grant execute on function public.record_invoice_payment(uuid, uuid, uuid, bigint, date, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- reverse_invoice_payment. SERVER ONLY (service role). Adds an entry that undoes a payment, dated p_on.
--
-- Errors: P0002 the payment is not found; 22023 it is itself a reversal or the day is far in the future;
-- 23505 it has already been reversed.
-- ---------------------------------------------------------------------------
create function public.reverse_invoice_payment(
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

  select coalesce(sum(case when reverses_id is null then amount_cents else -amount_cents end), 0)
    into paid from public.invoice_payments where invoice_id = inv.id;
  return jsonb_build_object('id', rid, 'paidCents', paid, 'owingCents', inv.gross_cents - paid);
end;
$$;

revoke execute on function public.reverse_invoice_payment(uuid, uuid, uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.reverse_invoice_payment(uuid, uuid, uuid, date, text) to service_role;
