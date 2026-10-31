/**
 * What can be done to a quote from its card in a list (docs/plans/ux-pass-3.md), without opening it: delete a draft; turn
 * a sent quote into a job (the customer's yes is recorded in the same step, the usual way); make a job from an accepted
 * quote, or open the job it has. A quote with no customer cannot become a job. `liveJob` is undefined where the list did
 * not load the quote's jobs: then no job action is offered. Any quote, whatever its status, can be duplicated into a new
 * draft (docs/plans/duplicate.md); the job actions come first and the delete last.
 */
export type QuoteRowAction = "delete-draft" | "turn-into-job" | "create-job" | "open-job" | "duplicate";

export function quoteRowActions(q: { status: string; customerName: string | null; liveJob?: { id: string; number: number } | null }): QuoteRowAction[] {
  const actions: QuoteRowAction[] = [];
  const canMakeJob = q.customerName !== null && q.liveJob !== undefined;
  if (canMakeJob && q.liveJob === null && q.status === "sent") actions.push("turn-into-job");
  if (canMakeJob && q.status === "accepted") actions.push(q.liveJob ? "open-job" : "create-job");
  actions.push("duplicate");
  if (q.status === "draft") actions.push("delete-draft");
  return actions;
}
