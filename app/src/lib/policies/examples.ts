import type { BusinessType } from "../business-types";

/**
 * What a locale pack offers when a maker writes a policy: a few examples to start from. A policy is
 * just a title and some wording; an example fills both in, and the maker changes them to suit.
 * Plain data, safe for the browser.
 */
export type PolicyExample = {
  /** Stable, for links and tests ("made-to-order"). */
  key: string;
  /** What the policy would be called ("If you cancel: made to order"). */
  title: string;
  /** The starting wording. Anything in [square brackets] is for the maker to fill in. */
  text: string;
  /** The kinds of business it fits, so a maker sees theirs first. Absent: it fits everyone. */
  types?: readonly BusinessType[];
  /** A cancellation policy: the form shows the (not yet built) stages table beside it. */
  suggestsStages?: boolean;
  /** A plain note on what the country's consumer rules mean for this kind of policy. */
  goodToKnow: string;
};

export type PolicyPackContent = {
  examples: readonly PolicyExample[];
  /** Said once beside the examples: they are prompts, and who should check them. */
  adviceNote: string;
};
