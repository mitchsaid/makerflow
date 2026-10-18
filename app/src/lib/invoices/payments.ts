import { isIsoDay } from "../quotes/dates";
import { parseMoney } from "../money/parse";
import type { Cents } from "../money/primitives";

/**
 * Payments on an invoice (docs/plans/invoices-and-payments.md, slice I2). The entries are append-only: a payment is
 * never changed or deleted, a mistake is undone by a reversal that points at it. What has been paid is worked out here
 * from the entries, as is the status of the invoice.
 */

export const PAYMENT_METHODS = ["eft", "cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const isPaymentMethod = (value: unknown): value is PaymentMethod =>
  typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);

export const PAYMENT_NOTE_MAX = 500;

export type PaymentEntry = {
  id: string;
  amountCents: Cents;
  paidOn: string;
  method: PaymentMethod | null;
  note: string | null;
  /** Set on a reversal: the payment it undoes. */
  reversesId: string | null;
  createdAt: string;
};

/** Paid so far: the payments less the reversals. */
export function paidCentsOf(entries: readonly Pick<PaymentEntry, "amountCents" | "reversesId">[]): Cents {
  return entries.reduce((sum, e) => sum + (e.reversesId === null ? e.amountCents : -e.amountCents), 0);
}

export type PaymentRow = { payment: PaymentEntry; reversal: PaymentEntry | null };

/** The payments in the order they were received, each with the reversal that undid it, if any. Reversals are not rows. */
export function paymentRows(entries: readonly PaymentEntry[]): PaymentRow[] {
  const reversalOf = new Map(entries.filter((e) => e.reversesId !== null).map((e) => [e.reversesId as string, e]));
  return entries
    .filter((e) => e.reversesId === null)
    .sort((a, b) => (a.paidOn === b.paidOn ? a.createdAt.localeCompare(b.createdAt) : a.paidOn.localeCompare(b.paidOn)))
    .map((payment) => ({ payment, reversal: reversalOf.get(payment.id) ?? null }));
}

export type PaymentFormValues = { amount: string; paidOn: string; method: string; note: string };
export type PaymentFormErrors = Partial<Record<keyof PaymentFormValues, string>>;

export function parsePaymentForm(
  values: PaymentFormValues,
  context: {
    /** What is still owing on the invoice, in cents. */
    owingCents: Cents;
    /** What is owing, written for a message ("R 750,00"). */
    owingText: string;
    /** Today in the business's time zone. */
    today: string;
  },
):
  | { ok: true; amountCents: Cents; paidOn: string; method: PaymentMethod | null; note: string | null }
  | { ok: false; errors: PaymentFormErrors } {
  const errors: PaymentFormErrors = {};
  const paidOn = typeof values.paidOn === "string" ? values.paidOn.trim() : "";
  const note = typeof values.note === "string" ? values.note.trim() : "";
  const method = typeof values.method === "string" ? values.method.trim() : "";

  const amount = parseMoney(values.amount);
  let amountCents = 0;
  if (!amount.ok) errors.amount = amount.error;
  else if (amount.value <= 0) errors.amount = "Enter an amount above nothing.";
  else if (amount.value > context.owingCents) {
    errors.amount =
      context.owingCents <= 0
        ? "This invoice is paid in full."
        : `That is more than what is owing (${context.owingText}). Enter ${context.owingText} or less.`;
  } else amountCents = amount.value;

  if (!isIsoDay(paidOn)) errors.paidOn = "Choose the day it was paid.";
  else if (paidOn > context.today) errors.paidOn = "That day hasn't come yet. Choose today or earlier.";

  if (method !== "" && !isPaymentMethod(method)) errors.method = "Choose how it was paid from the list.";
  if (note.length > PAYMENT_NOTE_MAX) errors.note = `Keep the note under ${PAYMENT_NOTE_MAX} characters.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, amountCents, paidOn, method: method === "" ? null : (method as PaymentMethod), note: note === "" ? null : note };
}

/** What is owing, never below nothing. */
export const owingCentsOf = (grossCents: Cents, paidCents: Cents): Cents => Math.max(0, grossCents - paidCents);
