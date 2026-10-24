import type { DiscountKind } from "./index";
import type { DepositKind } from "./deposit";

/**
 * An optional section the maker opened and left empty (a discount with no value, a deposit with no value) is not a
 * mistake to fix: it is the same as never having opened it. Before a save these are dropped, so Save is never refused
 * for a section nobody filled in. A section with something typed is kept, and checked as usual.
 *
 * Returns the same object when nothing was dropped. When the business asks about a deposit on every quote, the deposit
 * is an answer to a question, not an opened section, so it is kept (`dropDeposit: false`).
 */
export function withoutEmptyOptionals<T extends { discountKind: DiscountKind; discountValue: string; depositKind?: DepositKind; depositValue?: string }>(
  values: T,
  { dropDeposit = true }: { dropDeposit?: boolean } = {},
): T {
  const emptyDiscount = values.discountKind !== "none" && values.discountValue.trim() === "";
  const emptyDeposit = dropDeposit && values.depositKind !== undefined && values.depositKind !== "none" && (values.depositValue ?? "").trim() === "";
  if (!emptyDiscount && !emptyDeposit) return values;
  return {
    ...values,
    ...(emptyDiscount ? { discountKind: "none" as const, discountValue: "" } : {}),
    ...(emptyDeposit ? { depositKind: "none" as const, depositValue: "" } : {}),
  };
}
