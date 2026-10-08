import { depositColumns, parseDeposit, type DepositErrors } from "./deposit";

/**
 * The two questions asked at the first New quote (docs/plans/quote-setup.md): do you usually ask for a
 * deposit, and do customers collect or do you deliver. The answers only set what a new quote starts with.
 */
export type UsualFulfilment = "collection" | "delivery";
export type SetupAnswers = {
  deposit: "no" | "yes";
  /** A percentage, typed the way the business types numbers. Only read when `deposit` is "yes". */
  depositPercent: string;
  /** "varies" changes nothing. */
  fulfilment: UsualFulfilment | "varies";
};

export function isUsualFulfilment(value: unknown): value is UsualFulfilment {
  return value === "collection" || value === "delivery";
}

export function isSetupAnswers(value: unknown): value is SetupAnswers {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.deposit === "no" || v.deposit === "yes") &&
    typeof v.depositPercent === "string" &&
    (v.fulfilment === "varies" || isUsualFulfilment(v.fulfilment))
  );
}

/** Checks the answers and says what to store, or what to fix. */
export function parseSetupAnswers(
  answers: SetupAnswers,
):
  | { ok: true; columns: { default_deposit_kind: string; default_deposit_value: number; usual_fulfilment: UsualFulfilment | null } }
  | { ok: false; errors: DepositErrors } {
  const parsed = parseDeposit(
    answers.deposit === "yes" ? { depositKind: "percent", depositValue: answers.depositPercent } : { depositKind: "none" },
    "",
  );
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  if (parsed.deposit?.kind === "percent" && parsed.deposit.basisPoints > 10_000) {
    return { ok: false, errors: { depositValue: "A deposit can't be more than 100%." } };
  }
  const columns = depositColumns(parsed.deposit);
  return {
    ok: true,
    columns: {
      default_deposit_kind: columns.deposit_kind,
      default_deposit_value: columns.deposit_value,
      usual_fulfilment: answers.fulfilment === "varies" ? null : answers.fulfilment,
    },
  };
}
