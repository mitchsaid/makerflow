import type { BusinessType } from "../business-types";
import { formatQuantity, type NumberStyle, type QuantityMilli } from "../money";

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
