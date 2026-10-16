/**
 * Production steps (docs/plans/quantity-prices-and-steps.md, slices 2 and 3): the steps a product is made in, in order.
 * A step is a name. A job made from the product takes a frozen copy for each item and counts how many have been
 * through each step.
 */

export const STEPS_MAX = 30;
export const STEP_NAME_MAX = 120;

/** One row of the form while it is being filled in. */
export type StepFormRow = { key: string; name: string };

export type StepRowErrors = { name?: string };
export type StepErrors = { list?: string; rows: Record<string, StepRowErrors> };

function isRow(value: unknown): value is StepFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.name === "string";
}

/** Checks the rows, saying how to fix each problem at its row. The result keeps the order the maker put them in. */
export function parseSteps(rowsInput: unknown): { ok: true; steps: string[] } | { ok: false; errors: StepErrors } {
  if (!Array.isArray(rowsInput) || !rowsInput.every(isRow)) {
    return { ok: false, errors: { rows: {}, list: "The steps could not be read. Open the product again." } };
  }
  if (rowsInput.length > STEPS_MAX) {
    return { ok: false, errors: { rows: {}, list: `A product can have up to ${STEPS_MAX} steps.` } };
  }
  const errors: StepErrors = { rows: {} };
  const steps: string[] = [];
  for (const row of rowsInput) {
    const name = row.name.trim().replace(/\s+/g, " ");
    if (name === "") errors.rows[row.key] = { name: "Give the step a name, like “Bake”." };
    else if (name.length > STEP_NAME_MAX) errors.rows[row.key] = { name: `Keep the name to ${STEP_NAME_MAX} characters or fewer.` };
    else steps.push(name);
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
