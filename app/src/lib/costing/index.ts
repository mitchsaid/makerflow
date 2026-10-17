import { materialCostFraction, type Material } from "../materials";
import { isUnitCode, type UnitCode } from "../materials/units";
import { MAX_CENTS, type Cents, type QuantityMilli } from "../money";

/**
 * What it costs to make an item, and the margin on a quote (docs/plans/costing-and-margin.md). Costs are WITHOUT VAT
 * (a margin is worked out against what the item sells for without VAT) and are exact: every line is worked out as a
 * fraction of a cent from whole numbers and rounded once, half up. Nothing here is a float.
 */

/** "Only for some items": a choice made on the item (a variation, a list choice or an extra, by id), or a quantity. */
export type CostCondition =
  | { kind: "chosen"; negate: boolean; id: string }
  | { kind: "quantity"; negate: boolean; quantityMilli: QuantityMilli };

type LineBase = {
  id: string;
  /** With several conditions: every one must hold ("all") or at least one ("any"). No conditions: always. */
  logic: "all" | "any";
  conditions: readonly CostCondition[];
};

/** One line of what goes into making a batch. */
export type CostLine = LineBase &
  (
    | { kind: "material"; materialId: string; amountMilli: QuantityMilli; unit: UnitCode }
    /** Whole minutes of the maker's own time, at the business's hourly rate. */
    | { kind: "time"; minutes: number }
    | { kind: "other"; name: string; cents: Cents }
  );

/** What is known about the item when its cost is worked out. */
export type CostItem = {
  /** How many are being made or sold, in thousandths. */
  quantityMilli: QuantityMilli;
  /** The ids of the variation, list choices and extras chosen on it. */
  chosenIds: readonly string[];
};

/** The business facts costs are worked out with. */
export type CostSettings = {
  materials: ReadonlyMap<string, Pick<Material, "unit" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">>;
  /** What an hour of the maker's time is worth, or null when not set. */
  hourlyRateCents: Cents | null;
  /** The standard VAT rate when the business is VAT-registered (materials priced with VAT are taken without it), else null. */
  vatRateBp: number | null;
};

/** Does this line apply to this item? The same rules as the database's `product_step_applies`, for steps. */
export function lineApplies(line: LineBase, item: CostItem): boolean {
  if (line.conditions.length === 0) return true;
  const holds = line.conditions.map((c) => {
    const base = c.kind === "chosen" ? item.chosenIds.includes(c.id) : item.quantityMilli >= c.quantityMilli;
    return c.negate ? !base : base;
  });
  return line.logic === "any" ? holds.some(Boolean) : holds.every(Boolean);
}

export type CostedLine = {
  id: string;
  /** What it cost for this item, or null when it could not be worked out (see `Cost.problems`). */
  cents: Cents | null;
};

export type CostProblem =
  | { kind: "rate"; lineId: string }
  | { kind: "material"; lineId: string }
  | { kind: "units"; lineId: string }
  | { kind: "size"; lineId: string };

export type Cost = {
  /** The lines that apply to the item, each with what it cost. */
  lines: CostedLine[];
  /** The total of the lines that could be worked out. */
  cents: Cents;
  /** Lines that apply but could not be costed, so `cents` is less than the true cost. Empty when it is complete. */
  problems: CostProblem[];
};

const ROUND = (numerator: bigint, denominator: bigint): bigint => (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));

/**
 * What the item costs: the lines that apply, for `item.quantityMilli` of it, from a batch that makes `makesMilli`.
 * Each line is worked out as numerator/denominator of a cent for the whole batch, scaled by quantity ÷ makes, and
 * rounded once. A line that cannot be worked out (a time line with no hourly rate, a material that is gone, a unit of
 * another kind than the material's) is left out of the total and named in `problems`, never guessed.
 */
export function itemCost(lines: readonly CostLine[], makesMilli: QuantityMilli, item: CostItem, settings: CostSettings): Cost {
  const result: Cost = { lines: [], cents: 0, problems: [] };
  if (!(makesMilli > 0)) {
    return result;
  }
  let total = BigInt(0);
  for (const line of lines) {
    if (!lineApplies(line, item)) continue;
    let fraction: { numerator: bigint; denominator: bigint } | null = null;
    if (line.kind === "other") {
      fraction = { numerator: BigInt(line.cents), denominator: BigInt(1) };
    } else if (line.kind === "time") {
      if (settings.hourlyRateCents === null) result.problems.push({ kind: "rate", lineId: line.id });
      else fraction = { numerator: BigInt(line.minutes) * BigInt(settings.hourlyRateCents), denominator: BigInt(60) };
    } else {
      const material = settings.materials.get(line.materialId);
      if (!material) result.problems.push({ kind: "material", lineId: line.id });
      else if (!isUnitCode(line.unit)) result.problems.push({ kind: "units", lineId: line.id });
      else {
        fraction = materialCostFraction(line.amountMilli, line.unit, material, settings.vatRateBp);
        if (!fraction) result.problems.push({ kind: "units", lineId: line.id });
      }
    }
    if (!fraction) {
      result.lines.push({ id: line.id, cents: null });
      continue;
    }
    // For the quantity asked, from a batch that makes `makes`: batch cost × quantity ÷ makes (both in thousandths).
    const cents = ROUND(fraction.numerator * BigInt(item.quantityMilli), fraction.denominator * BigInt(makesMilli));
    if (cents > BigInt(MAX_CENTS)) {
      result.problems.push({ kind: "size", lineId: line.id });
      result.lines.push({ id: line.id, cents: null });
      continue;
    }
    result.lines.push({ id: line.id, cents: Number(cents) });
    total += cents;
  }
  result.cents = total > BigInt(MAX_CENTS) ? MAX_CENTS : Number(total);
  return result;
}

/** What one item brings in and costs, and what is left. */
export type ItemMargin = {
  /** What the item sells for without VAT, after its discounts. */
  revenueCents: Cents;
  /** Null when the item has no costs to work from (no cost lines, or a one-off item with no typed cost). */
  costCents: Cents | null;
  /** Revenue less cost, null when there is no cost. May be negative. */
  profitCents: Cents | null;
  /** Profit as a share of revenue in hundredths of a percent (basis points), null when there is no cost or no revenue. */
  marginBp: number | null;
  /** True when some line that applies could not be costed, so the cost is a minimum. */
  incomplete: boolean;
};

export function itemMargin(revenueCents: Cents, cost: { cents: Cents; hasCosts: boolean; incomplete: boolean }): ItemMargin {
  if (!cost.hasCosts) return { revenueCents, costCents: null, profitCents: null, marginBp: null, incomplete: false };
  const profitCents = revenueCents - cost.cents;
  return {
    revenueCents,
    costCents: cost.cents,
    profitCents,
    marginBp: marginBp(profitCents, revenueCents),
    incomplete: cost.incomplete,
  };
}

/** Profit ÷ revenue in basis points, rounded half away from zero; null when there is no revenue. */
export function marginBp(profitCents: Cents, revenueCents: Cents): number | null {
  if (revenueCents <= 0) return null;
  const numerator = BigInt(profitCents) * BigInt(10_000);
  const denominator = BigInt(revenueCents);
  const half = denominator / BigInt(2);
  const rounded = numerator >= BigInt(0) ? (numerator + half) / denominator : -((-numerator + half) / denominator);
  return Number(rounded);
}

/** A quote's margin: the items that have costs are counted, and how many do is said. */
export type QuoteMargin = {
  /** What all the items sell for without VAT (every item, costed or not). */
  revenueCents: Cents;
  /** Revenue of the costed items only, the base of `marginBp`. */
  costedRevenueCents: Cents;
  costCents: Cents;
  profitCents: Cents;
  marginBp: number | null;
  costedItems: number;
  totalItems: number;
  /** Any costed item whose cost is a minimum because some line could not be costed. */
  incomplete: boolean;
};

export function quoteMargin(items: readonly ItemMargin[]): QuoteMargin {
  const costed = items.filter((i) => i.costCents !== null);
  const costedRevenueCents = costed.reduce((sum, i) => sum + i.revenueCents, 0);
  const costCents = costed.reduce((sum, i) => sum + (i.costCents ?? 0), 0);
  const profitCents = costedRevenueCents - costCents;
  return {
    revenueCents: items.reduce((sum, i) => sum + i.revenueCents, 0),
    costedRevenueCents,
    costCents,
    profitCents,
    marginBp: marginBp(profitCents, costedRevenueCents),
    costedItems: costed.length,
    totalItems: items.length,
    incomplete: costed.some((i) => i.incomplete),
  };
}
