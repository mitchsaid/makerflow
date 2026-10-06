import { formatDay, isIsoDay } from "./dates";

/**
 * What happened to a quote after it was sent: the customer said yes or no, or the maker
 * withdrew it. The answer is kept in the activity log (see docs/plans/quote-outcomes.md).
 */

export type QuoteEventKind = "created" | "sent" | "revised" | "accepted" | "declined" | "withdrawn" | "reopened";
export type AnswerKind = "accepted" | "declined";
export type OutcomeKind = AnswerKind | "withdrawn";

/** How the customer told the maker. The values are what the database allows. */
export const ANSWER_WAYS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "in_person", label: "In person" },
  { value: "phone", label: "Phone call" },
  { value: "other", label: "Another way" },
] as const;

export type AnswerWay = (typeof ANSWER_WAYS)[number]["value"];

export const NOTE_MAX = 500;

const wayLabel = (way: string | null) => ANSWER_WAYS.find((w) => w.value === way)?.label ?? null;

/** What the sheet holds while the maker types. */
export type OutcomeFormValues = { on: string; how: string; note: string };

export type OutcomeErrors = { on?: string; how?: string; note?: string };

export type ParsedOutcome = { on: string | null; how: AnswerWay | null; note: string | null };

/** Checks what was typed. `today` is today's date where the business is (YYYY-MM-DD). */
export function parseOutcome(
  kind: OutcomeKind,
  values: OutcomeFormValues,
  today: string,
): { ok: true; value: ParsedOutcome } | { ok: false; errors: OutcomeErrors } {
  const errors: OutcomeErrors = {};
  const note = values.note.trim();
  if (note.length > NOTE_MAX) errors.note = `Keep the note to ${NOTE_MAX} characters or fewer.`;

  if (kind === "withdrawn") {
    if (errors.note) return { ok: false, errors };
    return { ok: true, value: { on: null, how: null, note: note || null } };
  }

  if (!isIsoDay(values.on)) errors.on = "Choose the day they told you.";
  else if (values.on > today) errors.on = "That day hasn't happened yet. Choose today or an earlier day.";
  const way = ANSWER_WAYS.find((w) => w.value === values.how);
  if (!way) errors.how = "Choose how they told you.";
  if (Object.keys(errors).length > 0 || !way) return { ok: false, errors };
  return { ok: true, value: { on: values.on, how: way.value, note: note || null } };
}

/** The shape of an event that the page needs to describe it. */
export type OutcomeEvent = {
  kind: QuoteEventKind;
  on: string | null;
  how: string | null;
  note: string | null;
};

/** The latest event that decided the quote's answer, if the quote is accepted, declined or withdrawn now. */
export function currentOutcome<E extends OutcomeEvent>(status: string, events: readonly E[]): E | null {
  if (status !== "accepted" && status !== "declined" && status !== "withdrawn") return null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].kind === status) return events[i];
  }
  return null;
}

/** "Accepted on 5 Oct 2026 · WhatsApp": for the banner and the activity log. */
export function outcomeSentence(event: OutcomeEvent, locale: string): string {
  switch (event.kind) {
    case "accepted":
    case "declined": {
      const day = event.on ? ` on ${formatDay(event.on, locale)}` : "";
      const way = wayLabel(event.how);
      return `${event.kind === "accepted" ? "Accepted" : "Declined"}${day}${way ? ` · ${way}` : ""}`;
    }
    case "withdrawn":
      return "Withdrawn";
    case "reopened":
      return "Answer changed, back to sent";
    default:
      return "";
  }
}
