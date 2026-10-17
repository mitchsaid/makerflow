import { formatMoney, parseMoney, type NumberStyle } from "../money";

/**
 * Money added to a price is always shown with what it makes (docs/ux-inputs.md, "An amount added to a price"): next to
 * the "+R50" a maker types, in smaller text, the price that gives. A variation's choices and the extras add to the
 * product's price, or to each variation's price, so the note names the variations when there are several.
 */

/** A price the added amount goes onto: the product's own (empty name), or one variation's. `price` is as typed. */
export type PriceBase = { key: string; name: string; price: string };

/**
 * "R320,00 in total" for one price, "Small R320,00 · Large R620,00" for several; null when nothing is typed to add,
 * or no price can be read. An amount typed as text that is not money gives no note (the field says what is wrong).
 * `only` limits it to one base (a choice priced by variation has one box for each).
 */
export function addedPriceNote(
  added: string,
  bases: readonly PriceBase[],
  currencyCode: string,
  style: NumberStyle,
  only?: string,
): string | null {
  if (added.trim() === "") return null;
  const amount = parseMoney(added);
  if (!amount.ok) return null;
  const shown = bases
    .filter((b) => only === undefined || b.key === only)
    .flatMap((b) => {
      const price = parseMoney(b.price);
      return price.ok ? [{ name: b.name, text: formatMoney(price.value + amount.value, currencyCode, style) }] : [];
    });
  if (shown.length === 0) return null;
  if (shown.length === 1 && (only !== undefined || shown[0].name === "")) return `${shown[0].text} in total`;
  return shown.map((s) => `${s.name} ${s.text}`).join(" · ");
}
