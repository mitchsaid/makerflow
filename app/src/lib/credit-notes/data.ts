import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { QuoteSnapshot } from "../quotes/snapshot";
import { isCreditReason, type CreditReason } from "./index";

/** Credit note reads. Row-level security limits every query to businesses the signed-in person belongs to. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoredCreditNote = {
  id: string;
  organisationId: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  reason: CreditReason;
  explanation: string;
  currencyCode: string;
  grossCents: number;
  snapshot: QuoteSnapshot;
  issuedAt: string;
};

type Row = {
  id: string;
  organisation_id: string;
  number: string;
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  issue_date: string;
  reason: string;
  explanation: string;
  currency_code: string;
  gross_cents: number | string;
  snapshot: QuoteSnapshot;
  created_at: string;
};

export async function findCreditNote(id: string): Promise<StoredCreditNote | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_notes")
    .select("id, organisation_id, number, invoice_id, invoice_number, customer_name, issue_date, reason, explanation, currency_code, gross_cents, snapshot, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the credit note: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Row;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    number: row.number,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    issueDate: row.issue_date,
    reason: isCreditReason(row.reason) ? row.reason : "other",
    explanation: row.explanation,
    currencyCode: row.currency_code,
    grossCents: Number(row.gross_cents),
    snapshot: row.snapshot,
    issuedAt: row.created_at,
  };
}

export async function getCreditNote(id: string): Promise<StoredCreditNote> {
  const note = await findCreditNote(id);
  if (!note) notFound();
  return note;
}
