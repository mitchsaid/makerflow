import { itemCost, itemMargin, type CostLine, type CostSettings, type ItemMargin } from "../costing";
import { costLinesOf } from "../products/costs";
import type { ProductSummary } from "../products";
import { lineNetCents, MAX_CENTS, parseMoney, parseQuantity, type Cents, type DocumentTotals, type QuantityMilli, type VatSettings } from "../money";
import { chosenIdsOf } from "./chosen";
import { isBlankLine, type LineFormValues, type ParsedLine, type QuoteFormValues } from "./index";

/**
 * The private margin on a quote (docs/plans/costing-and-margin.md): for each item, what it sells for without VAT
 * (after its own discount and its share of the quote's) and what it costs to make, from the product's cost lines for
 * the quantity and choices on the item, or from what a one-off item was said to cost. A draft shows it as it stands;
 * sending freezes it (lib/quotes/costing.ts). Never part of a document: nothing here is read by the customer's quote,
 * the PDF or the text of it.
 */

export type LineMargin = {
  key: string;
  name: string;
  productId: string | null;
  /** Null when the item has no costs to work from: no product (and no cost said), or a product none of whose cost lines apply to it. */
  margin: ItemMargin | null;
};

/** One part of what an item costs, for the breakdown that is frozen with a sent quote. */
export type CostPart = { label: string; cents: Cents | null };

export type ItemCosting = { margin: ItemMargin | null; parts: CostPart[] };

/** What the item the quote line describes costs, and what that is made of. */
export function costItem(args: {
  quantityMilli: QuantityMilli;
  chosenIds: readonly string[];
  /** What the item sells for without VAT, after discounts. */
  revenueCents: Cents;
  product: Pick<ProductSummary, "makesMilli" | "costLines"> | undefined;
  /** A one-off item's typed cost each. */
  unitCostCents: Cents | null;
  settings: CostSettings;
  /** Material names by id, for the labels. */
  materialNames?: ReadonlyMap<string, string>;
}): ItemCosting {
  const { product, settings } = args;
  if (product && product.costLines.length > 0) {
    const lines: CostLine[] = costLinesOf(product.costLines);
    const cost = itemCost(lines, product.makesMilli, { quantityMilli: args.quantityMilli, chosenIds: args.chosenIds }, settings);
    const labelOf = (l: CostLine): string =>
      l.kind === "material" ? (args.materialNames?.get(l.materialId) ?? "Material") : l.kind === "time" ? "Your time" : l.name;
    const parts = cost.lines.map((c) => ({ label: labelOf(lines.find((l) => l.id === c.id)!), cents: c.cents }));
    return {
      margin: itemMargin(args.revenueCents, { cents: cost.cents, hasCosts: cost.lines.some((l) => l.cents !== null), incomplete: cost.problems.length > 0 }),
      parts,
    };
  }
  if (!product && args.unitCostCents !== null) {
    // Each, times how many (quantity is in thousandths), rounded once, in whole numbers. More than money can hold is no
    // cost at all (the form refuses it), never a wrong number.
    const exact = (BigInt(args.unitCostCents) * BigInt(args.quantityMilli) * BigInt(2) + BigInt(1000)) / BigInt(2000);
    if (exact > BigInt(MAX_CENTS)) return { margin: null, parts: [] };
    const cents = Number(exact);
    return { margin: itemMargin(args.revenueCents, { cents, hasCosts: true, incomplete: false }), parts: [{ label: "Cost you gave", cents }] };
  }
  return { margin: null, parts: [] };
}

export function lineMargins(
  values: QuoteFormValues,
  totals: DocumentTotals | null,
  vat: VatSettings,
  products: readonly ProductSummary[],
  settings: CostSettings,
): LineMargin[] {
  if (!totals) return [];
  return values.lines.flatMap((line: LineFormValues): LineMargin[] => {
    if (isBlankLine(line)) return [];
    const result = totals.lines.find((l) => l.id === line.key);
    // Not worked out yet (the quantity or price is not a number): left out until it is.
    if (!result) return [];
    const base = { key: line.key, name: line.name.trim() || "Item", productId: line.productId || null };
    const quantity = parseQuantity(line.quantity);
    if (!quantity.ok) return [{ ...base, margin: null }];
    const typed = !line.productId && (line.unitCost ?? "").trim() !== "" ? parseMoney(line.unitCost ?? "") : null;
    const { margin } = costItem({
      quantityMilli: quantity.value,
      chosenIds: chosenIdsOf({ variation: line.variationId ? { id: line.variationId } : null, options: line.options ?? [] }),
      revenueCents: lineNetCents(result, vat),
      product: line.productId ? products.find((p) => p.id === line.productId) : undefined,
      unitCostCents: typed && typed.ok ? typed.value : null,
      settings,
    });
    return [{ ...base, margin }];
  });
}

/** The same, for a quote that has been parsed (the server, when it freezes a quote being sent). */
export function parsedLineCosting(
  line: ParsedLine,
  totals: DocumentTotals,
  vat: VatSettings,
  product: ProductSummary | undefined,
  settings: CostSettings,
  materialNames: ReadonlyMap<string, string>,
): ItemCosting | null {
  const result = totals.lines.find((l) => l.id === line.key);
  if (!result) return null;
  return costItem({
    quantityMilli: line.quantityMilli,
    chosenIds: chosenIdsOf({ variation: line.variation, options: line.options }),
    revenueCents: lineNetCents(result, vat),
    product: line.productId ? product : undefined,
    unitCostCents: line.productId ? null : (line.unitCostCents ?? null),
    settings,
    materialNames,
  });
}
