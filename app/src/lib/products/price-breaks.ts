import {
  formatPercent,
  parseMoney,
  parsePercent,
  parseQuantity,
  type BasisPoints,
  type Cents,
  type NumberStyle,
  type QuantityMilli,
} from "../money";
import { quantityText } from "../quotes/units";

/**
 * Quantity prices (docs/plans/quantity-prices-and-steps.md): "from this quantity, this much off" the item's price
 * (the product's own, or the chosen variation's: each variation has its own rows). The maker takes off a percent or
 * an amount; options and extras are not reduced. On a quote the price each follows the quantity until the maker types
 * their own; nothing is recomputed on the server, because a quote line keeps the price it was given.
 */

/** At most this many for each price (the product's, or one variation's). */
export const PRICE_BREAKS_MAX = 10;

/** What is taken off: a percent (hundredths of a percent) or an amount (cents, in the price entry mode). */
export type PriceOff = { kind: "percent"; bp: BasisPoints } | { kind: "amount"; cents: Cents };

/** A saved row: the variation whose price it lowers (null for a product with one price), from this quantity (thousandths), this much off. */
export type PriceBreak = { variationId: string | null; fromMilli: QuantityMilli; off: PriceOff };

/** One row of the form while it is being filled in. `variationKey` is the variation row's key, "" for the product's own price. */
export type PriceBreakFormRow = { key: string; variationKey: string; from: string; kind: "percent" | "amount"; value: string };

export type PriceBreakRowErrors = { from?: string; value?: string };
export type PriceBreakErrors = { list?: string; rows: Record<string, PriceBreakRowErrors> };

/** A checked row, ready to save: the variation is its place among the variations saved with the product. */
export type ParsedPriceBreak = { variationIndex: number | null; fromMilli: QuantityMilli; off: PriceOff };

function isRow(value: unknown): value is PriceBreakFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.variationKey === "string" &&
    typeof v.from === "string" &&
    (v.kind === "percent" || v.kind === "amount") &&
    typeof v.value === "string"
  );
}

/** A form from before amounts and variations: a quantity and a percent for the product's own price. */
function readRow(value: unknown): PriceBreakFormRow | null {
  if (isRow(value)) return value;
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.key === "string" && typeof v.from === "string" && typeof v.percent === "string" && v.variationKey === undefined && v.kind === undefined) {
    return { key: v.key, variationKey: "", from: v.from, kind: "percent", value: v.percent };
  }
  return null;
}

/**
 * The quantity prices follow the price between the product's one price and its variations (as `carryPrice` does for
 * the price itself), so nothing typed is lost: when variations start, the product's rows go to the first variation, and
 * when the last is removed the first variation's rows go back to the product. Rows of other variations are kept
 * (they come back with the variation) and are not sent while their variation is not there.
 */
export function carryPriceBreaks(
  rows: readonly PriceBreakFormRow[],
  before: readonly { key: string }[],
  after: readonly { key: string }[],
): PriceBreakFormRow[] {
  if (before.length === 0 && after.length > 0) return rows.map((r) => (r.variationKey === "" ? { ...r, variationKey: after[0].key } : r));
  if (before.length > 0 && after.length === 0) return rows.map((r) => (r.variationKey === before[0].key ? { ...r, variationKey: "" } : r));
  return [...rows];
}

/** The rows that go with the form when it is saved: the product's own when it has one price, else those of the variations it has. */
export function sentPriceBreaks(rows: readonly PriceBreakFormRow[], variations: readonly { key: string }[]): PriceBreakFormRow[] {
  const keys = new Set(variations.map((v) => v.key));
  return rows.filter((r) => (variations.length === 0 ? r.variationKey === "" : keys.has(r.variationKey)));
}

/** The prices the rows can be taken from, so an amount can be checked: the product's own, and each variation's (by place). */
export type PriceBreakBases = { single: Cents | undefined; variations: readonly (Cents | undefined)[] };

/**
 * Checks the rows, saying how to fix each problem at its row. `variationKeys` are the variation rows on the same form
 * in the order they are saved: a row for a variation that is no longer there is a problem at its row, never dropped.
 * The result is in order of quantity within each price.
 */
export function parsePriceBreaks(
  rowsInput: unknown,
  variationKeys: readonly string[] = [],
  bases: PriceBreakBases = { single: undefined, variations: [] },
): { ok: true; breaks: ParsedPriceBreak[] } | { ok: false; errors: PriceBreakErrors } {
  const rows = Array.isArray(rowsInput) ? rowsInput.map(readRow) : null;
  if (rows === null || rows.some((r) => r === null)) {
    return { ok: false, errors: { rows: {}, list: "The quantity prices could not be read. Open the product again." } };
  }
  const list = rows as PriceBreakFormRow[];
  const errors: PriceBreakErrors = { rows: {} };
  const breaks: { key: string; brk: ParsedPriceBreak }[] = [];
  for (const row of list) {
    const rowErrors: PriceBreakRowErrors = {};
    let variationIndex: number | null = null;
    if (row.variationKey !== "") {
      variationIndex = variationKeys.indexOf(row.variationKey);
      if (variationIndex < 0) {
        rowErrors.from = "This is for a variation that was removed. Remove this row.";
        variationIndex = null;
      }
    } else if (variationKeys.length > 0) {
      rowErrors.from = "Set quantity prices on a variation. Remove this row.";
    }
    const from = parseQuantity(row.from);
    if (!from.ok) rowErrors.from ??= row.from.trim() === "" ? "Enter the quantity this price starts at, like 10." : from.error;
    const base = row.variationKey === "" ? bases.single : variationIndex === null ? undefined : bases.variations[variationIndex];
    let off: PriceOff | null = null;
    if (row.kind === "percent") {
      const percent = parsePercent(row.value);
      if (!percent.ok) rowErrors.value = row.value.trim() === "" ? "Enter how much is taken off, like 10." : percent.error;
      else if (percent.value === 0 || percent.value >= 10_000) rowErrors.value = "Enter a percentage above 0 and below 100.";
      else off = { kind: "percent", bp: percent.value };
    } else {
      const amount = parseMoney(row.value);
      if (!amount.ok) rowErrors.value = row.value.trim() === "" ? "Enter how much is taken off, like 20." : amount.error;
      else if (amount.value === 0) rowErrors.value = "Enter an amount above 0.";
      else if (base !== undefined && amount.value >= base) rowErrors.value = "Take off less than the price.";
      else off = { kind: "amount", cents: amount.value };
    }
    if (rowErrors.from || rowErrors.value) errors.rows[row.key] = { ...errors.rows[row.key], ...rowErrors };
    else if (from.ok && off) breaks.push({ key: row.key, brk: { variationIndex, fromMilli: from.value, off } });
  }
  // Each quantity once for each price, and no more than the most: the later row says so.
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const { key, brk } of breaks) {
    const scope = String(brk.variationIndex);
    const id = `${scope}:${brk.fromMilli}`;
    if (seen.has(id)) errors.rows[key] = { ...errors.rows[key], from: "Another row starts at this quantity. Change one of them." };
    seen.add(id);
    const n = (counts.get(scope) ?? 0) + 1;
    counts.set(scope, n);
    if (n > PRICE_BREAKS_MAX) errors.list = `A price can have up to ${PRICE_BREAKS_MAX} quantity prices.`;
  }
  if (Object.keys(errors.rows).length > 0 || errors.list) return { ok: false, errors };
  return {
    ok: true,
    breaks: breaks
      .map((b) => b.brk)
      .sort((a, b) => (a.variationIndex ?? -1) - (b.variationIndex ?? -1) || a.fromMilli - b.fromMilli),
  };
}

/** What save_product_layers takes for the quantity prices. */
export function priceBreaksPayload(breaks: readonly ParsedPriceBreak[]) {
  return breaks.map((b) => ({
    from_quantity_milli: b.fromMilli,
    ...(b.off.kind === "percent" ? { percent_off_bp: b.off.bp } : { amount_off_cents: b.off.cents }),
    variation: b.variationIndex,
  }));
}

/** The rows for one price: a variation's by its id, or the product's own (null). */
export function breaksFor(breaks: readonly PriceBreak[], variationId: string | null): PriceBreak[] {
  return breaks.filter((b) => b.variationId === variationId);
}

/** The row that applies to this quantity: the one with the largest start that the quantity has reached. */
export function breakAt<T extends { fromMilli: QuantityMilli }>(breaks: readonly T[], quantityMilli: QuantityMilli): T | null {
  let found: T | null = null;
  for (const b of breaks) {
    if (quantityMilli >= b.fromMilli && (found === null || b.fromMilli > found.fromMilli)) found = b;
  }
  return found;
}

/**
 * The price after taking something off. A percent is worked out with whole numbers and rounded once to the cent
 * (half up); an amount is subtracted. Never below nothing.
 */
export function priceAfter(baseCents: Cents, off: PriceOff): Cents {
  if (off.kind === "amount") return Math.max(0, baseCents - off.cents);
  return Math.floor((baseCents * (10_000 - off.bp) + 5_000) / 10_000);
}

/**
 * The price each at this quantity: the base price less the row that applies. With no row reached, the base price as
 * it is. The rows are those of the one price (see breaksFor).
 */
export function quantityPrice(
  baseCents: Cents,
  breaks: readonly PriceBreak[],
  quantityMilli: QuantityMilli,
): { cents: Cents; applied: PriceBreak | null } {
  const applied = breakAt(breaks, quantityMilli);
  if (!applied) return { cents: baseCents, applied: null };
  return { cents: priceAfter(baseCents, applied.off), applied };
}

/** "10 dozen or more: 10% off" or "10 or more: R20,00 off". */
export function priceBreakText(
  brk: Pick<PriceBreak, "fromMilli" | "off">,
  unit: string | null | undefined,
  style: NumberStyle,
  money: (cents: Cents) => string,
): string {
  const offText = brk.off.kind === "percent" ? formatPercent(brk.off.bp, style) : money(brk.off.cents);
  return `${quantityText(brk.fromMilli, unit, style, " ")} or more: ${offText} off`;
}

/**
 * What a product asks for one item at this quantity: its variation's price (or its own when it has no variations),
 * less the quantity price that applies to that price. Undefined when the product has variations and none is chosen
 * (there is no price to start from). The quantity is the text typed in the quantity box; an unreadable one counts as 1.
 */
export function referencePrice(
  product: {
    unitPriceCents: Cents;
    variations: readonly { id: string; priceCents: Cents }[];
    priceBreaks: readonly PriceBreak[];
  },
  variationId: string | undefined,
  quantityText: string,
): { cents: Cents; applied: PriceBreak | null } | undefined {
  const variation = product.variations.length > 0 ? product.variations.find((v) => v.id === variationId) : undefined;
  const base = product.variations.length > 0 ? variation?.priceCents : product.unitPriceCents;
  if (base === undefined) return undefined;
  const quantity = parseQuantity(quantityText);
  return quantityPrice(base, breaksFor(product.priceBreaks, variation?.id ?? null), quantity.ok ? quantity.value : 1_000);
}
