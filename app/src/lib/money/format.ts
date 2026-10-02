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

/**
 * Text for an input box, so a saved value can be shown for editing and read back exactly by
 * the parsers in ./parse. No currency symbol and no thousands marks, with the locale's decimal
 * mark (a comma in en-ZA). Whole numbers have no decimals.
 */
function decimalMark(locale: string): string {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
}

function toInput(value: number, decimals: number, locale: string, minFraction: number): string {
  const scale = 10 ** decimals;
  const whole = Math.floor(value / scale);
  let fraction = String(value % scale).padStart(decimals, "0");
  while (fraction.length > minFraction && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  return fraction === "" ? String(whole) : `${whole}${decimalMark(locale)}${fraction}`;
}

/** 125050 -> "1250,50", 125000 -> "1250". */
export function moneyToInput(cents: Cents, locale: string): string {
  const text = toInput(cents, 2, locale, 0);
  return text.includes(decimalMark(locale)) && text.split(decimalMark(locale))[1]!.length === 1
    ? `${text}0`
    : text;
}

/**
 * 1500 -> "1,5", 2000 -> "2". A value with exactly three decimals and a whole part of 1 or
 * more (1,125) would read back as "1125 or 1,125?", so it gets a harmless trailing zero
 * ("1,1250"), which parseQuantity accepts.
 */
export function quantityToInput(milli: QuantityMilli, locale: string): string {
  const text = toInput(milli, 3, locale, 0);
  const [whole, fraction] = text.split(decimalMark(locale));
  return fraction !== undefined && fraction.length === 3 && whole !== "0"
    ? `${text}0`
    : text;
}

/** 1500 -> "15", 1250 -> "12,5". */
export function percentToInput(basisPoints: BasisPoints, locale: string): string {
  return toInput(basisPoints, 2, locale, 0);
}
