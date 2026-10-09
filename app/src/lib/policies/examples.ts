import type { BusinessType } from "../business-types";

/**
 * What a maker can start a term from: the locale pack's examples, plus a few short lines that fit any
 * country. A term is an optional title and some wording; an example fills both in, and the maker
 * changes them to suit. Plain data, safe for the browser.
 */
export type PolicyExample = {
  /** Stable, for links and tests ("made-to-order"). */
  key: string;
  /** What the term would be called ("If you cancel: made to order"), or "" for a line with no title. */
  title: string;
  /** The button's words when the example has no title ("Lead time"). */
  label?: string;
  /** The starting wording. Anything in [square brackets] is for the maker to fill in. */
  text: string;
  /** The kinds of business it fits, so a maker sees theirs first. Absent: it fits everyone. */
  types?: readonly BusinessType[];
  /** A cancellation policy: the form shows the (not yet built) stages table beside it. */
  suggestsStages?: boolean;
};

export type PolicyPackContent = {
  examples: readonly PolicyExample[];
  /** Said once beside the examples: they are prompts, and who should check them. */
  adviceNote: string;
};

/**
 * Short lines with no title, for any country (they carry no country's rules). They were the one-tap
 * "starters" of the old Terms box. Square brackets mark what the maker should fill in.
 */
export const QUICK_LINES: readonly PolicyExample[] = [
  { key: "lead-time", title: "", label: "Lead time", text: "Please allow [2 weeks] to make your order." },
  { key: "deposit", title: "", label: "Deposit", text: "A deposit is needed to start work." },
  { key: "order-notice", title: "", label: "Order notice", types: ["food", "flowers"], text: "Orders need [2 days'] notice." },
  { key: "collection", title: "", label: "Collection", types: ["flowers"], text: "Please collect on the agreed day and time." },
  { key: "proof", title: "", label: "Proof", types: ["jewellery", "craft", "art", "clothing"], text: "We start making it once you approve the proof." },
];

/** Everything a maker can start a term from: the country's examples, then the short lines. */
export function termExamples(content: PolicyPackContent): PolicyExample[] {
  return [...content.examples, ...QUICK_LINES];
}

/** The words on an example's button. */
export function exampleLabel(e: PolicyExample): string {
  return e.title || e.label || e.key;
}
