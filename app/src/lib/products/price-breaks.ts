import { formatPercent, parsePercent, parseQuantity, type BasisPoints, type Cents, type NumberStyle, type QuantityMilli } from "../money";
import { quantityText } from "../quotes/units";

/**
 * Quantity prices (docs/plans/quantity-prices-and-steps.md, slice 1): "from this quantity, this percent off" the item's
 * own price (the product's, or the chosen variation's). Options and extras are not reduced. On a quote the price each
 * follows the quantity until the maker types their own; nothing is recomputed on the server, because a quote line keeps
 * the price it was given.
 */

export const PRICE_BREAKS_MAX = 10;

/** A saved row: from this quantity (thousandths), this percent off (hundredths of a percent). */
export type PriceBreak = { fromMilli: QuantityMilli; percentBp: BasisPoints };

/** One row of the form while it is being filled in. */
export type PriceBreakFormRow = { key: string; from: string; percent: string };

export type PriceBreakRowErrors = { from?: string; percent?: string };
export type PriceBreakErrors = { list?: string; rows: Record<string, PriceBreakRowErrors> };

function isRow(value: unknown): value is PriceBreakFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.from === "string" && typeof v.percent === "string";
}

/** Checks the rows, saying how to fix each problem at its row. The result is in order of quantity. */
export function parsePriceBreaks(
  rowsInput: unknown,
): { ok: true; breaks: PriceBreak[] } | { ok: false; errors: PriceBreakErrors } {
  if (!Array.isArray(rowsInput) || !rowsInput.every(isRow)) {
    return { ok: false, errors: { rows: {}, list: "The quantity prices could not be read. Open the product again." } };
  }
  if (rowsInput.length > PRICE_BREAKS_MAX) {
    return { ok: false, errors: { rows: {}, list: `A product can have up to ${PRICE_BREAKS_MAX} quantity prices.` } };
  }
  const errors: PriceBreakErrors = { rows: {} };
  const breaks: { key: string; brk: PriceBreak }[] = [];
  for (const row of rowsInput) {
    const rowErrors: PriceBreakRowErrors = {};
    const from = parseQuantity(row.from);
    if (!from.ok) rowErrors.from = row.from.trim() === "" ? "Enter the quantity this price starts at, like 10." : from.error;
    const percent = parsePercent(row.percent);
    if (!percent.ok) rowErrors.percent = row.percent.trim() === "" ? "Enter how much is taken off, like 10." : percent.error;
    else if (percent.value === 0 || percent.value >= 10_000) rowErrors.percent = "Enter a percentage above 0 and below 100.";
    if (rowErrors.from || rowErrors.percent) errors.rows[row.key] = rowErrors;
    else if (from.ok && percent.ok) breaks.push({ key: row.key, brk: { fromMilli: from.value, percentBp: percent.value } });
  }
  // Each quantity once: the later row says so.
  const seen = new Set<number>();
  for (const { key, brk } of breaks) {
    if (seen.has(brk.fromMilli)) errors.rows[key] = { ...errors.rows[key], from: "Another row starts at this quantity. Change one of them." };
    seen.add(brk.fromMilli);
  }
  if (Object.keys(errors.rows).length > 0) return { ok: false, errors };
  return { ok: true, breaks: breaks.map((b) => b.brk).sort((a, b) => a.fromMilli - b.fromMilli) };
}

/** The row that applies to this quantity: the one with the largest start that the quantity has reached. */
export function breakAt(breaks: readonly PriceBreak[], quantityMilli: QuantityMilli): PriceBreak | null {
  let found: PriceBreak | null = null;
  for (const b of breaks) {
    if (quantityMilli >= b.fromMilli && (found === null || b.fromMilli > found.fromMilli)) found = b;
  }
  return found;
}

/**
 * The price each at this quantity: the base price less the row's percent, rounded once to the cent (half up) with
 * whole-number arithmetic. With no row reached, the base price as it is.
 */
export function quantityPrice(
  baseCents: Cents,
  breaks: readonly PriceBreak[],
  quantityMilli: QuantityMilli,
): { cents: Cents; applied: PriceBreak | null } {
  const applied = breakAt(breaks, quantityMilli);
  if (!applied) return { cents: baseCents, applied: null };
  return { cents: Math.floor((baseCents * (10_000 - applied.percentBp) + 5_000) / 10_000), applied };
}

/** "10 dozen or more: 10% off". */
export function priceBreakText(brk: PriceBreak, unit: string | null | undefined, style: NumberStyle): string {
  return `${quantityText(brk.fromMilli, unit, style, " ")} or more: ${formatPercent(brk.percentBp, style)} off`;
}

/**
 * What a product asks for one item at this quantity: its variation's price (or its own when it has no variations),
 * less the quantity price that applies. Undefined when the product has variations and none is chosen (there is no
 * price to start from). The quantity is the text typed in the quantity box; an unreadable one counts as 1.
 */
export function referencePrice(
  product: { unitPriceCents: Cents; variations: readonly { id: string; priceCents: Cents }[]; priceBreaks: readonly PriceBreak[] },
  variationId: string | undefined,
  quantityText: string,
): { cents: Cents; applied: PriceBreak | null } | undefined {
  const base =
    product.variations.length > 0 ? product.variations.find((v) => v.id === variationId)?.priceCents : product.unitPriceCents;
  if (base === undefined) return undefined;
  const quantity = parseQuantity(quantityText);
  return quantityPrice(base, product.priceBreaks, quantity.ok ? quantity.value : 1_000);
}
