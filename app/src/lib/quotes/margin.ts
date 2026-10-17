import { itemCost, itemMargin, type CostSettings, type ItemMargin } from "../costing";
import { costLinesOf } from "../products/costs";
import type { ProductSummary } from "../products";
import { lineNetCents, parseQuantity, type DocumentTotals, type VatSettings } from "../money";
import { chosenIdsOf } from "./chosen";
import { isBlankLine, type LineFormValues, type QuoteFormValues } from "./index";

/**
 * The private margin on a draft quote (docs/plans/costing-and-margin.md, slice A): for each item, what it sells for
 * without VAT (after its own discount and its share of the quote's) and what it costs to make, from the product's
 * cost lines for the quantity and choices on the item. Worked out from the form as it stands, so it follows every
 * change. Never part of a document: nothing here is read by the customer's quote, the PDF or the text of it.
 */

export type LineMargin = {
  key: string;
  name: string;
  productId: string | null;
  /** Null when the item has no costs to work from: no product, or a product none of whose cost lines apply to it. */
  margin: ItemMargin | null;
};

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
    const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
    const quantity = parseQuantity(line.quantity);
    if (!product || product.costLines.length === 0 || !quantity.ok) return [{ ...base, margin: null }];
    const revenue = lineNetCents(result, vat);
    const cost = itemCost(
      costLinesOf(product.costLines),
      product.makesMilli,
      { quantityMilli: quantity.value, chosenIds: chosenIdsOf({ variation: line.variationId ? { id: line.variationId } : null, options: line.options ?? [] }) },
      settings,
    );
    return [{ ...base, margin: itemMargin(revenue, { cents: cost.cents, hasCosts: cost.lines.length > 0, incomplete: cost.problems.length > 0 }) }];
  });
}
