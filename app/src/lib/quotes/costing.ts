import { itemMargin, type CostSettings } from "../costing";
import { lineNetCents, type Cents, type DocumentTotals, type QuantityMilli, type VatSettings } from "../money";
import type { ProductSummary } from "../products";
import { parsedLineCosting, type CostPart, type LineMargin } from "./margin";
import type { ParsedQuote } from "./index";

/**
 * What a quote cost to make when it was sent (docs/plans/costing-and-margin.md, slice B): the maker's private figures,
 * frozen with the version (quote_versions.costing) so a later change to a material's price or the hourly rate never
 * alters the margin of a quote that was sent. Deliberately NOT part of the snapshot: the snapshot is what the
 * customer's document is drawn from. Invoices and jobs made from this version carry these figures.
 */

export const COSTING_SCHEMA = 1;

export type FrozenCostItem = {
  name: string;
  productId: string | null;
  quantityMilli: QuantityMilli;
  /** What the item sold for without VAT, after discounts. */
  revenueCents: Cents;
  /** Null when the item had no costs to work from (it is named, and left out of the totals). */
  costCents: Cents | null;
  /** Some line could not be costed, so the cost is a minimum. */
  incomplete: boolean;
  parts: CostPart[];
};

export type FrozenCosting = {
  schema: typeof COSTING_SCHEMA;
  /** What the figures were worked out with. */
  hourlyRateCents: Cents | null;
  vatRateBp: number | null;
  items: FrozenCostItem[];
};

/**
 * Freezes the costing of a quote being sent. Null when no item has costs to work from (nothing is recorded then, and
 * the sent quote shows no margin).
 */
export function freezeCosting(args: {
  quote: ParsedQuote;
  vat: VatSettings;
  products: readonly ProductSummary[];
  settings: CostSettings;
  materialNames: ReadonlyMap<string, string>;
}): FrozenCosting | null {
  const { quote, vat, settings } = args;
  const totals: DocumentTotals = quote.totals;
  const items: FrozenCostItem[] = [];
  for (const line of quote.lines) {
    // Delivery and collection are not items that are made.
    if (line.kind === "delivery" || line.kind === "collection") continue;
    const costing = parsedLineCosting(line, totals, vat, args.products.find((p) => p.id === line.productId), settings, args.materialNames);
    if (!costing) continue;
    const m = costing.margin;
    items.push({
      name: line.name,
      productId: line.productId,
      quantityMilli: line.quantityMilli,
      revenueCents: m?.revenueCents ?? revenueOf(totals, line.key, vat),
      costCents: m?.costCents ?? null,
      incomplete: m?.incomplete ?? false,
      parts: costing.parts,
    });
  }
  if (!items.some((i) => i.costCents !== null)) return null;
  return { schema: COSTING_SCHEMA, hourlyRateCents: settings.hourlyRateCents, vatRateBp: settings.vatRateBp, items };
}

function revenueOf(totals: DocumentTotals, key: string, vat: VatSettings): Cents {
  const result = totals.lines.find((l) => l.id === key);
  return result ? lineNetCents(result, vat) : 0;
}

/** A stored costing as the rows the margin panel shows; anything that cannot be read is left out, never guessed. */
export function frozenMargins(stored: unknown): LineMargin[] | null {
  if (typeof stored !== "object" || stored === null) return null;
  const c = stored as Partial<FrozenCosting>;
  if (c.schema !== COSTING_SCHEMA || !Array.isArray(c.items)) return null;
  return c.items.flatMap((i, n): LineMargin[] => {
    if (typeof i?.name !== "string" || !Number.isSafeInteger(i.revenueCents)) return [];
    const cost = Number.isSafeInteger(i.costCents) ? (i.costCents as number) : null;
    return [
      {
        key: `frozen-${n}`,
        name: i.name,
        productId: typeof i.productId === "string" ? i.productId : null,
        margin: itemMargin(i.revenueCents, { cents: cost ?? 0, hasCosts: cost !== null, incomplete: i.incomplete === true }),
      },
    ];
  });
}
