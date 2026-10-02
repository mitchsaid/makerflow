import type { BasisPoints, Cents, QuantityMilli } from "./primitives";

/**
 * Display only. Calculations never use these numbers; formatting needs a decimal point,
 * and amounts here are far inside the range where dividing by 100 is exact enough to print.
 */

const LOCALE = "en-ZA";

export function formatMoney(cents: Cents, currency = "ZAR"): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(cents / 100);
}

/** 500 -> "0,5", 2000 -> "2", 1250 -> "1,25" (the locale's decimal mark, no trailing zeros). */
export function formatQuantity(milli: QuantityMilli): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 }).format(milli / 1000);
}

/** 1500 -> "15%", 1250 -> "12,5%". */
export function formatPercent(basisPoints: BasisPoints): string {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}
