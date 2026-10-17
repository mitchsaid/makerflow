import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { QuoteSnapshot } from "../quotes/snapshot";
import type { InvoiceSummary } from "./index";

/**
 * Invoice reads. Row-level security limits every query to businesses the signed-in person belongs to; the pages keep
 * only the current business's rows (see customers/data.ts for why this is done after the queries).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SummaryRow = {
  id: string;
  organisation_id: string;
  number: string;
  quote_id: string;
  customer_name: string;
  issue_date: string;
  due_date: string;
  gross_cents: number | string;
  currency_code: string;
};

const SUMMARY_COLUMNS = "id, organisation_id, number, quote_id, customer_name, issue_date, due_date, gross_cents, currency_code";

const summaryOf = (row: SummaryRow): InvoiceSummary => ({
  id: row.id,
  organisationId: row.organisation_id,
  number: row.number,
  quoteId: row.quote_id,
  customerName: row.customer_name,
  issueDate: row.issue_date,
  dueDate: row.due_date,
  grossCents: Number(row.gross_cents),
  currencyCode: row.currency_code,
});

/** Every invoice of the business, newest first. One query. */
export async function getInvoices(): Promise<InvoiceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(SUMMARY_COLUMNS)
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load invoices: ${error.message}`);
  return (data as unknown as SummaryRow[]).map(summaryOf);
}

export type StoredInvoice = InvoiceSummary & {
  quoteVersion: number;
  note: string | null;
  snapshot: QuoteSnapshot;
  /** The quote's frozen costing, copied to the invoice. Private. */
  costing: unknown;
  issuedAt: string;
  /** The quote it was made from, for the link back. */
  quote: { id: string; number: string } | null;
  /** The job made from the same quote, if any. */
  job: { id: string; number: number } | null;
  events: { id: string; kind: string; at: string }[];
};

type QuoteEmbed = { id: string; number: string; jobs: { id: string; number: number; status: string }[] | null };

type DetailRow = SummaryRow & {
  quote_version: number;
  note: string | null;
  snapshot: QuoteSnapshot;
  costing: unknown;
  created_at: string;
  quotes: QuoteEmbed | QuoteEmbed[] | null;
  invoice_events: { id: string; kind: string; created_at: string }[];
};

/** One invoice with its history, or null when it isn't found. */
export async function findInvoice(id: string): Promise<StoredInvoice | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `${SUMMARY_COLUMNS}, quote_version, note, snapshot, costing, created_at,
       quotes ( id, number, jobs ( id, number, status ) ),
       invoice_events ( id, kind, created_at )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the invoice: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as DetailRow;
  const quote = Array.isArray(row.quotes) ? (row.quotes[0] ?? null) : row.quotes;
  return {
    ...summaryOf(row),
    quoteVersion: row.quote_version,
    note: row.note,
    snapshot: row.snapshot,
    costing: row.costing,
    issuedAt: row.created_at,
    quote: quote ? { id: quote.id, number: quote.number } : null,
    job: (quote?.jobs ?? []).find((j) => j.status !== "cancelled") ?? null,
    events: [...row.invoice_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ id: e.id, kind: e.kind, at: e.created_at })),
  };
}

export async function getInvoice(id: string): Promise<StoredInvoice> {
  const invoice = await findInvoice(id);
  if (!invoice) notFound();
  return invoice;
}
