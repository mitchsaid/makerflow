/**
 * The five headings a maker's policies sit under. Plain data, safe for the browser, and used by
 * the locale packs (which hold the starter wording for each).
 */
export const POLICY_KINDS = [
  "changes",
  "cancellation",
  "variations",
  "client_responsibilities",
  "liability_aftercare",
] as const;

export type PolicyKind = (typeof POLICY_KINDS)[number];

/** The heading's name, which is also what a new policy under it is called until renamed. */
export const POLICY_HEADINGS: Record<PolicyKind, string> = {
  changes: "Changes",
  cancellation: "Cancellation",
  variations: "Expected variations",
  client_responsibilities: "Client responsibilities",
  liability_aftercare: "Liability, warranty and aftercare",
};

/** One line on what each heading is for, shown beside it. */
export const POLICY_PURPOSES: Record<PolicyKind, string> = {
  changes: "What happens when something changes after the customer has said yes.",
  cancellation: "What the customer pays if they cancel, and when.",
  variations: "What will look a little different from the photos, like handmade pieces or natural materials.",
  client_responsibilities: "What the customer needs to do or tell you, before and after handover.",
  liability_aftercare: "What you promise afterwards, like repairs, resizing or cleaning, and where your responsibility ends.",
};

export function isPolicyKind(value: unknown): value is PolicyKind {
  return typeof value === "string" && (POLICY_KINDS as readonly string[]).includes(value);
}

/** What a locale pack gives each heading: some starter wording to tap, and a plain "good to know". */
export type PolicyStarter = { key: string; label: string; text: string };
export type PolicyGuidance = { goodToKnow: string; starters: readonly PolicyStarter[] };
export type PolicyPackContent = {
  kinds: Record<PolicyKind, PolicyGuidance>;
  /** Said once beside the starters: they are prompts, and who should check them. */
  adviceNote: string;
};
