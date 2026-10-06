import { calculateDeposit, parseMoney, parsePercent, type BasisPoints, type Cents } from "../money";
import { isIsoDay } from "./dates";

/**
 * A deposit on a quote: a percentage of the total or a fixed amount, and when the rest is due (on
 * collection or delivery, or by a date). The amounts come from calculateDeposit (lib/money): the
 * deposit is rounded to the cent, never more than the total, and deposit + balance always add up.
 * See docs/plans/quote-deposits.md.
 */

export type DepositKind = "none" | "percent" | "fixed";
export type BalanceDue = "handover" | "date";

/** What the quote form holds (everything is text). */
export type DepositFormValues = {
  depositKind: DepositKind;
  /** "50" for a percentage, "1 250" for an amount. */
  depositValue: string;
  balanceDue: BalanceDue;
  /** YYYY-MM-DD, only used when balanceDue is "date". */
  balanceDueDate: string;
};

export type BalanceTerm = { kind: "handover" } | { kind: "date"; date: string };

/** Checked and exact. */
export type ParsedDeposit =
  | { kind: "percent"; basisPoints: BasisPoints; balance: BalanceTerm }
  | { kind: "fixed"; cents: Cents; balance: BalanceTerm };

export type DepositErrors = Partial<Record<"depositValue" | "balanceDueDate", string>>;

export const NO_DEPOSIT: DepositFormValues = { depositKind: "none", depositValue: "", balanceDue: "handover", balanceDueDate: "" };

export function isDepositKind(value: unknown): value is DepositKind {
  return value === "none" || value === "percent" || value === "fixed";
}

/** Checks the deposit part of a quote, saying how to fix what is wrong. A quote with no deposit is fine. */
export function parseDeposit(
  values: Partial<DepositFormValues>,
  /** The quote's date: the balance can't be due before it. */
  issueDate: string,
): { ok: true; deposit: ParsedDeposit | null } | { ok: false; errors: DepositErrors } {
  const kind = values.depositKind ?? "none";
  if (kind === "none") return { ok: true, deposit: null };
  if (!isDepositKind(kind)) return { ok: false, errors: { depositValue: "Choose a percentage or an amount." } };

  const errors: DepositErrors = {};
  let amount: { kind: "percent"; basisPoints: BasisPoints } | { kind: "fixed"; cents: Cents } | null = null;
  if (kind === "percent") {
    const r = parsePercent(values.depositValue ?? "");
    if (!r.ok) errors.depositValue = r.error;
    else if (r.value <= 0) errors.depositValue = "Enter a percentage above 0, or untick the deposit.";
    else amount = { kind: "percent", basisPoints: r.value };
  } else {
    const r = parseMoney(values.depositValue ?? "");
    if (!r.ok) errors.depositValue = r.error;
    else if (r.value <= 0) errors.depositValue = "Enter an amount above 0, or untick the deposit.";
    else amount = { kind: "fixed", cents: r.value };
  }

  let balance: BalanceTerm = { kind: "handover" };
  if (values.balanceDue === "date") {
    const date = values.balanceDueDate ?? "";
    if (!isIsoDay(date)) errors.balanceDueDate = "Choose the date the balance is due, or choose collection or delivery.";
    else if (isIsoDay(issueDate) && date < issueDate) errors.balanceDueDate = "The balance can't be due before the date of the quote.";
    else balance = { kind: "date", date };
  } else if (values.balanceDue !== undefined && values.balanceDue !== "handover") {
    errors.balanceDueDate = "Choose when the balance is due.";
  }

  if (Object.keys(errors).length > 0 || !amount) return { ok: false, errors };
  return { ok: true, deposit: { ...amount, balance } };
}

/**
 * The deposit and the balance for a total (cents, including VAT). `tooBig` is true when a fixed
 * deposit is more than the total, in which case the deposit shown is capped at the total and the
 * quote can't be sent until it is fixed.
 */
export function depositAmounts(
  grossCents: Cents,
  deposit: ParsedDeposit,
): { depositCents: Cents; balanceCents: Cents; tooBig: boolean } {
  const terms = deposit.kind === "percent" ? ({ kind: "percent", basisPoints: deposit.basisPoints } as const) : ({ kind: "fixed", cents: deposit.cents } as const);
  const { depositCents, balanceCents } = calculateDeposit(grossCents, terms);
  return { depositCents, balanceCents, tooBig: deposit.kind === "fixed" && deposit.cents > grossCents };
}

/** What the database stores for a parsed deposit (no deposit: none, balance on handover). */
export function depositColumns(deposit: ParsedDeposit | null) {
  if (!deposit) return { deposit_kind: "none", deposit_value: 0, balance_due: "handover", balance_due_date: null as string | null };
  return {
    deposit_kind: deposit.kind,
    deposit_value: deposit.kind === "percent" ? deposit.basisPoints : deposit.cents,
    balance_due: deposit.balance.kind,
    balance_due_date: deposit.balance.kind === "date" ? deposit.balance.date : null,
  };
}
