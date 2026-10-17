import { parseQuantity, type QuantityMilli } from "../money";

/**
 * Production steps (docs/plans/quantity-prices-and-steps.md, slices 2 to 4): the steps a product is made in, in order.
 * A step is a name, and can be made only for some items (conditions below). A job made from the product takes a frozen
 * copy of the steps that apply to each item and counts how many have been through each.
 */

export const STEPS_MAX = 30;
export const STEP_NAME_MAX = 120;

export const STEP_CONDITIONS_MAX = 10;

/**
 * A condition on a step (docs/plans/quantity-prices-and-steps.md, slice 4): the step is made only for items where it
 * holds. "Chosen" points at a variation, a choice in a list, or an extra of the same product; "quantity" is a number
 * the item's quantity must reach. `negate` turns it round ("is not chosen", "less than"). A step with several
 * conditions takes all of them, or any of them.
 */
export type StepConditionKind = "chosen" | "quantity";
export type StepLogic = "all" | "any";

/**
 * One condition on the form. `ref` is "variation:KEY", "value:LISTKEY/VALUEKEY" or "extra:KEY" (keys of the rows on the
 * same form; a saved row's key is its id), or "" while nothing is chosen yet. `quantity` is the text typed.
 */
export type StepConditionFormRow = { key: string; kind: StepConditionKind; negate: boolean; ref: string; quantity: string };

/** One row of the form while it is being filled in. */
export type StepFormRow = { key: string; name: string; logic: StepLogic; conditions: StepConditionFormRow[] };

export type StepRowErrors = { name?: string; list?: string; conditions?: Record<string, { ref?: string; quantity?: string }> };
export type StepErrors = { list?: string; rows: Record<string, StepRowErrors> };

/** A choice as the database finds it: by position among the variations, lists (and their choices) and extras saved with the product. */
export type StepChoiceRef =
  | { type: "variation"; index: number }
  | { type: "option_value"; group: number; index: number }
  | { type: "extra"; index: number };

export type ParsedStepCondition =
  | { kind: "chosen"; negate: boolean; ref: StepChoiceRef }
  | { kind: "quantity"; negate: boolean; quantityMilli: QuantityMilli };

export type ParsedStep = { name: string; logic: StepLogic; conditions: ParsedStepCondition[] };

/** A saved condition: the id of the one variation, list choice or extra it names, or a quantity. */
export type StepConditionSummary =
  | { kind: "chosen"; negate: boolean; variationId: string | null; optionValueId: string | null; extraId: string | null }
  | { kind: "quantity"; negate: boolean; quantityMilli: QuantityMilli };

/** A saved step. */
export type StepSummary = { name: string; logic: StepLogic; conditions: StepConditionSummary[] };

/** What save_product_layers takes for the steps. */
export function stepsPayload(steps: readonly ParsedStep[]) {
  return steps.map((s) => ({
    name: s.name,
    logic: s.logic,
    conditions: s.conditions.map((c) =>
      c.kind === "quantity"
        ? { kind: "quantity", negate: c.negate, quantityMilli: c.quantityMilli }
        : { kind: "chosen", negate: c.negate, ref: c.ref },
    ),
  }));
}

/** The keys of the rows on the form that a condition may point at, in the order they are saved. */
export type StepChoices = {
  variations: readonly string[];
  lists: readonly { key: string; values: readonly string[] }[];
  extras: readonly string[];
};

export const NO_STEP_CHOICES: StepChoices = { variations: [], lists: [], extras: [] };

function isCondition(value: unknown): value is StepConditionFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    (v.kind === "chosen" || v.kind === "quantity") &&
    typeof v.negate === "boolean" &&
    typeof v.ref === "string" &&
    typeof v.quantity === "string"
  );
}

/** A row from a form that did not know about conditions has none, and takes all of them. */
function readRow(value: unknown): StepFormRow | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.key !== "string" || typeof v.name !== "string") return null;
  const conditions = v.conditions === undefined ? [] : v.conditions;
  const logic = v.logic === undefined ? "all" : v.logic;
  if (!Array.isArray(conditions) || !conditions.every(isCondition) || (logic !== "all" && logic !== "any")) return null;
  return { key: v.key, name: v.name, logic, conditions };
}

/** Where a condition's choice is among the rows saved with the product; null when the form no longer has it. */
export function locateChoice(ref: string, choices: StepChoices): StepChoiceRef | null {
  const at = ref.indexOf(":");
  if (at < 0) return null;
  const type = ref.slice(0, at);
  const rest = ref.slice(at + 1);
  if (type === "variation") {
    const index = choices.variations.indexOf(rest);
    return index < 0 ? null : { type: "variation", index };
  }
  if (type === "extra") {
    const index = choices.extras.indexOf(rest);
    return index < 0 ? null : { type: "extra", index };
  }
  if (type === "value") {
    const slash = rest.indexOf("/");
    if (slash < 0) return null;
    const group = choices.lists.findIndex((l) => l.key === rest.slice(0, slash));
    if (group < 0) return null;
    const index = choices.lists[group].values.indexOf(rest.slice(slash + 1));
    return index < 0 ? null : { type: "option_value", group, index };
  }
  return null;
}

/**
 * Checks the rows, saying how to fix each problem at its row. The result keeps the order the maker put them in.
 * `choices` are the rows of variations, lists and extras on the same form: a condition on one that has since been
 * removed is a problem at its row, never dropped quietly.
 */
export function parseSteps(
  rowsInput: unknown,
  choices: StepChoices = NO_STEP_CHOICES,
): { ok: true; steps: ParsedStep[] } | { ok: false; errors: StepErrors } {
  const rows = Array.isArray(rowsInput) ? rowsInput.map(readRow) : null;
  if (rows === null || rows.some((r) => r === null)) {
    return { ok: false, errors: { rows: {}, list: "The steps could not be read. Open the product again." } };
  }
  const list = rows as StepFormRow[];
  if (list.length > STEPS_MAX) {
    return { ok: false, errors: { rows: {}, list: `A product can have up to ${STEPS_MAX} steps.` } };
  }
  const errors: StepErrors = { rows: {} };
  const steps: ParsedStep[] = [];
  for (const row of list) {
    const rowErrors: StepRowErrors = {};
    const name = row.name.trim().replace(/\s+/g, " ");
    if (name === "") rowErrors.name = "Give the step a name, like “Bake”.";
    else if (name.length > STEP_NAME_MAX) rowErrors.name = `Keep the name to ${STEP_NAME_MAX} characters or fewer.`;

    if (row.conditions.length > STEP_CONDITIONS_MAX) {
      rowErrors.list = `A step can have up to ${STEP_CONDITIONS_MAX} conditions.`;
    }
    const conditions: ParsedStepCondition[] = [];
    const conditionErrors: NonNullable<StepRowErrors["conditions"]> = {};
    for (const c of row.conditions) {
      if (c.kind === "quantity") {
        const q = parseQuantity(c.quantity);
        if (!q.ok) conditionErrors[c.key] = { quantity: c.quantity.trim() === "" ? "Enter the quantity, like 12." : q.error };
        else conditions.push({ kind: "quantity", negate: c.negate, quantityMilli: q.value });
      } else if (c.ref === "") {
        conditionErrors[c.key] = { ref: "Choose what this step depends on." };
      } else {
        const ref = locateChoice(c.ref, choices);
        if (!ref) conditionErrors[c.key] = { ref: "This depends on a choice that was removed. Choose another, or remove this condition." };
        else conditions.push({ kind: "chosen", negate: c.negate, ref });
      }
    }
    if (Object.keys(conditionErrors).length > 0) rowErrors.conditions = conditionErrors;
    if (rowErrors.name || rowErrors.list || rowErrors.conditions) errors.rows[row.key] = rowErrors;
    else steps.push({ name, logic: row.logic, conditions });
  }
  if (Object.keys(errors.rows).length > 0) return { ok: false, errors };
  return { ok: true, steps };
}

/** Moves the row at `index` up (-1) or down (1). Out of range leaves the list as it is. */
export function moveStep<T>(rows: readonly T[], index: number, direction: -1 | 1): T[] {
  const to = index + direction;
  if (index < 0 || index >= rows.length || to < 0 || to >= rows.length) return [...rows];
  const next = [...rows];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
