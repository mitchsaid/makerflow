import "server-only";
import { createClient } from "../supabase/server";
import { isPaymentMethod, type PaymentEntry } from "../invoices/payments";
import type { StatementInvoice } from "./index";

/** The customer's invoices with their payments and credit notes, under the person's own row-level security. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  number: string;
  issue_date: string;
  due_date: string;
  gross_cents: number | string;
  lines: { name?: unknown; quantityMilli?: unknown; unit?: unknown }[] | null;
  invoice_payments: { id: string; amount_cents: number | string; paid_on: string; method: string | null; note: string | null; reverses_id: string | null; created_at: string }[];
  credit_notes: { id: string; number: string; issue_date: string; reason: string; gross_cents: number | string }[];
};

/** "Cake, Sign and 2 more": enough to tell invoices apart. */
function describe(lines: Row["lines"]): string {
  const names = (lines ?? []).map((l) => (typeof l?.name === "string" ? l.name : "")).filter((n) => n !== "");
  if (names.length <= 3) return names.join(", ") || "Invoice";
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

export async function getStatementInvoices(
  customerId: string,
  /** What a credit note's reason key reads as. */
  reasonLabel: (reason: string) => string,
): Promise<{ organisationId: string | null; invoices: StatementInvoice[] }> {
  if (!UUID.test(customerId)) return { organisationId: null, invoices: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `id, organisation_id, number, issue_date, due_date, gross_cents, lines:snapshot->lines,
       invoice_payments ( id, amount_cents, paid_on, method, note, reverses_id, created_at ),
       credit_notes ( id, number, issue_date, reason, gross_cents )`,
    )
    .eq("customer_id", customerId)
    .order("issue_date", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not load the statement: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];
  return {
    organisationId: rows[0]?.organisation_id ?? null,
    invoices: rows.map((r) => ({
      id: r.id,
      number: r.number,
      issueDate: r.issue_date,
      dueDate: r.due_date,
      grossCents: Number(r.gross_cents),
      description: describe(r.lines),
      payments: r.invoice_payments.map(
        (p): PaymentEntry => ({
          id: p.id,
          amountCents: Number(p.amount_cents),
          paidOn: p.paid_on,
          method: isPaymentMethod(p.method) ? p.method : null,
          note: p.note,
          reversesId: p.reverses_id,
          createdAt: p.created_at,
        }),
      ),
      creditNotes: r.credit_notes.map((c) => ({ id: c.id, number: c.number, issueDate: c.issue_date, reason: reasonLabel(c.reason), grossCents: Number(c.gross_cents) })),
    })),
  };
}
