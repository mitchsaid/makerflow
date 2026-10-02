import type { BasisPoints, Cents, QuantityMilli } from "./primitives";

/**
 * Display only. Calculations never use these numbers; formatting needs a decimal point,
 * and amounts here are far inside the range where dividing by 100 is exact enough to print.
 * The currency and the locale come from the business and its country's locale pack, never
 * from here (for South Africa: "ZAR" and "en-ZA").
 */

export function formatMoney(cents: Cents, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** 500 -> "0,5" in en-ZA, 2000 -> "2", 1250 -> "1,25": no trailing zeros. */
export function formatQuantity(milli: QuantityMilli, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(milli / 1000);
}

/** 1500 -> "15%", 1250 -> "12,5%" in en-ZA. */
export function formatPercent(basisPoints: BasisPoints, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(basisPoints / 100)}%`;
}
