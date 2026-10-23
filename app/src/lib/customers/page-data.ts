import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { CUSTOMER_DRAFT_COLUMNS, customerDraftOf, type CustomerDraftRow } from "../invoices/draft-data";
import { INVOICE_SUMMARY_COLUMNS, invoiceSummaryOf, type InvoiceSummaryRow } from "../invoices/data";
import type { InvoiceSummary } from "../invoices";
import { JOB_SUMMARY_COLUMNS, summary as jobSummaryOf, type JobSummaryRow } from "../jobs/data";
import type { JobSummary } from "../jobs";
import { QUOTE_SUMMARY_COLUMNS, quoteSummaryOf, type QuoteSummary, type QuoteSummaryColumns } from "../quotes/data";
import { CUSTOMER_FULL_COLUMNS, customerOfRow, type FullRow } from "./data";
import type { Customer } from "./index";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The latest this many of each kind are shown on a customer's page. */
const LIMIT = 200;

export type CustomerPageData = {
  customer: Customer;
  quotes: QuoteSummary[];
  jobs: JobSummary[];
  invoices: InvoiceSummary[];
  /** Invoices started for this customer and not issued yet. */
  drafts: ReturnType<typeof customerDraftOf>[];
};

type Row = FullRow & { quotes: QuoteSummaryColumns[] | null; jobs: JobSummaryRow[] | null; invoices: InvoiceSummaryRow[] | null; invoice_drafts: CustomerDraftRow[] | null };

/**
 * A customer with their quotes, jobs and invoices, in one query (the page makes one query for its main data). Row-level
 * security limits it to businesses the person belongs to; the page keeps only the current business's rows.
 */
export async function getCustomerPage(id: string): Promise<CustomerPageData> {
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      `${CUSTOMER_FULL_COLUMNS},
       quotes:quotes!quotes_customer_same_org ( ${QUOTE_SUMMARY_COLUMNS} ),
       jobs:jobs!jobs_customer_same_org ( ${JOB_SUMMARY_COLUMNS} ),
       invoices:invoices!invoices_customer_same_org ( ${INVOICE_SUMMARY_COLUMNS} ),
       invoice_drafts:invoice_drafts!invoice_drafts_customer_same_org ( ${CUSTOMER_DRAFT_COLUMNS} )`,
    )
    .eq("id", id)
    .order("updated_at", { referencedTable: "quotes", ascending: false })
    .limit(LIMIT, { referencedTable: "quotes" })
    .order("created_at", { referencedTable: "jobs", ascending: false })
    .limit(LIMIT, { referencedTable: "jobs" })
    .order("issue_date", { referencedTable: "invoices", ascending: false })
    .order("number", { referencedTable: "invoices", ascending: false })
    .limit(LIMIT, { referencedTable: "invoices" })
    .order("updated_at", { referencedTable: "invoice_drafts", ascending: false })
    .limit(LIMIT, { referencedTable: "invoice_drafts" })
    .maybeSingle();
  if (error) throw new Error(`Could not load the customer: ${error.message}`);
  if (!data) notFound();
  const row = data as unknown as Row;
  return {
    customer: customerOfRow(row),
    quotes: (row.quotes ?? []).map((q) => quoteSummaryOf(q, row.name)),
    jobs: (row.jobs ?? []).map(jobSummaryOf),
    invoices: (row.invoices ?? []).map(invoiceSummaryOf),
    drafts: (row.invoice_drafts ?? []).map((d) => customerDraftOf(d, row.name)),
  };
}
