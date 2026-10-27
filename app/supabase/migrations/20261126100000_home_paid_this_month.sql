-- Home's money overview: "Paid this month" next to what is owing and overdue (founder, 2026-10-27: "Home should provide a
-- financial overview of amounts outstanding etc"; answered: yes, Paid this month). docs/plans/ux-pass-3.md, slice 3.
--
-- SECURITY-SENSITIVE: money. invoice_owed_totals is read with the person's own session (security invoker), so
-- row-level security still limits it to the businesses they belong to. Needs human review before any hosted project.
--
-- paidThisMonthCents: the payments recorded for the business with a paid-on day in the calendar month of p_today, less
-- the reversals recorded in that month (a reversal is its own entry with its own day), never below 0. Integer cents,
-- computed here, never in the browser. Everything else the function returns is as before.

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
    'overdueCents', coalesce(sum(owing) filter (where due_date < p_today), 0),
    'paidThisMonthCents', (
      select greatest(0, coalesce(sum(case when p.reverses_id is null then p.amount_cents else -p.amount_cents end), 0))
        from public.invoice_payments p
       where p.organisation_id = p_org
         and p.paid_on >= date_trunc('month', p_today)::date
         and p.paid_on < (date_trunc('month', p_today) + interval '1 month')::date))
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
