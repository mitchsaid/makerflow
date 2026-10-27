import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { QuoteSnapshot } from "../quotes/snapshot";
import type { HomeMoney, InvoiceSummary } from "./index";
import { isPaymentMethod, paidCentsOf, type PaymentEntry } from "./payments";
import { isCreditReason, type CreditReason, type PriorCredit } from "../credit-notes";
import type { VatGroup } from "../money";

/**
 * Invoice reads. Row-level security limits every query to businesses the signed-in person belongs to; the pages keep
 * only the current business's rows (see customers/data.ts for why this is done after the queries).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InvoiceSummaryRow = {
  id: string;
  organisation_id: string;
  number: string;
  quote_id: string | null;
  customer_name: string;
  issue_date: string;
  due_date: string;
  gross_cents: number | string;
  currency_code: string;
  invoice_payments: { amount_cents: number | string; reverses_id: string | null }[];
  credit_notes: { gross_cents: number | string }[];
};

export const INVOICE_SUMMARY_COLUMNS =
  "id, organisation_id, number, quote_id, customer_name, issue_date, due_date, gross_cents, currency_code, invoice_payments ( amount_cents, reverses_id ), credit_notes ( gross_cents )";

export const invoiceSummaryOf = (row: InvoiceSummaryRow): InvoiceSummary => ({
  id: row.id,
  organisationId: row.organisation_id,
  number: row.number,
  quoteId: row.quote_id,
  customerName: row.customer_name,
  issueDate: row.issue_date,
  dueDate: row.due_date,
  grossCents: Number(row.gross_cents),
  paidCents: paidCentsOf(row.invoice_payments.map((p) => ({ amountCents: Number(p.amount_cents), reversesId: p.reverses_id }))),
  creditedCents: row.credit_notes.reduce((sum, c) => sum + Number(c.gross_cents), 0),
  creditNoteCount: row.credit_notes.length,
  currencyCode: row.currency_code,
});

/** Every invoice of the business, newest first. One query. */
export async function getInvoices(): Promise<InvoiceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SUMMARY_COLUMNS)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load invoices: ${error.message}`);
  return (data as unknown as InvoiceSummaryRow[]).map(invoiceSummaryOf);
}

/** What customers owe this business, worked out in the database from the invoices and their payments. */
export async function getOwedTotals(organisationId: string, today: string): Promise<HomeMoney> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_owed_totals", { p_org: organisationId, p_today: today });
  if (error) throw new Error(`Could not load what is owed: ${error.message}`);
  const t = (data ?? {}) as { count?: unknown; owingCents?: unknown; overdueCents?: unknown; paidThisMonthCents?: unknown };
  return {
    count: Number(t.count ?? 0),
    owingCents: Number(t.owingCents ?? 0),
    overdueCents: Number(t.overdueCents ?? 0),
    paidThisMonthCents: Number(t.paidThisMonthCents ?? 0),
  };
}

export type StoredInvoice = InvoiceSummary & {
  /** Null for an invoice made without a quote. */
  quoteVersion: number | null;
  /** Made from a quote's draft rather than as the quote was agreed. */
  adjusted: boolean;
  note: string | null;
  snapshot: QuoteSnapshot;
  issuedAt: string;
  /** The quote it was made from, for the link back. */
  quote: { id: string; number: string } | null;
  /** The job made from the same quote, if any. */
  job: { id: string; number: number } | null;
  events: { id: string; kind: string; at: string }[];
  /** Every payment entry and reversal, oldest first. */
  payments: PaymentEntry[];
  /** The credit notes issued on it, oldest first, with the items they took off. */
  creditNotes: StoredCreditNote[];
  /** What the quote asked for up front, in cents, if it asked (the deposit, one tap from being recorded). */
  depositCents: number | null;
};

type QuoteEmbed = {
  id: string;
  number: string;
  jobs: { id: string; number: number; status: string }[] | null;
  quote_versions: { version: number; deposit: { depositCents?: unknown } | null }[];
};

export type StoredCreditNote = {
  id: string;
  number: string;
  issueDate: string;
  reason: CreditReason;
  grossCents: number;
  /** The items it credited. */
  lines: PriorCredit[];
  /** Its VAT groups, for working the next note's VAT within what the invoice has left. */
  groups: VatGroup[];
};

type CreditNoteRow = {
  id: string;
  number: string;
  issue_date: string;
  reason: string;
  gross_cents: number | string;
  created_at: string;
  groups: VatGroup[] | null;
  credit_note_lines: { line_index: number; quantity_milli: number | string; amount_cents: number | string }[];
};

type PaymentRow = {
  id: string;
  amount_cents: number | string;
  paid_on: string;
  method: string | null;
  note: string | null;
  reverses_id: string | null;
  created_at: string;
};

type DetailRow = InvoiceSummaryRow & {
  quote_version: number | null;
  adjusted: boolean;
  note: string | null;
  snapshot: QuoteSnapshot;
  created_at: string;
  quotes: QuoteEmbed | QuoteEmbed[] | null;
  invoice_events: { id: string; kind: string; created_at: string }[];
  all_payments: PaymentRow[];
  all_credit_notes: CreditNoteRow[];
};

/** One invoice with its history, or null when it isn't found. */
export async function findInvoice(id: string): Promise<StoredInvoice | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `${INVOICE_SUMMARY_COLUMNS}, quote_version, adjusted, note, snapshot, created_at,
       quotes ( id, number, jobs ( id, number, status ), quote_versions ( version, deposit:snapshot->deposit ) ),
       invoice_events ( id, kind, created_at ),
       all_payments:invoice_payments ( id, amount_cents, paid_on, method, note, reverses_id, created_at ),
       all_credit_notes:credit_notes ( id, number, issue_date, reason, gross_cents, created_at, groups:snapshot->totals->groups, credit_note_lines!credit_note_lines_note_same_org ( line_index, quantity_milli, amount_cents ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the invoice: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;
  const quote = Array.isArray(row.quotes) ? (row.quotes[0] ?? null) : row.quotes;
  return {
    ...invoiceSummaryOf(row),
    quoteVersion: row.quote_version,
    adjusted: row.adjusted,
    note: row.note,
    snapshot: row.snapshot,
    issuedAt: row.created_at,
    quote: quote ? { id: quote.id, number: quote.number } : null,
    job: (quote?.jobs ?? []).find((j) => j.status !== "cancelled") ?? null,
    creditNotes: [...row.all_credit_notes]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({
        id: c.id,
        number: c.number,
        issueDate: c.issue_date,
        reason: isCreditReason(c.reason) ? c.reason : "other",
        grossCents: Number(c.gross_cents),
        groups: Array.isArray(c.groups) ? c.groups : [],
        lines: c.credit_note_lines.map((l) => ({ lineIndex: l.line_index, quantityMilli: Number(l.quantity_milli), amountCents: Number(l.amount_cents) })),
      })),
    depositCents: row.quote_version === null ? null : depositOf(quote, row.quote_version),
    payments: [...row.all_payments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => ({
        id: p.id,
        amountCents: Number(p.amount_cents),
        paidOn: p.paid_on,
        method: isPaymentMethod(p.method) ? p.method : null,
        note: p.note,
        reversesId: p.reverses_id,
        createdAt: p.created_at,
      })),
    events: [...row.invoice_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ id: e.id, kind: e.kind, at: e.created_at })),
  };
}

/** The deposit the quote version asked for, if it asked for one. */
function depositOf(quote: QuoteEmbed | null, version: number): number | null {
  const cents = Number(quote?.quote_versions.find((v) => v.version === version)?.deposit?.depositCents);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export async function getInvoice(id: string): Promise<StoredInvoice> {
  const invoice = await findInvoice(id);
  if (!invoice) notFound();
  return invoice;
}
