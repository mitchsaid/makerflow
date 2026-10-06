import type { BusinessType } from "../business-types";

/**
 * One-tap starting lines for a quote's terms. They are prompts to edit, not legal advice, and
 * not tied to any country's rules (those live in the locale packs). Square brackets mark what the
 * maker should fill in.
 */
export const TERMS_STARTERS: readonly { key: string; label: string; text: string; types?: readonly BusinessType[] }[] = [
  { key: "lead-time", label: "Lead time", text: "Please allow [2 weeks] to make your order." },
  { key: "deposit", label: "Deposit", text: "A deposit is needed to start work." },
  { key: "changes", label: "Changes", text: "Changes after you accept this quote are quoted again, and the new price and date are agreed with you." },
  { key: "order-notice", label: "Order notice", types: ["food", "flowers"], text: "Orders need [2 days'] notice." },
  { key: "collection", label: "Collection", types: ["food", "flowers"], text: "Please collect on the agreed day and time." },
  { key: "proof", label: "Proof", types: ["jewellery", "craft", "art", "clothing"], text: "We start making it once you approve the proof." },
];

/** Adds a starter's line to the end of the terms, on its own line, unless it is already there. */
export function addStarter(terms: string, text: string): string {
  if (terms.includes(text)) return terms;
  return terms.trim() === "" ? text : `${terms.replace(/\s+$/, "")}\n${text}`;
}
