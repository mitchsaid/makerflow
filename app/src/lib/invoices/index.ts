import { addDays, isIsoDay } from "../quotes/dates";
import { missingForInvoice } from "../business-profile";
import type { ContactFacts } from "../locale/types";
import type { LocalePack } from "../locale";
import type { Cents } from "../money/primitives";

/**
 * Invoices (docs/plans/invoices-and-payments.md). An invoice is made from an accepted quote's last sent version and never
 * changes once issued. Its status is never stored: it is worked out from what has been paid and the due day.
 */

export const INVOICE_NOTE_MAX = 2000;

/** What the maker fills in on the "Create invoice" sheet. Everything else comes from the quote. */
export type InvoiceFormValues = { issueDate: string; dueDate: string; note: string };
export type InvoiceFormErrors = Partial<Record<keyof InvoiceFormValues, string>>;

/** The dates the sheet starts with: today, and the business's usual days later. */
export function defaultInvoiceForm(today: string, dueDays: number): InvoiceFormValues {
  return { issueDate: today, dueDate: addDays(today, dueDays), note: "" };
}

export function parseInvoiceForm(
  values: InvoiceFormValues,
): { ok: true; issueDate: string; dueDate: string; note: string | null } | { ok: false; errors: InvoiceFormErrors } {
  const errors: InvoiceFormErrors = {};
  const issueDate = typeof values.issueDate === "string" ? values.issueDate.trim() : "";
  const dueDate = typeof values.dueDate === "string" ? values.dueDate.trim() : "";
  const note = typeof values.note === "string" ? values.note.trim() : "";
  if (!isIsoDay(issueDate)) errors.issueDate = "Choose the invoice date.";
  if (!isIsoDay(dueDate)) errors.dueDate = "Choose the day it is due.";
  else if (isIsoDay(issueDate) && dueDate < issueDate) errors.dueDate = "The due day can't be before the invoice date.";
  if (note.length > INVOICE_NOTE_MAX) errors.note = `Keep the note under ${INVOICE_NOTE_MAX} characters.`;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, issueDate, dueDate, note: note === "" ? null : note };
}

export type InvoiceProblem = {
  code: "business" | "customer-address";
  /** What is wrong and how to fix it. */
  message: string;
};

type CustomerFacts = { addressLines: readonly string[] } | null;

/**
 * What must be on the invoice before it can be issued, from the country's rules (the locale pack): the business's
 * premises address, and for a full tax invoice the customer's address. Issuing is refused with these, and the sheet
 * shows them first. (The pack's list also asks for a way to be contacted; that is a courtesy on a quote, and the law asks
 * nothing like it of an invoice, so only the address is a blocker here.)
 */
export function invoiceProblems(input: {
  business: ContactFacts;
  customer: CustomerFacts;
  grossCents: Cents;
  taxRegistered: boolean;
  locale: LocalePack;
}): InvoiceProblem[] {
  const problems: InvoiceProblem[] = [];
  const missing = missingForInvoice(input.business, input.locale).filter((f) => f === "addressLine1" || f === "city");
  if (missing.length > 0) {
    problems.push({
      code: "business",
      message: "Add your business address (street and town) to your business profile. An invoice has to show it.",
    });
  }
  if (
    input.locale.documents.invoice.needsCustomerAddress(input.grossCents, input.taxRegistered) &&
    (!input.customer || input.customer.addressLines.length === 0)
  ) {
    problems.push({
      code: "customer-address",
      message: "Add your customer's address. A tax invoice of this size has to show who it is for.",
    });
  }
  return problems;
}

export type InvoiceStatus = "unpaid" | "part_paid" | "paid" | "overdue";

/**
 * Where an invoice stands, worked out (never stored): paid when nothing is owing, overdue when something is owing and
 * the due day has passed, part paid when some of it is paid, else unpaid. Payments arrive in the next slice: until
 * then `paidCents` is zero.
 */
export function invoiceStatus(input: { grossCents: Cents; paidCents: Cents; dueDate: string; today: string }): InvoiceStatus {
  const owing = input.grossCents - input.paidCents;
  if (owing <= 0) return "paid";
  if (input.dueDate < input.today) return "overdue";
  return input.paidCents > 0 ? "part_paid" : "unpaid";
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
};

export type InvoiceStatusTone = "neutral" | "good" | "warning";
export const invoiceStatusTone = (status: InvoiceStatus): InvoiceStatusTone =>
  status === "paid" ? "good" : status === "overdue" ? "warning" : "neutral";

export type InvoiceSummary = {
  id: string;
  organisationId: string;
  number: string;
  quoteId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  grossCents: number;
  currencyCode: string;
};

export type InvoiceFilter = "all" | "unpaid" | "overdue" | "paid";
export const INVOICE_FILTERS: readonly { key: InvoiceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];
export const parseInvoiceFilter = (value: unknown): InvoiceFilter | null =>
  INVOICE_FILTERS.some((f) => f.key === value) ? (value as InvoiceFilter) : null;

/** The invoices a list shows for a filter and a search (by number or customer). Newest first. */
export function visibleInvoices(
  invoices: readonly InvoiceSummary[],
  filter: InvoiceFilter,
  query: string,
  today: string,
  paidCentsOf: (invoice: InvoiceSummary) => number = () => 0,
): InvoiceSummary[] {
  const needle = query.trim().toLowerCase();
  return invoices
    .filter((i) => {
      const status = invoiceStatus({ grossCents: i.grossCents, paidCents: paidCentsOf(i), dueDate: i.dueDate, today });
      if (filter === "paid" && status !== "paid") return false;
      if (filter === "overdue" && status !== "overdue") return false;
      // "Unpaid" means anything still owing, overdue included.
      if (filter === "unpaid" && status === "paid") return false;
      return needle === "" || i.number.toLowerCase().includes(needle) || i.customerName.toLowerCase().includes(needle);
    })
    .sort((a, b) => (a.issueDate === b.issueDate ? b.number.localeCompare(a.number) : b.issueDate.localeCompare(a.issueDate)));
}
