import { isActiveJob, type JobSummary } from "../jobs";
import type { InvoiceSummary } from "../invoices";
import { quoteStatusKey } from "../quotes/status";
import type { QuoteSummary } from "../quotes/data";

/** What a customer's page says at the top: what they owe, what is waiting for an answer, what is being made. */
export type CustomerOverview = {
  /** What invoices still have owing after payments and credit notes (an invoice paid beyond what it comes to counts as nothing). */
  owingCents: number;
  /** Quotes the customer has not answered: drafts and sent ones that have not run out. */
  openQuotes: number;
  /** Jobs that are not done and not cancelled. */
  jobsInProgress: number;
};

export function customerOverview(input: {
  quotes: readonly Pick<QuoteSummary, "status" | "version" | "validUntil">[];
  jobs: readonly Pick<JobSummary, "status">[];
  invoices: readonly Pick<InvoiceSummary, "grossCents" | "paidCents" | "creditedCents">[];
  today: string;
}): CustomerOverview {
  return {
    owingCents: input.invoices.reduce((sum, i) => sum + Math.max(0, i.grossCents - i.creditedCents - i.paidCents), 0),
    openQuotes: input.quotes.filter((q) => {
      const key = quoteStatusKey({ status: q.status, version: q.version, validUntil: q.validUntil, today: input.today });
      return key === "draft" || key === "revising" || key === "sent";
    }).length,
    jobsInProgress: input.jobs.filter((j) => isActiveJob(j.status)).length,
  };
}
