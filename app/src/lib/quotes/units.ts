import type { BusinessType } from "../business-types";
import { formatQuantity, MAX_QUANTITY_MILLI, parseQuantity, quantityToInput, type NumberStyle, type QuantityMilli } from "../money";

/**
 * Units on quantities: "2 kg", "1 dozen", "3 hours". A unit is a short optional label the maker
 * types; these are only suggestions. Blank means a plain count.
 */
export const UNIT_SUGGESTIONS: readonly { unit: string; types?: readonly BusinessType[] }[] = [
  { unit: "each" },
  { unit: "dozen", types: ["food"] },
  { unit: "kg", types: ["food", "home_body"] },
  { unit: "g", types: ["food", "home_body"] },
  { unit: "litre", types: ["food", "home_body"] },
  { unit: "hour" },
  { unit: "day" },
  { unit: "metre", types: ["clothing", "craft"] },
  { unit: "box", types: ["food", "home_body"] },
  { unit: "set" },
  { unit: "pair", types: ["jewellery", "clothing"] },
  { unit: "portion", types: ["food"] },
  { unit: "tier", types: ["food"] },
  { unit: "bunch", types: ["flowers"] },
  { unit: "stem", types: ["flowers"] },
  { unit: "person", types: ["workshops"] },
  { unit: "sheet", types: ["art", "craft"] },
];

/**
 * "2 kg", or just "12" when there is no unit. By default a no-break space keeps the number with its
 * unit on a screen; the PDF's narrow column passes a plain space so a long one can wrap.
 */
export function quantityText(
  milli: QuantityMilli,
  unit: string | null | undefined,
  style: NumberStyle,
  space = "\u00a0",
): string {
  const number = formatQuantity(milli, style);
  return unit ? `${number}${space}${unit}` : number;
}

/**
 * One tap on plus or minus in a quantity box: up to the next whole unit, or down to the whole unit below, never below
 * `min` (a quantity is more than none). What is typed that cannot be read counts as none, so plus gives 1.
 */
export function stepQuantityText(text: string, direction: 1 | -1, style: NumberStyle, min: QuantityMilli = 1000): string {
  const parsed = parseQuantity(text);
  const current = parsed.ok ? parsed.value : 0;
  const next = direction === 1 ? (Math.floor(current / 1000) + 1) * 1000 : current % 1000 === 0 ? current - 1000 : Math.floor(current / 1000) * 1000;
  return quantityToInput(Math.min(MAX_QUANTITY_MILLI, Math.max(min, next)), style);
}
