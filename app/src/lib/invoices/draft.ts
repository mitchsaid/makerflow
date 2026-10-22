import { isIsoDay, addDays } from "../quotes/dates";
import { isBlankLine, isQuoteFormValues, parseQuote, previewTotals, QUOTE_MAX_LINES, type ParsedQuote, type QuoteErrors, type QuoteFormValues } from "../quotes";
import type { VatSettings } from "../money";
import { INVOICE_NOTE_MAX } from "./index";
import type { StoredInvoiceDraft } from "./draft-data";

/**
 * An invoice DRAFT (docs/plans/invoice-i3.md, I3b and I3c): the invoice form's values, kept until it is issued or
 * discarded. It is the quote form's own values (the same items, delivery, discount and note) plus the day the invoice is
 * due, so the one parser and the one money code work out every total, on the server, when it is issued. The quote-only
 * parts of the values (a heading, a sign-off, a deposit, terms, a valid-until day) are carried empty and never used.
 */
export type InvoiceDraftForm = QuoteFormValues & { dueDate: string };

/** A new, empty invoice: today's date, the business's usual due day, and the customer if one is already chosen. */
export function blankInvoiceForm(input: { today: string; dueDays: number; customerId?: string }): InvoiceDraftForm {
  return {
    customerId: input.customerId ?? "",
    issueDate: input.today,
    dueDate: addDays(input.today, input.dueDays),
    validUntil: addDays(input.today, input.dueDays),
    neededBy: "",
    lines: [],
    fulfilment: "none",
    deliveryFee: "",
    deliveryAddress: "",
    discountKind: "none",
    discountValue: "",
    notes: "",
    title: "",
    description: "",
    signOff: "",
    paymentInstructions: "",
    showBankDetails: true,
    showPhotos: true,
    depositKind: "none",
    depositValue: "",
    balanceDue: "handover",
    balanceDueDate: "",
    balanceDueText: "",
    policies: [],
  };
}

/** Whether something that came from the browser (or from the database) is an invoice form, before anything reads it. */
export function isInvoiceDraftForm(value: unknown): value is InvoiceDraftForm {
  return isQuoteFormValues(value) && typeof (value as { dueDate?: unknown }).dueDate === "string" && (value as QuoteFormValues).lines.length <= QUOTE_MAX_LINES;
}

/** The invoice's values as the quote parser reads them: the due day stands in for "valid until". */
export function quoteValuesOf(form: InvoiceDraftForm): QuoteFormValues {
  const { dueDate, ...rest } = form;
  return { ...rest, validUntil: dueDate, neededBy: "" };
}

export type InvoiceDraftErrors = QuoteErrors & { fields: QuoteErrors["fields"] & { dueDate?: string } };

/**
 * Reads an invoice form strictly, as it will be issued: a customer, the dates (the due day not before the invoice day),
 * at least one item, and everything the quote parser checks. Totals are worked out here, never taken from the browser.
 */
export function parseInvoiceDraft(
  form: InvoiceDraftForm,
  vat: VatSettings,
): { ok: true; quote: ParsedQuote; dueDate: string; note: string | null } | { ok: false; errors: InvoiceDraftErrors } {
  const parsed = parseQuote(quoteValuesOf(form), vat);
  const errors: InvoiceDraftErrors = parsed.ok ? { fields: {}, lines: {} } : { fields: { ...parsed.errors.fields }, lines: { ...parsed.errors.lines } };

  // The quote parser's words about a quote do not fit an invoice.
  if (errors.fields.issueDate) errors.fields.issueDate = "Choose the invoice date.";
  delete errors.fields.validUntil;
  if (!isIsoDay(form.dueDate)) errors.fields.dueDate = "Choose the day it is due.";
  else if (isIsoDay(form.issueDate) && form.dueDate < form.issueDate) errors.fields.dueDate = "The due day can't be before the invoice date.";
  if (form.customerId.trim() === "") errors.fields.customerId = "Choose who the invoice is for.";
  if (errors.fields.lines?.startsWith("A quote can have")) errors.fields.lines = errors.fields.lines.replace("A quote can have", "An invoice can have");
  else if (!errors.fields.lines && form.lines.filter((l) => !isBlankLine(l)).length === 0) errors.fields.lines = "Add at least one item.";
  if (form.notes.trim().length > INVOICE_NOTE_MAX) errors.fields.notes = `Keep the note under ${INVOICE_NOTE_MAX} characters.`;

  if (Object.keys(errors.fields).length > 0 || Object.keys(errors.lines).length > 0 || !parsed.ok) {
    return { ok: false, errors };
  }
  return { ok: true, quote: parsed.quote, dueDate: form.dueDate, note: form.notes.trim() === "" ? null : form.notes.trim() };
}

/** One draft as the Invoices list shows it. */
export type InvoiceDraftRow = {
  id: string;
  customerName: string | null;
  itemCount: number;
  /** The total as it stands (null while an item is not priced yet). */
  grossCents: number | null;
  /** The quote it adjusts, if any. */
  quoteNumber: string | null;
  updatedAt: string;
};

export function draftRowsOf(drafts: readonly StoredInvoiceDraft[], vat: VatSettings): InvoiceDraftRow[] {
  return drafts.map((d) => {
    const items = d.form ? d.form.lines.filter((l) => !isBlankLine(l)) : [];
    const totals = d.form ? previewTotals(d.form, vat) : null;
    // A total of nothing, for items that are not priced yet, is not a total.
    const priced = items.length > 0 && totals !== null && items.every((l) => l.unitPrice.trim() !== "");
    return {
      id: d.id,
      customerName: d.customerName,
      itemCount: items.length,
      grossCents: priced && totals ? totals.grossCents : null,
      quoteNumber: d.quoteNumber,
      updatedAt: d.updatedAt,
    };
  });
}

/**
 * Whether an invoice made from a quote's draft differs from the quote as it was agreed: any item's name, details,
 * quantity, price or total, or the totals. Anything that differs counts (so an invoice is never described as the
 * agreed quote when it is not); an exact match does not.
 */
export function differsFromQuote(
  invoice: { lines: readonly unknown[]; totals: unknown; quoteDiscount?: unknown },
  quoted: { lines: readonly unknown[]; totals: unknown; quoteDiscount?: unknown },
): boolean {
  const key = (s: typeof invoice) =>
    JSON.stringify({
      lines: s.lines.map((l) => {
        const x = l as Record<string, unknown>;
        return [x.kind, x.name, x.description ?? null, x.quantityMilli, x.unit ?? null, x.unitPriceCents, x.discount ?? null, x.lineTotalCents, x.vatStatus ?? null];
      }),
      totals: s.totals,
      discount: s.quoteDiscount ?? null,
    });
  return key(invoice) !== key(quoted);
}
