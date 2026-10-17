import { isUnitCode, sameKind, type UnitCode } from "../materials/units";
import { MAX_CENTS, moneyToInput, parseMoney, parseQuantity, quantityToInput, type Cents, type NumberStyle, type QuantityMilli } from "../money";
import type { CostCondition, CostLine } from "../costing";
import {
  conditionsPayload,
  isCondition,
  NO_STEP_CHOICES,
  parseConditions,
  type ParsedStepCondition,
  type StepChoices,
  type StepConditionFormRow,
  type StepConditionSummary,
  type StepLogic,
} from "./steps";

/**
 * What it costs to make a product (docs/plans/costing-and-margin.md, slice A): a batch of cost lines (a material, the
 * maker's time, another cost), each always or only for some items (the same conditions as a production step), and how
 * many one batch makes. Nothing here works out a cost: lib/costing does that, in whole numbers.
 */

export const COST_LINES_MAX = 40;
export const COST_NAME_MAX = 120;
export const MAKES_MAX: QuantityMilli = 9_999_999_999;
export const MINUTES_MAX = 99_999;

export type CostKind = "material" | "time" | "other";
export type TimeUnit = "minutes" | "hours";

/**
 * One cost line on the form. Only the fields of its kind matter: `materialId`, `amount` (text) and `unit` for a
 * material; `time` (text) and `timeUnit` for the maker's time; `name` and `cost` (text, money) for another cost.
 */
export type CostFormRow = {
  key: string;
  kind: CostKind;
  logic: StepLogic;
  conditions: StepConditionFormRow[];
  materialId: string;
  amount: string;
  unit: string;
  time: string;
  timeUnit: TimeUnit;
  name: string;
  cost: string;
};

export type CostRowErrors = {
  materialId?: string;
  amount?: string;
  unit?: string;
  time?: string;
  name?: string;
  cost?: string;
  list?: string;
  conditions?: Record<string, { ref?: string; quantity?: string }>;
};
export type CostErrors = {
  list?: string;
  makes?: string;
  rows: Record<string, CostRowErrors>;
  /** Problems with an extra's own cost lines, by the extra's row key. */
  extras?: Record<string, { list?: string; rows: Record<string, CostRowErrors> }>;
};

export type ParsedCostLine = { logic: StepLogic; conditions: ParsedStepCondition[] } & (
  | { kind: "material"; materialId: string; amountMilli: QuantityMilli; unit: UnitCode }
  | { kind: "time"; minutes: number }
  | { kind: "other"; name: string; cents: Cents }
);

export type ParsedCosts = { makesMilli: QuantityMilli; lines: ParsedCostLine[] };

/** A saved cost line, as the product carries it. */
export type CostLineSummary = { id: string; logic: StepLogic; conditions: StepConditionSummary[] } & (
  | { kind: "material"; materialId: string; amountMilli: QuantityMilli; unit: UnitCode }
  | { kind: "time"; minutes: number }
  | { kind: "other"; name: string; cents: Cents }
);

/** What save_product_layers takes for the costs. */
export function costsPayload(costs: ParsedCosts) {
  return {
    makes_milli: costs.makesMilli,
    lines: costs.lines.map((l) => {
      const common = { logic: l.logic, conditions: conditionsPayload(l.conditions) };
      if (l.kind === "material") return { kind: "material", material_id: l.materialId, amount_milli: l.amountMilli, unit: l.unit, ...common };
      if (l.kind === "time") return { kind: "time", minutes: l.minutes, ...common };
      return { kind: "other", name: l.name, cents: l.cents, ...common };
    }),
  };
}

/** The condition of a saved line, as lib/costing reads it (by the id of the one choice it names). */
function costCondition(c: StepConditionSummary): CostCondition | null {
  if (c.kind === "quantity") return { kind: "quantity", negate: c.negate, quantityMilli: c.quantityMilli };
  const id = c.variationId ?? c.optionValueId ?? c.extraId;
  return id ? { kind: "chosen", negate: c.negate, id } : null;
}

/** A product's saved lines as lib/costing works with them. */
export function costLinesOf(lines: readonly CostLineSummary[]): CostLine[] {
  return lines.map((l): CostLine => {
    const conditions = l.conditions.flatMap((c) => costCondition(c) ?? []);
    const base = { id: l.id, logic: l.logic, conditions };
    if (l.kind === "material") return { ...base, kind: "material", materialId: l.materialId, amountMilli: l.amountMilli, unit: l.unit };
    if (l.kind === "time") return { ...base, kind: "time", minutes: l.minutes };
    return { ...base, kind: "other", name: l.name, cents: l.cents };
  });
}

function readRow(value: unknown): CostFormRow | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const strings = ["key", "materialId", "amount", "unit", "time", "name", "cost"] as const;
  if (!strings.every((k) => typeof v[k] === "string")) return null;
  if (v.kind !== "material" && v.kind !== "time" && v.kind !== "other") return null;
  if (v.logic !== "all" && v.logic !== "any") return null;
  if (v.timeUnit !== "minutes" && v.timeUnit !== "hours") return null;
  if (!Array.isArray(v.conditions) || !v.conditions.every(isCondition)) return null;
  return {
    key: v.key as string,
    kind: v.kind,
    logic: v.logic,
    conditions: v.conditions,
    materialId: v.materialId as string,
    amount: v.amount as string,
    unit: v.unit as string,
    time: v.time as string,
    timeUnit: v.timeUnit,
    name: v.name as string,
    cost: v.cost as string,
  };
}

/**
 * Checks the cost lines and the batch size, saying how to fix each problem at its line. `materials` are the units of
 * the business's materials by id: a material line's unit must measure the same kind of thing as the material.
 */
export function parseCosts(
  rowsInput: unknown,
  makesInput: unknown,
  choices: StepChoices = NO_STEP_CHOICES,
  materials: ReadonlyMap<string, UnitCode> = new Map(),
): { ok: true; costs: ParsedCosts } | { ok: false; errors: CostErrors } {
  const rows = Array.isArray(rowsInput) ? rowsInput.map(readRow) : null;
  if (rows === null || rows.some((r) => r === null)) {
    return { ok: false, errors: { rows: {}, list: "The costs could not be read. Open the product again." } };
  }
  const list = rows as CostFormRow[];
  const errors: CostErrors = { rows: {} };
  if (list.length > COST_LINES_MAX) {
    return { ok: false, errors: { rows: {}, list: `A product can have up to ${COST_LINES_MAX} cost lines.` } };
  }

  // Empty is one: most things make one at a time. With no lines the box is not on the screen, so it is not checked.
  const makesText = typeof makesInput === "string" ? makesInput : "";
  const makes = makesText.trim() === "" || list.length === 0 ? ({ ok: true, value: 1000 } as const) : parseQuantity(makesText);
  if (!makes.ok) errors.makes = makes.error;
  else if (makes.value < 1) errors.makes = "Enter how many one batch makes, like 12. Use 1 if you make one at a time.";
  else if (makes.value > MAKES_MAX) errors.makes = "That is too many.";

  const lines: ParsedCostLine[] = [];
  for (const row of list) {
    const e: CostRowErrors = {};
    const checked = parseConditions(row.conditions, choices, "cost");
    if (checked.list) e.list = checked.list;
    if (checked.errors) e.conditions = checked.errors;
    const base = { logic: row.logic, conditions: checked.conditions };
    let line: ParsedCostLine | null = null;

    if (row.kind === "material") {
      const materialUnit = materials.get(row.materialId);
      if (row.materialId === "") e.materialId = "Choose the material.";
      else if (materialUnit === undefined) e.materialId = "This material is not in your materials any more. Choose another.";
      const amount = parseQuantity(row.amount);
      if (!amount.ok) e.amount = row.amount.trim() === "" ? "Enter how much goes in, like 500." : amount.error;
      else if (amount.value < 1) e.amount = "Enter more than nothing.";
      if (!isUnitCode(row.unit)) e.unit = "Choose the unit.";
      else if (materialUnit !== undefined && !sameKind(row.unit, materialUnit)) {
        e.unit = "This unit measures something else than the material is bought by. Choose another.";
      }
      if (!e.materialId && !e.amount && !e.unit && amount.ok && isUnitCode(row.unit)) {
        line = { ...base, kind: "material", materialId: row.materialId, amountMilli: amount.value, unit: row.unit };
      }
    } else if (row.kind === "time") {
      const time = parseQuantity(row.time);
      if (!time.ok) e.time = row.time.trim() === "" ? "Enter how long it takes, like 30." : time.error;
      else {
        // Whole minutes: 1,5 hours is 90, a fraction of a minute is asked about, never rounded.
        const perUnit = row.timeUnit === "hours" ? 60 : 1;
        const minutesMilli = time.value * perUnit;
        if (minutesMilli % 1000 !== 0) e.time = "Use whole minutes, like 90, or hours like 1,5.";
        else if (minutesMilli < 1000) e.time = "Enter more than nothing.";
        else if (minutesMilli / 1000 > MINUTES_MAX) e.time = "That is too long.";
        else line = { ...base, kind: "time", minutes: minutesMilli / 1000 };
      }
    } else {
      const name = row.name.trim().replace(/\s+/g, " ");
      if (name === "") e.name = "Name the cost, like “Box”.";
      else if (name.length > COST_NAME_MAX) e.name = `Keep the name to ${COST_NAME_MAX} characters or fewer.`;
      const cost = parseMoney(row.cost);
      if (!cost.ok) e.cost = row.cost.trim() === "" ? "Enter what it costs. Use 0 if it is free." : cost.error;
      else if (cost.value > MAX_CENTS) e.cost = "That amount is too large.";
      if (!e.name && !e.cost && cost.ok) line = { ...base, kind: "other", name, cents: cost.value };
    }

    if (e.list || e.conditions || line === null) {
      errors.rows[row.key] = e;
    } else lines.push(line);
  }
  if (errors.makes !== undefined || Object.keys(errors.rows).length > 0) return { ok: false, errors };
  return { ok: true, costs: { makesMilli: (makes as { value: number }).value, lines } };
}

/** A blank cost line of a kind, for the form. */
export function blankCostRow(key: string, kind: CostKind): CostFormRow {
  return { key, kind, logic: "all", conditions: [], materialId: "", amount: "", unit: "", time: "", timeUnit: "minutes", name: "", cost: "" };
}

/** A saved line as the form holds it (a saved row's key is `key`); `conditions` are the form rows of its conditions. */
export function costRowFromSummary(l: CostLineSummary, key: string, style: NumberStyle, conditions: StepConditionFormRow[] = []): CostFormRow {
  const base = { ...blankCostRow(key, l.kind), logic: l.logic, conditions };
  if (l.kind === "material") return { ...base, materialId: l.materialId, amount: quantityToInput(l.amountMilli, style), unit: l.unit };
  if (l.kind === "time") {
    // Whole hours read better as hours.
    return l.minutes % 60 === 0
      ? { ...base, time: quantityToInput((l.minutes / 60) * 1000, style), timeUnit: "hours" }
      : { ...base, time: quantityToInput(l.minutes * 1000, style), timeUnit: "minutes" };
  }
  return { ...base, name: l.name, cost: moneyToInput(l.cents, style) };
}

/** What goes into one of an extra, as the form holds it while it is being filled in (`changed`: the maker touched it). */
export type ExtraCostsFormEntry = { key: string; changed: boolean; lines: CostFormRow[] };

export type ParsedExtraCosts = { index: number; lines: ParsedCostLine[] }[];

export const EXTRA_COST_LINES_MAX = 20;

export type ExtraCostsErrors = { list?: string; byExtra: NonNullable<CostErrors["extras"]> };

/**
 * Checks the cost lines of the extras the maker changed. `extraKeys` are the extras' form keys in the order they are
 * saved with the product: an extra is named to the database by its place in that list. An extra that was not changed
 * is left as it is (it may be shared with other products), so its lines are not even read.
 */
export function parseExtraCosts(
  input: unknown,
  extraKeys: readonly string[],
  materials: ReadonlyMap<string, UnitCode> = new Map(),
): { ok: true; extras: ParsedExtraCosts } | { ok: false; errors: ExtraCostsErrors } {
  if (!Array.isArray(input)) return { ok: false, errors: { list: "The extras' costs could not be read. Open the product again.", byExtra: {} } };
  const extras: ParsedExtraCosts = [];
  const errors: NonNullable<CostErrors["extras"]> = {};
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return { ok: false, errors: { list: "The extras' costs could not be read. Open the product again.", byExtra: {} } };
    const e = entry as Record<string, unknown>;
    if (typeof e.key !== "string" || typeof e.changed !== "boolean" || !Array.isArray(e.lines)) {
      return { ok: false, errors: { list: "The extras' costs could not be read. Open the product again.", byExtra: {} } };
    }
    if (!e.changed) continue;
    const index = extraKeys.indexOf(e.key);
    if (index < 0) continue;
    if (e.lines.length > EXTRA_COST_LINES_MAX) {
      errors[e.key] = { list: `An extra can have up to ${EXTRA_COST_LINES_MAX} cost lines.`, rows: {} };
      continue;
    }
    // An extra's lines have no conditions and no batch: they are for one of it.
    const parsed = parseCosts(e.lines.map((l) => (typeof l === "object" && l !== null ? { ...l, conditions: [], logic: "all" } : l)), "1", undefined, materials);
    if (parsed.ok) extras.push({ index, lines: parsed.costs.lines });
    else errors[e.key] = { list: parsed.errors.list, rows: parsed.errors.rows };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors: { byExtra: errors } };
  return { ok: true, extras };
}

/** What save_product_costs takes for the extras' lines. */
export function extraCostsPayload(extras: ParsedExtraCosts) {
  return extras.map((x) => ({ index: x.index, lines: costsPayload({ makesMilli: 1000, lines: x.lines }).lines }));
}
