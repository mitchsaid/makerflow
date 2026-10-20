import { addDays, daysBetween } from "../quotes/dates";
import type { Cents } from "../money";
import type { PaymentEntry } from "../invoices/payments";

/**
 * A customer's statement of account (docs/plans/customer-statements.md): their invoices, what they have paid and been
 * credited, a running balance, and how old what is owing is. It is a view, worked out here from the invoices, payments
 * and credit notes as they are today; nothing is stored or numbered.
 */

export const PERIODS = ["all", "this_month", "last_30", "last_90", "ytd"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = {
  all: "All time",
  this_month: "This month",
  last_30: "Last 30 days",
  last_90: "Last 90 days",
  ytd: "Year to date",
};
export const parsePeriod = (value: unknown): Period => ((PERIODS as readonly string[]).includes(value as string) ? (value as Period) : "all");

/** The first day a period covers (null for all time), given today's date. */
export function periodStart(period: Period, today: string): string | null {
  switch (period) {
    case "all":
      return null;
    case "this_month":
      return `${today.slice(0, 7)}-01`;
    case "last_30":
      return addDays(today, -30);
    case "last_90":
      return addDays(today, -90);
    case "ytd":
      return `${today.slice(0, 4)}-01-01`;
  }
}

/** One invoice with what has happened to it, as the statement needs it. */
export type StatementInvoice = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  grossCents: Cents;
  /** What it was for, in a few words ("2 x Cake, Sign"). */
  description: string;
  payments: readonly PaymentEntry[];
  creditNotes: readonly { id: string; number: string; issueDate: string; reason: string; grossCents: Cents }[];
};

export type StatementEntry = {
  /** A stable key. */
  key: string;
  date: string;
  kind: "invoice" | "credit_note" | "payment" | "reversal";
  /** The document's number (the invoice's, for a payment). */
  reference: string;
  description: string;
  debitCents: Cents;
  creditCents: Cents;
  /** Where the row leads: its invoice or credit note. */
  invoiceId: string;
  creditNoteId: string | null;
  /** The balance after this row. */
  balanceCents: Cents;
};

/** What is owing, by how many days past its due day each invoice is (nothing is overdue on the due day itself). */
export type Ageing = { notDueCents: Cents; days1Cents: Cents; days31Cents: Cents; days61Cents: Cents; days91Cents: Cents; totalCents: Cents };

/** The five buckets in order, oldest last: the amounts the labels in the locale pack go with. */
export const ageingAmounts = (a: Ageing): [Cents, Cents, Cents, Cents, Cents] => [a.notDueCents, a.days1Cents, a.days31Cents, a.days61Cents, a.days91Cents];

export type Statement = {
  /** What was owing before the period began (zero for all time). */
  openingCents: Cents;
  entries: StatementEntry[];
  invoicedCents: Cents;
  creditedCents: Cents;
  paidCents: Cents;
  /** The balance at the end: what is owing, or (negative) what the customer is owed. */
  closingCents: Cents;
  ageing: Ageing;
  /** What invoices were paid beyond what they now come to (credit notes after a payment). */
  creditOnAccountCents: Cents;
  /** The number of invoices that still have something owing. */
  openInvoices: number;
};

const KIND_ORDER: Record<StatementEntry["kind"], number> = { invoice: 0, credit_note: 1, payment: 2, reversal: 3 };
const sum = (values: readonly number[]) => values.reduce((s, v) => s + v, 0);

/** What is owing on one invoice: its total less credit notes and payments (below nothing is credit on account). */
function owingOn(invoice: StatementInvoice): Cents {
  const paid = sum(invoice.payments.map((p) => (p.reversesId === null ? p.amountCents : -p.amountCents)));
  return invoice.grossCents - sum(invoice.creditNotes.map((c) => c.grossCents)) - paid;
}

export function buildStatement(input: {
  invoices: readonly StatementInvoice[];
  today: string;
  period: Period;
  /** Only the invoices that still have something owing (with their payments and credit notes). */
  onlyOwing: boolean;
  methodLabel?: (method: string) => string;
}): Statement {
  const { today, period } = input;
  const invoices = input.onlyOwing ? input.invoices.filter((i) => owingOn(i) > 0) : input.invoices;
  const methodLabel = input.methodLabel ?? ((m: string) => m);

  type Raw = Omit<StatementEntry, "balanceCents"> & { order: number; created: string };
  const raw: Raw[] = [];
  for (const i of invoices) {
    raw.push({ key: `invoice-${i.id}`, date: i.issueDate, kind: "invoice", reference: i.number, description: i.description, debitCents: i.grossCents, creditCents: 0, invoiceId: i.id, creditNoteId: null, order: KIND_ORDER.invoice, created: i.issueDate });
    for (const c of i.creditNotes) {
      raw.push({ key: `credit-${c.id}`, date: c.issueDate, kind: "credit_note", reference: c.number, description: `Credit note for ${i.number}: ${c.reason}`, debitCents: 0, creditCents: c.grossCents, invoiceId: i.id, creditNoteId: c.id, order: KIND_ORDER.credit_note, created: c.issueDate });
    }
    for (const p of i.payments) {
      const how = p.method ? `, ${methodLabel(p.method)}` : "";
      raw.push(
        p.reversesId === null
          ? { key: `payment-${p.id}`, date: p.paidOn, kind: "payment", reference: i.number, description: `Payment received${how}`, debitCents: 0, creditCents: p.amountCents, invoiceId: i.id, creditNoteId: null, order: KIND_ORDER.payment, created: p.createdAt }
          : { key: `reversal-${p.id}`, date: p.paidOn, kind: "reversal", reference: i.number, description: "Payment reversed", debitCents: p.amountCents, creditCents: 0, invoiceId: i.id, creditNoteId: null, order: KIND_ORDER.reversal, created: p.createdAt },
      );
    }
  }
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.created.localeCompare(b.created) || a.key.localeCompare(b.key));

  const start = periodStart(period, today);
  const before = start === null ? [] : raw.filter((r) => r.date < start);
  const within = raw.filter((r) => r.date <= today && (start === null || r.date >= start));
  const openingCents = sum(before.map((r) => r.debitCents - r.creditCents));

  let running = openingCents;
  const entries: StatementEntry[] = within.map((r) => {
    running += r.debitCents - r.creditCents;
    return {
      key: r.key,
      date: r.date,
      kind: r.kind,
      reference: r.reference,
      description: r.description,
      debitCents: r.debitCents,
      creditCents: r.creditCents,
      invoiceId: r.invoiceId,
      creditNoteId: r.creditNoteId,
      balanceCents: running,
    };
  });

  // Ageing: what each invoice still has owing, by how many days past its due day it is.
  const ageing: Ageing = { notDueCents: 0, days1Cents: 0, days31Cents: 0, days61Cents: 0, days91Cents: 0, totalCents: 0 };
  let creditOnAccountCents = 0;
  let openInvoices = 0;
  for (const i of invoices) {
    const owing = owingOn(i);
    if (owing < 0) creditOnAccountCents += -owing;
    if (owing <= 0) continue;
    openInvoices += 1;
    const overdue = daysBetween(i.dueDate, today);
    if (overdue <= 0) ageing.notDueCents += owing;
    else if (overdue <= 30) ageing.days1Cents += owing;
    else if (overdue <= 60) ageing.days31Cents += owing;
    else if (overdue <= 90) ageing.days61Cents += owing;
    else ageing.days91Cents += owing;
    ageing.totalCents += owing;
  }

  return {
    openingCents,
    entries,
    invoicedCents: sum(entries.filter((e) => e.kind === "invoice").map((e) => e.debitCents)),
    creditedCents: sum(entries.filter((e) => e.kind === "credit_note").map((e) => e.creditCents)),
    paidCents: sum(entries.filter((e) => e.kind === "payment").map((e) => e.creditCents)) - sum(entries.filter((e) => e.kind === "reversal").map((e) => e.debitCents)),
    closingCents: running,
    ageing,
    creditOnAccountCents,
    openInvoices,
  };
}
