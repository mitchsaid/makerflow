/**
 * Jobs (docs/plans/jobs-and-invoices.md, part 1): an accepted quote becomes a job to make, then collect or deliver.
 * The statuses and the moves between them are written down here (and enforced by the database, which has the same
 * list: migration 20261028100000_jobs.sql).
 */

import { formatQuantity, parseQuantity, type NumberStyle, type QuantityMilli } from "../money";
import type { ValidationResult } from "../validation";

export const JOB_STATUSES = ["not_started", "in_progress", "ready", "out_for_delivery", "done", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobFulfilment = "none" | "collection" | "delivery";

export const isJobStatus = (value: unknown): value is JobStatus =>
  typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);

/** "J-0007": a job's number as the maker sees it. */
export const jobNumberText = (number: number): string => `J-${String(number).padStart(4, "0")}`;

/** What a status is called. "Ready" says what happens next, from how the quote was set up. */
export function jobStatusLabel(status: JobStatus, fulfilment: JobFulfilment): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "Making";
    case "ready":
      return fulfilment === "delivery" ? "Ready for delivery" : fulfilment === "collection" ? "Ready for collection" : "Ready";
    case "out_for_delivery":
      return "Out for delivery";
    case "done":
      return "Done";
    case "cancelled":
      return "Cancelled";
  }
}

export type StatusTone = "neutral" | "working" | "good" | "warning";
export const jobStatusTone = (status: JobStatus): StatusTone =>
  status === "done" ? "good" : status === "ready" || status === "out_for_delivery" ? "warning" : status === "in_progress" ? "working" : "neutral";

/** Is this move allowed? The same moves as the database function. */
export function canMoveJob(from: JobStatus, to: JobStatus, fulfilment: JobFulfilment): boolean {
  switch (from) {
    case "not_started":
      return to === "in_progress" || to === "cancelled";
    case "in_progress":
      return to === "ready" || to === "not_started" || to === "cancelled";
    case "ready":
      return to === "done" || to === "in_progress" || to === "cancelled" || (to === "out_for_delivery" && fulfilment === "delivery");
    case "out_for_delivery":
      return to === "done" || to === "ready";
    case "done":
      return to === "ready";
    case "cancelled":
      return to === "not_started";
  }
}

export type JobStep = { to: JobStatus; label: string; hint?: string };

/** The one thing to do next, as a button: "Start making", "Mark ready for collection", "Mark done". Null once finished. */
export function nextJobStep(status: JobStatus, fulfilment: JobFulfilment): JobStep | null {
  switch (status) {
    case "not_started":
      return { to: "in_progress", label: "Start making" };
    case "in_progress":
      return { to: "ready", label: fulfilment === "delivery" ? "Mark ready for delivery" : fulfilment === "collection" ? "Mark ready for collection" : "Mark ready" };
    case "ready":
      return fulfilment === "delivery"
        ? { to: "out_for_delivery", label: "Out for delivery" }
        : { to: "done", label: fulfilment === "collection" ? "Mark collected and done" : "Mark done" };
    case "out_for_delivery":
      return { to: "done", label: "Mark delivered and done" };
    case "done":
    case "cancelled":
      return null;
  }
}

/** The other moves, as smaller buttons: stepping back, and cancelling or restoring. */
export function otherJobSteps(status: JobStatus, fulfilment: JobFulfilment): JobStep[] {
  const steps: JobStep[] = [];
  const back: Partial<Record<JobStatus, JobStatus>> = { in_progress: "not_started", ready: "in_progress", out_for_delivery: "ready", done: "ready" };
  const to = back[status];
  if (to) steps.push({ to, label: `Back to ${jobStatusLabel(to, fulfilment).toLowerCase()}` });
  // Ready can also go straight to done on a delivery (handed over some other way).
  if (status === "ready" && fulfilment === "delivery") steps.push({ to: "done", label: "Mark done without a delivery" });
  if (canMoveJob(status, "cancelled", fulfilment)) steps.push({ to: "cancelled", label: "Cancel this job" });
  if (status === "cancelled") steps.push({ to: "not_started", label: "Restore this job" });
  return steps;
}

/** Active: not finished and not cancelled. */
export const isActiveJob = (status: JobStatus): boolean => status !== "done" && status !== "cancelled";

/** Late: needed by a day that has passed, and not finished. `today` and `neededBy` are YYYY-MM-DD. */
export const isOverdueJob = (job: { status: JobStatus; neededBy: string | null }, today: string): boolean =>
  isActiveJob(job.status) && job.neededBy !== null && job.neededBy < today;

export type JobSummary = {
  id: string;
  organisationId: string;
  number: number;
  status: JobStatus;
  fulfilment: JobFulfilment;
  neededBy: string | null;
  customerName: string;
  /** The items, in order, as "Wedding cake" and "12 dozen Cupcakes" would be built from. */
  items: { name: string; quantityMilli: number; madeMilli: number; unit: string | null }[];
  createdAt: string;
};

export type JobFilter = "active" | "done" | "all";

/** The jobs to show: active ones first by the day they are needed (no day last), then the finished ones, newest first. */
export function visibleJobs(jobs: readonly JobSummary[], filter: JobFilter, query: string): JobSummary[] {
  const q = query.trim().toLowerCase();
  const matches = (j: JobSummary) =>
    q === "" ||
    j.customerName.toLowerCase().includes(q) ||
    jobNumberText(j.number).toLowerCase().includes(q) ||
    String(j.number) === q ||
    j.items.some((i) => i.name.toLowerCase().includes(q));
  const keep = (j: JobSummary) => (filter === "all" ? true : filter === "active" ? isActiveJob(j.status) : j.status === "done");
  return jobs
    .filter((j) => keep(j) && matches(j))
    .sort((a, b) => {
      if (isActiveJob(a.status) !== isActiveJob(b.status)) return isActiveJob(a.status) ? -1 : 1;
      // Finished and cancelled ones: the newest first.
      if (!isActiveJob(a.status)) return b.number - a.number;
      if (a.neededBy !== b.neededBy) {
        if (a.neededBy === null) return 1;
        if (b.neededBy === null) return -1;
        return a.neededBy < b.neededBy ? -1 : 1;
      }
      return b.number - a.number;
    });
}

export type JobOption = { group: string; kind: string; value: string | null; text: string | null; quantityMilli: number | null };

export type JobDetail = JobSummary & {
  /** The quote it was made from, or null for a job made by hand. */
  quoteId: string | null;
  quoteNumber: string;
  quoteVersion: number | null;
  deliveryAddress: string | null;
  customerId: string | null;
  customerContactPerson: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  note: string | null;
  fullItems: {
    id: string;
    name: string;
    description: string | null;
    quantityMilli: number;
    madeMilli: number;
    /** Added to the job after it was made, not carried over from the quote or the first form. */
    addedLater: boolean;
    unit: string | null;
    variationLabel: string | null;
    variationName: string | null;
    options: JobOption[];
    photoImageId: string | null;
  }[];
  events: {
    kind: "created" | "status" | "item_added";
    fromStatus: JobStatus | null;
    toStatus: JobStatus;
    /** For "item_added": the item's name. */
    detail: string | null;
    createdAt: string;
  }[];
};

/** The most items one job can hold (the database refuses more). */
export const MAX_JOB_ITEMS = 50;

/** Counts of what is made show while a job is being made; once it is ready or later they are not shown (nor changed). */
export const takesCounts = (status: JobStatus): boolean => status === "not_started" || status === "in_progress";

/** An item can be added until the job leaves the maker's hands. */
export const takesNewItems = (status: JobStatus): boolean => status === "not_started" || status === "in_progress" || status === "ready";

export const isItemMade = (item: { quantityMilli: number; madeMilli: number }): boolean => item.madeMilli >= item.quantityMilli;

export type JobProgress = { made: number; total: number; allMade: boolean };

/** How many items are completely made. An item with some but not all made is not counted. */
export function jobProgress(items: readonly { quantityMilli: number; madeMilli: number }[]): JobProgress {
  const made = items.filter(isItemMade).length;
  return { made, total: items.length, allMade: items.length > 0 && made === items.length };
}

/** "1 of 3 items made", "All 3 items made", "1 of 1 item made"... */
export function progressText(progress: JobProgress): string {
  const noun = progress.total === 1 ? "item" : "items";
  if (progress.allMade && progress.total > 1) return `All ${progress.total} ${noun} made`;
  return `${progress.made} of ${progress.total} ${noun} made`;
}

/** One tap on plus or minus: one whole unit, or what is left of a part unit; down from a part unit to the whole one below. */
export function stepMade(madeMilli: QuantityMilli, quantityMilli: QuantityMilli, direction: 1 | -1): QuantityMilli {
  if (direction === 1) return Math.min(quantityMilli, madeMilli + 1000);
  const remainder = madeMilli % 1000;
  return Math.max(0, madeMilli - (remainder === 0 ? 1000 : remainder));
}

/** What was typed in the "made" box: from none up to all of the item. */
export function parseMade(input: string, quantityMilli: QuantityMilli, style: NumberStyle): ValidationResult<QuantityMilli> {
  // Zero is a fine count here (nothing made yet), though it is not a quantity.
  if (/^\s*0+(?:[.,]0*)?\s*$/.test(input)) return { ok: true, value: 0 };
  const parsed = parseQuantity(input);
  if (!parsed.ok) return parsed;
  if (parsed.value > quantityMilli) {
    return { ok: false, error: `That is more than the ${formatQuantity(quantityMilli, style)} ordered. Enter a number up to ${formatQuantity(quantityMilli, style)}.` };
  }
  return parsed;
}
