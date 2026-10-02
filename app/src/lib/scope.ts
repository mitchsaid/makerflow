/**
 * Row-level security shows a person every business they belong to; the screens work in one.
 * Queries that run beside the workspace load (to stay fast) can't filter by business yet, so
 * the page keeps only the current business's rows once both have arrived.
 */
export function forOrganisation<T extends { organisationId: string }>(
  rows: readonly T[],
  organisationId: string,
): T[] {
  return rows.filter((row) => row.organisationId === organisationId);
}
