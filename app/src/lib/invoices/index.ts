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
  code: "business" | "customer-address" | "vat-changed";
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
  /** Whether the quote (and so the invoice's amounts) was made for a business registered for the tax. */
  taxRegistered: boolean;
  /** Whether the business is registered for the tax now. */
  businessRegistered: boolean;
  locale: LocalePack;
}): InvoiceProblem[] {
  const problems: InvoiceProblem[] = [];
  // The amounts are the quote's, so the invoice cannot be made if the business's registration changed since: it would
  // show tax the business doesn't charge, or no tax number on a tax invoice.
  if (input.taxRegistered !== input.businessRegistered) {
    problems.push({
      code: "vat-changed",
      message: "Your VAT registration has changed since this quote was sent, so an invoice made from it would be wrong. Quote again with your new VAT setting, and invoice that.",
    });
  }
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

export type InvoiceStatus = "unpaid" | "part_paid" | "paid" | "overdue" | "credited";

/**
 * Where an invoice stands, worked out (never stored): paid when nothing is owing, overdue when something is owing and
 * the due day has passed, part paid when some of it is paid, else unpaid. Payments arrive in the next slice: until
 * then `paidCents` is zero.
 */
export function invoiceStatus(input: {
  grossCents: Cents;
  /** What credit notes have taken off (none when absent). */
  creditedCents?: Cents;
  paidCents: Cents;
  dueDate: string;
  today: string;
}): InvoiceStatus {
  const credited = input.creditedCents ?? 0;
  // Everything credited: nothing is owed and the invoice is cancelled out, whatever was paid (a refund may be due).
  if (input.grossCents > 0 && credited >= input.grossCents) return "credited";
  const owing = input.grossCents - credited - input.paidCents;
  if (owing <= 0) return "paid";
  if (input.dueDate < input.today) return "overdue";
  return input.paidCents > 0 ? "part_paid" : "unpaid";
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Unpaid",
  part_paid: "Part paid",
  paid: "Paid",
  overdue: "Overdue",
  credited: "Credited",
};

export type InvoiceStatusTone = "neutral" | "good" | "warning";
export const invoiceStatusTone = (status: InvoiceStatus): InvoiceStatusTone =>
  status === "paid" ? "good" : status === "overdue" ? "warning" : "neutral";

export type InvoiceSummary = {
  id: string;
  organisationId: string;
  number: string;
  /** The quote it was made from, or null for an invoice made without one. */
  quoteId: string | null;
  customerName: string;
  issueDate: string;
  dueDate: string;
  grossCents: number;
  /** Paid so far: the payments less the reversals. */
  paidCents: number;
  /** What credit notes have taken off the invoice. */
  creditedCents: number;
  /** How many credit notes the invoice has. */
  creditNoteCount: number;
  currencyCode: string;
};

export type InvoiceFilter = "all" | "unpaid" | "overdue" | "paid" | "credited" | "drafts";
export const INVOICE_FILTERS: readonly { key: InvoiceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "credited", label: "Credited" },
  // Not issued yet: these are drafts, not invoices, and are listed by the list itself (visibleInvoices has none).
  { key: "drafts", label: "Drafts" },
];
export const parseInvoiceFilter = (value: unknown): InvoiceFilter | null =>
  INVOICE_FILTERS.some((f) => f.key === value) ? (value as InvoiceFilter) : null;

/** The invoices a list shows for a filter and a search (by number or customer). Newest first. */
export function visibleInvoices(
  invoices: readonly InvoiceSummary[],
  filter: InvoiceFilter,
  query: string,
  today: string,
): InvoiceSummary[] {
  const needle = query.trim().toLowerCase();
  if (filter === "drafts") return [];
  return invoices
    .filter((i) => {
      const status = invoiceStatus({ grossCents: i.grossCents, creditedCents: i.creditedCents, paidCents: i.paidCents, dueDate: i.dueDate, today });
      if (filter === "credited") return i.creditedCents > 0 && (needle === "" || matches(i, needle));
      if (filter === "paid" && status !== "paid") return false;
      if (filter === "overdue" && status !== "overdue") return false;
      // "Unpaid" means anything still owing, overdue included.
      if (filter === "unpaid" && (status === "paid" || status === "credited")) return false;
      return needle === "" || matches(i, needle);
    })
    .sort((a, b) => (a.issueDate === b.issueDate ? compareNumbers(b.number, a.number) : b.issueDate.localeCompare(a.issueDate)));
}

const matches = (i: InvoiceSummary, needle: string): boolean =>
  i.number.toLowerCase().includes(needle) || i.customerName.toLowerCase().includes(needle);

/** Invoice numbers in order: a longer number is a later one (INV-10000 after INV-9999), else by the letters and digits. */
function compareNumbers(a: string, b: string): number {
  return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
}

export type OwedTotals = { count: number; owingCents: number; overdueCents: number };

/** Home's money: what is owed, and what was paid in the calendar month so far (net of reversals, never below 0). */
export type HomeMoney = OwedTotals & { paidThisMonthCents: number };

/**
 * What customers owe: the invoices with something left to pay, the total owing, and how much of it is overdue.
 * A business has one currency, so the amounts are added as they are.
 */
export function owedTotals(invoices: readonly InvoiceSummary[], today: string): OwedTotals {
  let count = 0;
  let owingCents = 0;
  let overdueCents = 0;
  for (const i of invoices) {
    const owing = i.grossCents - i.creditedCents - i.paidCents;
    if (owing <= 0) continue;
    count += 1;
    owingCents += owing;
    if (i.dueDate < today) overdueCents += owing;
  }
  return { count, owingCents, overdueCents };
}
