import type { BasisPoints, Cents, QuantityMilli } from "./primitives";

/**
 * Text for money, quantities and percentages. Everything here is plain integer and string
 * work, driven by a NumberStyle from the country's locale pack, and deliberately does NOT use
 * the browser's or Node's Intl: the server and the browser carry different locale data, so
 * the same amount came out as "R 1 250,50" on one and "R 1,250.50" on the other, and React
 * refused to hydrate the page. The same style always gives the same text everywhere.
 *
 * Display only. Calculations never use these strings.
 */

export type NumberStyle = {
  /** "," for South Africa */
  decimalMark: string;
  /** Between groups of three digits: a no-break space for South Africa; "" for none */
  groupSeparator: string;
  /** Symbols for the currencies this country shows, by ISO code ({ ZAR: "R" }); others show their code */
  currencySymbols: Record<string, string>;
  /** Between the symbol and the number: a no-break space for South Africa ("R 1 250,50"), "" for "£1" */
  symbolSpace: string;
};

function group(digits: string, separator: string): string {
  if (separator === "") return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** value / 10^decimals as text: grouped whole part, then the decimals (trimmed to `minFraction`). */
function scaledText(
  value: number,
  decimals: number,
  style: NumberStyle,
  minFraction: number,
  grouped: boolean,
): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  const scale = 10 ** decimals;
  const whole = String(Math.floor(abs / scale));
  let fraction = String(abs % scale).padStart(decimals, "0");
  while (fraction.length > minFraction && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  const wholeText = grouped ? group(whole, style.groupSeparator) : whole;
  const text = fraction === "" ? wholeText : `${wholeText}${style.decimalMark}${fraction}`;
  return negative ? `−${text}` : text;
}

/** 125050, "ZAR" -> "R 1 250,50" (South Africa). Always two decimals. */
export function formatMoney(cents: Cents, currencyCode: string, style: NumberStyle): string {
  const symbol = style.currencySymbols[currencyCode];
  const number = scaledText(Math.abs(cents), 2, style, 2, true);
  const body = symbol === undefined ? `${currencyCode}${style.symbolSpace || " "}${number}` : `${symbol}${style.symbolSpace}${number}`;
  return cents < 0 ? `−${body}` : body;
}

/** 500 -> "0,5", 2000 -> "2", 1250 -> "1,25": no trailing zeros. */
export function formatQuantity(milli: QuantityMilli, style: NumberStyle): string {
  return scaledText(milli, 3, style, 0, true);
}

/** 1500 -> "15%", 1250 -> "12,5%". */
export function formatPercent(basisPoints: BasisPoints, style: NumberStyle): string {
  return `${scaledText(basisPoints, 2, style, 0, false)}%`;
}

/**
 * Text for an input box, so a saved value can be shown for editing and read back exactly by
 * the parsers in ./parse. No currency symbol and no thousands marks, with the style's decimal
 * mark. Whole numbers have no decimals.
 */

/** 125050 -> "1250,50", 125000 -> "1250", 1250 -> "12,50". */
export function moneyToInput(cents: Cents, style: NumberStyle): string {
  const text = scaledText(cents, 2, style, 0, false);
  const [, fraction] = text.split(style.decimalMark);
  return fraction !== undefined && fraction.length === 1 ? `${text}0` : text;
}

/**
 * 1500 -> "1,5", 2000 -> "2". A value with exactly three decimals and a whole part of 1 or
 * more (1,125) would read back as "1125 or 1,125?", so it gets a harmless trailing zero
 * ("1,1250"), which parseQuantity accepts.
 */
export function quantityToInput(milli: QuantityMilli, style: NumberStyle): string {
  const text = scaledText(milli, 3, style, 0, false);
  const [whole, fraction] = text.split(style.decimalMark);
  return fraction !== undefined && fraction.length === 3 && whole !== "0" ? `${text}0` : text;
}

/** 1500 -> "15", 1250 -> "12,5". */
export function percentToInput(basisPoints: BasisPoints, style: NumberStyle): string {
  return scaledText(basisPoints, 2, style, 0, false);
}
