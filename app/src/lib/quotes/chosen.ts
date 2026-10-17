const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The ids of what was chosen on an item: its variation, and each list choice and extra (an extra's id is its option's
 * `valueId`). A quote's sent version keeps them so a job made from it takes the production steps that depend on them
 * (docs/plans/quantity-prices-and-steps.md, slice 4). Choices without an id are left out.
 */
export function chosenIdsOf(line: { variation: { id: string | null } | null; options: readonly { valueId: string | null }[] }): string[] {
  const ids = [line.variation?.id, ...line.options.map((o) => o.valueId)].filter((id): id is string => typeof id === "string" && UUID.test(id));
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}
