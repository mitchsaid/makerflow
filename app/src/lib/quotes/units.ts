import { formatQuantity, type NumberStyle, type QuantityMilli } from "../money";

/**
 * Units on quantities: "2 kg", "1 dozen", "3 hours". A unit is a short optional label the maker
 * types; these are only suggestions. Blank means a plain count.
 */
export const UNIT_SUGGESTIONS = [
  "each",
  "dozen",
  "kg",
  "g",
  "litre",
  "hour",
  "day",
  "metre",
  "box",
  "set",
  "pair",
  "portion",
] as const;

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
