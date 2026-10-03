/**
 * How a quote's state is shown. "Expired" is not stored: a sent quote whose valid-until day
 * has passed is shown as expired, and is current again if it is revised and sent anew.
 */

export type StatusTone = "neutral" | "good" | "warning";

export type QuoteStatusInput = {
  status: string;
  version: number;
  validUntil: string;
  /** Today in the business's time zone, YYYY-MM-DD. */
  today: string;
};

export type QuoteStatusKey = "draft" | "revising" | "sent" | "expired" | "accepted" | "declined" | "withdrawn";

export function quoteStatusKey(q: QuoteStatusInput): QuoteStatusKey {
  if (q.status === "draft") return q.version > 1 ? "revising" : "draft";
  if (q.status === "sent" && q.validUntil < q.today) return "expired";
  return q.status as QuoteStatusKey;
}

const LABELS: Record<QuoteStatusKey, string> = {
  draft: "Draft",
  revising: "Revising",
  sent: "Sent",
  expired: "Expired",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

const TONES: Record<QuoteStatusKey, StatusTone> = {
  draft: "neutral",
  revising: "neutral",
  sent: "good",
  expired: "warning",
  accepted: "good",
  declined: "warning",
  withdrawn: "warning",
};

export const quoteStatusLabel = (key: QuoteStatusKey) => LABELS[key];
export const quoteStatusTone = (key: QuoteStatusKey) => TONES[key];

/** The filter chips on the Quotes list, in order. */
export const STATUS_FILTERS: readonly { key: "all" | QuoteStatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "revising", label: "Revising" },
  { key: "sent", label: "Sent" },
  { key: "expired", label: "Expired" },
];
