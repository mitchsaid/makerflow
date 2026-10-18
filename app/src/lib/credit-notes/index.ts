import { isIsoDay } from "../quotes/dates";
import {
  allocateProportionally,
  calculateDocument,
  mulDivRound,
  parseMoney,
  parseQuantity,
  type Cents,
  type QuantityMilli,
  type VatGroup,
  type VatSettings,
  type VatStatus,
} from "../money";
import type { QuoteSnapshot } from "../quotes/snapshot";

/**
 * Credit notes (docs/plans/credit-notes.md). A credit note corrects an issued invoice, which never changes: it credits some
 * of the invoice's items, each for a quantity and an amount that cannot pass what is left of that item after earlier
 * credit notes, and the total credited can never pass the invoice's total.
 */

export const CREDIT_REASONS = ["returned", "cancelled", "price", "discount", "damaged", "other"] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];
export const isCreditReason = (value: unknown): value is CreditReason =>
  typeof value === "string" && (CREDIT_REASONS as readonly string[]).includes(value);

export const CREDIT_EXPLANATION_MAX = 500;

/** One item of the invoice that can be credited, with all it allows. */
export type CreditItem = {
  /** Its position in the invoice's document (the database keeps this). */
  index: number;
  name: string;
  unit: string | null;
  vatStatus: VatStatus;
  /** The quantity invoiced, and what the item came to after its discount and its share of the whole-invoice discount. */
  quantityMilli: QuantityMilli;
  amountCents: Cents;
};

/**
 * The items of an invoice that carry an amount, with what each came to in all: the line's total after its own discount,
 * less its share of the whole-invoice discount (shared in proportion, in exact cents, as the totals were worked out).
 * Delivery or collection lines at nothing cannot be credited, so they are left out.
 */
export function creditItemsOf(invoice: Pick<QuoteSnapshot, "lines" | "quoteDiscount">): CreditItem[] {
  const shares = allocateProportionally(
    invoice.quoteDiscount?.amountCents ?? 0,
    invoice.lines.map((l) => l.lineTotalCents),
  );
  return invoice.lines.flatMap((l, index) => {
    const amountCents = l.lineTotalCents - shares[index];
    if (amountCents <= 0) return [];
    return [
      {
        index,
        name: l.name,
        unit: l.unit ?? null,
        vatStatus: l.vatStatus ?? "standard",
        quantityMilli: l.quantityMilli,
        amountCents,
      },
    ];
  });
}

/** What earlier credit notes took off an item. */
export type PriorCredit = { lineIndex: number; quantityMilli: QuantityMilli; amountCents: Cents };

export type CreditRemaining = CreditItem & {
  /** What is left to credit on the item. */
  quantityLeftMilli: QuantityMilli;
  amountLeftCents: Cents;
};

export function remainingItems(items: readonly CreditItem[], prior: readonly PriorCredit[]): CreditRemaining[] {
  return items.map((item) => {
    const done = prior.filter((p) => p.lineIndex === item.index);
    return {
      ...item,
      quantityLeftMilli: Math.max(0, item.quantityMilli - done.reduce((s, p) => s + p.quantityMilli, 0)),
      amountLeftCents: Math.max(0, item.amountCents - done.reduce((s, p) => s + p.amountCents, 0)),
    };
  });
}

/** The amount that goes with a quantity: its share of what is left (all of it when it is all that is left). */
export function defaultCreditAmount(item: CreditRemaining, quantityMilli: QuantityMilli): Cents {
  if (item.quantityLeftMilli <= 0 || quantityMilli >= item.quantityLeftMilli) return item.amountLeftCents;
  return Math.min(item.amountLeftCents, mulDivRound(item.amountLeftCents, quantityMilli, item.quantityLeftMilli));
}

export type CreditLineForm = { index: number; selected: boolean; quantity: string; amount: string };
export type CreditFormValues = { reason: string; issueDate: string; explanation: string; lines: CreditLineForm[] };
export type CreditLineErrors = { quantity?: string; amount?: string };
export type CreditFormErrors = {
  reason?: string;
  issueDate?: string;
  explanation?: string;
  /** Nothing ticked. */
  lines?: string;
  byLine?: Record<number, CreditLineErrors>;
};

export type CreditLine = { index: number; quantityMilli: QuantityMilli; amountCents: Cents };

export function parseCreditForm(
  values: CreditFormValues,
  context: {
    remaining: readonly CreditRemaining[];
    /** The invoice's day and today: the credit note is dated between them. */
    invoiceDate: string;
    today: string;
    /** Written for messages ("R 500,00"). */
    money: (cents: Cents) => string;
    quantity: (milli: QuantityMilli, unit: string | null) => string;
  },
):
  | { ok: true; reason: CreditReason; issueDate: string; explanation: string; lines: CreditLine[] }
  | { ok: false; errors: CreditFormErrors } {
  const errors: CreditFormErrors = {};
  const reason = typeof values.reason === "string" ? values.reason : "";
  const issueDate = typeof values.issueDate === "string" ? values.issueDate.trim() : "";
  const explanation = typeof values.explanation === "string" ? values.explanation.trim() : "";

  if (!isCreditReason(reason)) errors.reason = "Choose why you are crediting this invoice.";
  if (!isIsoDay(issueDate)) errors.issueDate = "Choose the day of the credit note.";
  else if (issueDate < context.invoiceDate) errors.issueDate = "The credit note can't be dated before the invoice.";
  else if (issueDate > context.today) errors.issueDate = "That day hasn't come yet. Choose today or earlier.";
  if (explanation === "") errors.explanation = "Say in a few words what this credit is for.";
  else if (explanation.length > CREDIT_EXPLANATION_MAX) errors.explanation = `Keep it under ${CREDIT_EXPLANATION_MAX} characters.`;

  const lines: CreditLine[] = [];
  const byLine: Record<number, CreditLineErrors> = {};
  const selected = (Array.isArray(values.lines) ? values.lines : []).filter((l) => l?.selected);
  if (selected.length === 0) errors.lines = "Tick at least one item to credit.";
  for (const form of selected) {
    const item = context.remaining.find((r) => r.index === form.index);
    if (!item) continue;
    const e: CreditLineErrors = {};
    let quantityMilli = 0;
    let amountCents = 0;

    if (String(form.quantity ?? "").trim() === "0" || String(form.quantity ?? "").trim() === "") {
      // Nothing returned: a price change. (An empty box is not a guess at zero.)
      if (String(form.quantity ?? "").trim() === "") e.quantity = "Enter how many, or 0 if it is only a price change.";
    } else {
      const q = parseQuantity(form.quantity);
      if (!q.ok) e.quantity = q.error;
      else if (q.value > item.quantityLeftMilli) {
        e.quantity =
          item.quantityLeftMilli <= 0
            ? "All of this item has been credited. Enter 0 for a price change."
            : `Only ${context.quantity(item.quantityLeftMilli, item.unit)} left to credit.`;
      } else quantityMilli = q.value;
    }

    const a = parseMoney(form.amount);
    if (!a.ok) e.amount = a.error;
    else if (a.value <= 0) e.amount = "Enter an amount above nothing.";
    else if (a.value > item.amountLeftCents) {
      e.amount = item.amountLeftCents <= 0 ? "Nothing is left to credit on this item." : `Only ${context.money(item.amountLeftCents)} left to credit.`;
    } else amountCents = a.value;

    if (e.quantity || e.amount) byLine[form.index] = e;
    else lines.push({ index: form.index, quantityMilli, amountCents });
  }
  if (Object.keys(byLine).length > 0) errors.byLine = byLine;

  if (errors.reason || errors.issueDate || errors.explanation || errors.lines || errors.byLine) return { ok: false, errors };
  return { ok: true, reason: reason as CreditReason, issueDate, explanation, lines };
}

export type CreditTotals = {
  subtotalCents: Cents;
  netCents: Cents;
  vatCents: Cents;
  grossCents: Cents;
  groups: VatGroup[];
};

/**
 * The credit note's totals: the credited amounts by VAT status, VAT worked out once per status in the invoice's entry
 * mode. VAT is never more than the invoice's VAT left in that status, and when the credit takes the last of a status's
 * amount it takes exactly the last of its VAT, so crediting a whole invoice, in one note or several, credits exactly its
 * total and VAT.
 */
export function creditTotals(input: {
  lines: readonly { amountCents: Cents; vatStatus: VatStatus }[];
  vat: VatSettings;
  /** The invoice's own groups, and the groups of the credit notes already issued on it. */
  invoiceGroups: readonly Pick<VatGroup, "vatStatus" | "amountCents" | "vatCents">[];
  priorGroups: readonly Pick<VatGroup, "vatStatus" | "amountCents" | "vatCents">[];
}): CreditTotals {
  const doc = calculateDocument({
    lines: input.lines.map((l, i) => ({ id: String(i), quantityMilli: 1000, unitPriceCents: l.amountCents, vatStatus: l.vatStatus })),
    vat: input.vat,
  });
  const sum = (groups: readonly Pick<VatGroup, "vatStatus" | "amountCents" | "vatCents">[], status: VatStatus, field: "amountCents" | "vatCents") =>
    groups.filter((g) => g.vatStatus === status).reduce((s, g) => s + g[field], 0);

  const groups = doc.groups.map((g): VatGroup => {
    const invoiceAmount = sum(input.invoiceGroups, g.vatStatus, "amountCents");
    const vatLeft = Math.max(0, sum(input.invoiceGroups, g.vatStatus, "vatCents") - sum(input.priorGroups, g.vatStatus, "vatCents"));
    const amountLeft = invoiceAmount - sum(input.priorGroups, g.vatStatus, "amountCents");
    const vatCents = g.amountCents >= amountLeft ? vatLeft : Math.min(g.vatCents, vatLeft);
    if (vatCents === g.vatCents) return g;
    const exclusive = input.vat.registered && input.vat.entry === "exclusive";
    return exclusive
      ? { ...g, vatCents, netCents: g.amountCents, grossCents: g.amountCents + vatCents }
      : { ...g, vatCents, netCents: g.amountCents - vatCents, grossCents: g.amountCents };
  });
  return {
    subtotalCents: groups.reduce((s, g) => s + g.amountCents, 0),
    netCents: groups.reduce((s, g) => s + g.netCents, 0),
    vatCents: groups.reduce((s, g) => s + g.vatCents, 0),
    grossCents: groups.reduce((s, g) => s + g.grossCents, 0),
    groups,
  };
}

export type CreditNoteSummary = {
  id: string;
  number: string;
  issueDate: string;
  reason: CreditReason;
  grossCents: Cents;
};
