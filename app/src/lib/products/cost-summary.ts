import { itemCost, itemMargin, type CostCondition, type CostLine, type CostSettings, type ItemMargin } from "../costing";
import { lineNetCents, parseMoney, parseQuantity, type Cents, type VatSettings, type VatStatus } from "../money";
import type { UnitCode } from "../materials/units";
import { parseCosts, type CostFormRow } from "./costs";

/**
 * What the product form shows under the cost lines (docs/plans/costing-and-margin.md): what it costs to make one, what
 * it sells for without VAT, and the margin, for the product or for each variation. Worked out from the form as it is
 * typed, so it follows each keystroke; a line that is not finished yet is left out and said so.
 */

export type CostSummaryScope = {
  /** "" for the product's own price, else the variation's name. */
  name: string;
  /** Null when the price is not a number yet. */
  netPriceCents: Cents | null;
  margin: ItemMargin | null;
  /** Lines that are not finished (or cannot be costed): the cost is a minimum. */
  incomplete: boolean;
};

export type CostSummary = {
  scopes: CostSummaryScope[];
  /** Some lines depend on a choice in a list, an extra or a quantity, which the summary does not try. */
  leftOutConditions: boolean;
};

/**
 * `variations` are the named rows (key, name, price as typed); with none, `unitPrice` is the product's price.
 * `price` is as typed, in the business's VAT entry mode. A line "only for" a variation counts in that variation's
 * summary; lines for a list choice, an extra or a quantity are left out (`leftOutConditions`).
 */
export function summariseCosts(input: {
  rows: readonly CostFormRow[];
  makes: string;
  variations: readonly { key: string; name: string; price: string }[];
  unitPrice: string;
  vatStatus: VatStatus;
  vat: VatSettings;
  settings: CostSettings;
  materialUnits: ReadonlyMap<string, UnitCode>;
}): CostSummary {
  // A batch size that is not a number (yet) counts as one.
  const makes = parseQuantity(input.makes);
  const makesMilli = makes.ok && makes.value >= 1 ? makes.value : 1000;
  const lines: CostLine[] = [];
  let unfinished = false;
  let leftOut = false;
  for (const row of input.rows) {
    // The line itself is read the way saving reads it; its conditions are read here, by the keys of the form's rows.
    const parsed = parseCosts([{ ...row, conditions: [] }], input.makes, undefined, input.materialUnits);
    if (!parsed.ok || parsed.costs.lines.length !== 1) {
      unfinished = true;
      continue;
    }
    const l = parsed.costs.lines[0];
    const conditions: CostCondition[] = [];
    let conditionsOk = true;
    for (const c of row.conditions) {
      if (c.kind === "quantity") {
        const q = parseQuantity(c.quantity);
        if (!q.ok) conditionsOk = false;
        else conditions.push({ kind: "quantity", negate: c.negate, quantityMilli: q.value });
      } else if (c.ref === "") conditionsOk = false;
      else conditions.push({ kind: "chosen", negate: c.negate, id: c.ref });
    }
    if (!conditionsOk) {
      unfinished = true;
      continue;
    }
    // Lines that depend on a list choice, an extra or a quantity are left out (a "not" would count them wrongly).
    if (conditions.some((c) => c.kind === "quantity" || !c.id.startsWith("variation:"))) {
      leftOut = true;
      continue;
    }
    const base = { id: row.key, logic: row.logic, conditions };
    const line: CostLine =
      l.kind === "material"
        ? { ...base, kind: "material", materialId: l.materialId, amountMilli: l.amountMilli, unit: l.unit }
        : l.kind === "time"
          ? { ...base, kind: "time", minutes: l.minutes }
          : { ...base, kind: "other", name: l.name, cents: l.cents };
    lines.push(line);
  }

  const scopes = input.variations.length > 0 ? input.variations.map((v) => ({ key: v.key, name: v.name, price: v.price })) : [{ key: "", name: "", price: input.unitPrice }];
  const out: CostSummaryScope[] = scopes.map((scope) => {
    const price = parseMoney(scope.price);
    const net = price.ok ? lineNetCents({ amountCents: price.value, vatStatus: input.vatStatus }, input.vat) : null;
    // One of the item: the variation is the only choice made. Lines that depend on anything else do not hold here.
    const item = { quantityMilli: 1000, chosenIds: scope.key === "" ? [] : [`variation:${scope.key}`] };
    const cost = itemCost(lines, makesMilli, item, input.settings);
    // Nothing could be costed (a time line with no rate, say): no margin, never a free item.
    const applies = cost.lines.some((l) => l.cents !== null);
    const incomplete = unfinished || cost.problems.length > 0;
    return {
      name: scope.name,
      netPriceCents: net,
      margin: net === null ? null : itemMargin(net, { cents: cost.cents, hasCosts: applies || unfinished, incomplete }),
      incomplete,
    };
  });
  return { scopes: out, leftOutConditions: leftOut };
}

/**
 * What one of an extra costs, from its lines as typed ("Costs R12,50 each"); null when no line can be worked out yet.
 * Lines not finished yet are left out, and the cost is then "or more".
 */
export function extraCostOf(args: {
  rows: readonly CostFormRow[];
  settings: CostSettings;
  materialUnits: ReadonlyMap<string, UnitCode>;
}): { cents: number; incomplete: boolean } | null {
  const lines: CostLine[] = [];
  let unfinished = false;
  for (const row of args.rows) {
    const parsed = parseCosts([{ ...row, conditions: [], logic: "all" }], "1", undefined, args.materialUnits);
    if (!parsed.ok || parsed.costs.lines.length !== 1) {
      unfinished = true;
      continue;
    }
    const l = parsed.costs.lines[0];
    const base = { id: row.key, logic: "all" as const, conditions: [] };
    lines.push(
      l.kind === "material"
        ? { ...base, kind: "material", materialId: l.materialId, amountMilli: l.amountMilli, unit: l.unit }
        : l.kind === "time"
          ? { ...base, kind: "time", minutes: l.minutes }
          : { ...base, kind: "other", name: l.name, cents: l.cents },
    );
  }
  const cost = itemCost(lines, 1000, { quantityMilli: 1000, chosenIds: [] }, args.settings);
  if (!cost.lines.some((l) => l.cents !== null)) return null;
  return { cents: cost.cents, incomplete: unfinished || cost.problems.length > 0 };
}
