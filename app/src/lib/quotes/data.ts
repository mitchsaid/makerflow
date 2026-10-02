import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { DiscountKind } from "./index";

/**
 * Quote reads. Row-level security limits every query to businesses the signed-in person
 * belongs to; the pages keep only the current business's rows (see customers/data.ts for why
 * this is done after the queries rather than inside them).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuoteSummary = {
  id: string;
  organisationId: string;
  status: string;
  customerName: string | null;
  issueDate: string;
  validUntil: string;
  grossCents: number;
  currencyCode: string;
  updatedAt: string;
};

type SummaryRow = {
  id: string;
  organisation_id: string;
  status: string;
  issue_date: string;
  valid_until: string;
  gross_cents: number;
  currency_code: string;
  updated_at: string;
  customers: { name: string } | { name: string }[] | null;
};

/** Every quote of the business, newest changes first. One query. */
export async function getQuotes(): Promise<QuoteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "id, organisation_id, status, issue_date, valid_until, gross_cents, currency_code, updated_at, customers(name)",
    )
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not load quotes: ${error.message}`);
  return (data as unknown as SummaryRow[]).map((row) => {
    const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    return {
      id: row.id,
      organisationId: row.organisation_id,
      status: row.status,
      customerName: customer?.name ?? null,
      issueDate: row.issue_date,
      validUntil: row.valid_until,
      grossCents: Number(row.gross_cents),
      currencyCode: row.currency_code,
      updatedAt: row.updated_at,
    };
  });
}

type LineRow = {
  id: string;
  sort_order: number;
  kind: string;
  name: string;
  description: string | null;
  quantity_milli: number;
  unit_price_cents: number;
  discount_kind: DiscountKind;
  discount_value: number;
};

type QuoteRow = {
  id: string;
  organisation_id: string;
  customer_id: string | null;
  status: string;
  issue_date: string;
  valid_until: string;
  needed_by: string | null;
  quote_discount_kind: DiscountKind;
  quote_discount_value: number;
  notes: string | null;
  quote_lines: LineRow[];
};

/** A stored quote with its lines, as numbers. Turn it into form text with toFormValues(). */
export type StoredQuote = {
  id: string;
  organisationId: string;
  status: string;
  customerId: string | null;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  discountKind: DiscountKind;
  discountValue: number;
  notes: string | null;
  lines: {
    id: string;
    sortOrder: number;
    kind: string;
    name: string;
    description: string | null;
    quantityMilli: number;
    unitPriceCents: number;
    discountKind: DiscountKind;
    discountValue: number;
  }[];
};

/** One quote with its lines. Not found for a bad or foreign id. */
export async function getStoredQuote(id: string): Promise<StoredQuote> {
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      `id, organisation_id, customer_id, status, issue_date, valid_until, needed_by,
       quote_discount_kind, quote_discount_value, notes,
       quote_lines (
         id, sort_order, kind, name, description, quantity_milli, unit_price_cents,
         discount_kind, discount_value
       )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the quote: ${error.message}`);
  if (!data) notFound();
  const row = data as unknown as QuoteRow;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    status: row.status,
    customerId: row.customer_id,
    issueDate: row.issue_date,
    validUntil: row.valid_until,
    neededBy: row.needed_by,
    discountKind: row.quote_discount_kind,
    discountValue: Number(row.quote_discount_value),
    notes: row.notes,
    lines: row.quote_lines.map((l) => ({
      id: l.id,
      sortOrder: l.sort_order,
      kind: l.kind,
      name: l.name,
      description: l.description,
      quantityMilli: Number(l.quantity_milli),
      unitPriceCents: Number(l.unit_price_cents),
      discountKind: l.discount_kind,
      discountValue: Number(l.discount_value),
    })),
  };
}
