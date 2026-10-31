/** Feedback from the "Send feedback" sheet (docs/plans/feedback-button.md). */

export const FEEDBACK_MAX = 2000;

export const FEEDBACK_KINDS = ["problem", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  problem: "Something isn't working",
  idea: "An idea",
  other: "Something else",
};

/** What the sheet sends: the words, and where the person was and what they were using. */
export type FeedbackValues = {
  kind: FeedbackKind;
  message: string;
  /** They agreed we may email them about it. */
  contact: boolean;
  page: string;
  viewport: string;
  userAgent: string;
};

export type FeedbackErrors = { message?: string };

export type ParsedFeedback = {
  kind: FeedbackKind;
  message: string;
  contact: boolean;
  page: string | null;
  viewport: string | null;
  userAgent: string | null;
};

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

/**
 * Reads feedback as it arrives from the browser. The words are the one thing a person types, so they are checked and
 * said kindly; where they were and what they were using are only noted when they look right (a wrong one is dropped, it
 * never stops the feedback).
 */
export function parseFeedback(input: unknown): { ok: true; value: ParsedFeedback } | { ok: false; errors: FeedbackErrors } {
  if (typeof input !== "object" || input === null) return { ok: false, errors: { message: "Something went wrong. Please try again." } };
  const v = input as Record<string, unknown>;
  const message = typeof v.message === "string" ? v.message.replace(/\r\n/g, "\n").trim() : "";
  if (message === "") return { ok: false, errors: { message: "Tell us what happened or what would help, even in a few words." } };
  if (message.length > FEEDBACK_MAX) return { ok: false, errors: { message: `Keep it to ${FEEDBACK_MAX} characters or fewer. You can send more than one.` } };

  const page = typeof v.page === "string" && v.page.startsWith("/") && !v.page.startsWith("//") ? v.page.slice(0, 300) : null;
  const viewport = typeof v.viewport === "string" && /^[0-9]{2,5}x[0-9]{2,5}$/.test(v.viewport) ? v.viewport : null;
  const userAgent = typeof v.userAgent === "string" && v.userAgent.trim() !== "" ? v.userAgent.trim().slice(0, 300) : null;
  return {
    ok: true,
    value: { kind: isFeedbackKind(v.kind) ? v.kind : "other", message, contact: v.contact === true, page, viewport, userAgent },
  };
}
