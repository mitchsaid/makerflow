import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isStarterKey, type ThemeRef } from "../quotes/themes";
import { isInvoiceDraftForm, type InvoiceDraftForm } from "./draft";

/**
 * Invoice draft reads. Row-level security limits every query to businesses the signed-in person belongs to; the pages
 * keep only the current business's rows (see customers/data.ts for why this is done after the queries).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  quote_id: string | null;
  quote_version: number | null;
  customer_id: string | null;
  theme_id: string | null;
  theme_starter: string | null;
  form: unknown;
  created_at: string;
  updated_at: string;
  customers: { name: string } | { name: string }[] | null;
  quotes: QuoteEmbed | QuoteEmbed[] | null;
};

type QuoteEmbed = { number: string; theme_id: string | null; theme_starter: string | null };

export type InvoiceDraftSummary = {
  id: string;
  organisationId: string;
  quoteId: string | null;
  customerName: string | null;
  /** The form as it was saved, or null when what is stored cannot be read as an invoice form (it is then only discardable). */
  form: InvoiceDraftForm | null;
  updatedAt: string;
};

export type StoredInvoiceDraft = InvoiceDraftSummary & {
  /** The number of the quote it adjusts, if any. */
  quoteNumber: string | null;
  /** The version of that quote it started from. */
  quoteVersion: number | null;
  /**
   * The theme the invoice is drawn in: the one chosen for the draft, else (an older draft) the design its quote uses,
   * else none (Classic). It is copied from the quote when a draft is made from one, so it stays put after that.
   */
  theme: ThemeRef;
  /** Read when the draft was read: issuing checks nothing has changed since. */
  stamp: string;
};

const COLUMNS = "id, organisation_id, quote_id, quote_version, customer_id, theme_id, theme_starter, form, created_at, updated_at, customers ( name ), quotes ( number, theme_id, theme_starter )";

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

function summaryOf(row: Row): StoredInvoiceDraft {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    quoteId: row.quote_id,
    customerName: one(row.customers)?.name ?? null,
    form: isInvoiceDraftForm(row.form) ? row.form : null,
    updatedAt: row.updated_at,
    quoteNumber: one(row.quotes)?.number ?? null,
    quoteVersion: row.quote_version,
    theme: (() => {
      if (row.theme_id !== null || isStarterKey(row.theme_starter)) return { id: row.theme_id, starter: isStarterKey(row.theme_starter) ? row.theme_starter : null };
      const q = one(row.quotes);
      return q ? { id: q.theme_id, starter: isStarterKey(q.theme_starter) ? q.theme_starter : null } : { id: null, starter: null };
    })(),
    stamp: row.updated_at,
  };
}

/** The columns of a customer's drafts, read inside the customer's own query (the page makes one query). */
export const CUSTOMER_DRAFT_COLUMNS = "id, organisation_id, quote_id, form, updated_at, quotes ( number )";

export type CustomerDraftRow = {
  id: string;
  organisation_id: string;
  quote_id: string | null;
  form: unknown;
  updated_at: string;
  quotes: { number: string } | { number: string }[] | null;
};

/** A draft read inside a customer's page: enough to show it as a row. The customer is the one whose page it is. */
export function customerDraftOf(row: CustomerDraftRow, customerName: string): InvoiceDraftSummary & { quoteNumber: string | null } {
  return {
    id: row.id,
    organisationId: row.organisation_id,
    quoteId: row.quote_id,
    customerName,
    form: isInvoiceDraftForm(row.form) ? row.form : null,
    updatedAt: row.updated_at,
    quoteNumber: one(row.quotes)?.number ?? null,
  };
}

/** Every draft of the business, newest changes first. One query. */
export async function getInvoiceDrafts(): Promise<StoredInvoiceDraft[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoice_drafts").select(COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Could not load invoice drafts: ${error.message}`);
  return (data as unknown as Row[]).map(summaryOf);
}

/** One draft, or null for a bad id or one this person cannot see. */
export async function findInvoiceDraft(id: string): Promise<StoredInvoiceDraft | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoice_drafts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the invoice draft: ${error.message}`);
  return data ? summaryOf(data as unknown as Row) : null;
}

/** One draft. Shows the "not found" page for a bad or foreign id. */
export async function getInvoiceDraft(id: string): Promise<StoredInvoiceDraft> {
  const draft = await findInvoiceDraft(id);
  if (!draft) notFound();
  return draft;
}
