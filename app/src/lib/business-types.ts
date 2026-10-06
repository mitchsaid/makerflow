import type { ValidationResult } from "./validation";

/**
 * What a business makes or sells, so the app can put the examples that fit first (policy examples,
 * terms starters, unit suggestions). Not country-specific: the labels are plain words. What each type
 * changes (the example wording) is country-specific and lives in the locale pack. Never used for
 * anything outside the app. See docs/plans/business-type.md.
 */
export const BUSINESS_TYPES = [
  { key: "food", label: "Food and baking" },
  { key: "jewellery", label: "Jewellery and accessories" },
  { key: "clothing", label: "Clothing and sewing" },
  { key: "flowers", label: "Flowers and plants" },
  { key: "home_body", label: "Candles, soap and beauty" },
  { key: "craft", label: "Ceramics, wood and leather" },
  { key: "art", label: "Art, prints and photography" },
  { key: "workshops", label: "Workshops and classes" },
  { key: "other", label: "Something else" },
] as const;

/** The friendly prompt that asks what the business makes (remembered in prompt_dismissals when dismissed). */
export const BUSINESS_TYPE_PROMPT = "business-type";

export type BusinessType = (typeof BUSINESS_TYPES)[number]["key"];

export const BUSINESS_TYPE_KEYS: readonly string[] = BUSINESS_TYPES.map((t) => t.key);

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === "string" && BUSINESS_TYPE_KEYS.includes(value);
}

export function businessTypeLabel(key: BusinessType): string {
  return BUSINESS_TYPES.find((t) => t.key === key)?.label ?? key;
}

/**
 * Checks what came from a form or a request: a list of known keys. Duplicates are dropped, the order
 * is the list's own, an empty list is fine (skipped), anything unknown is refused.
 */
export function parseBusinessTypes(input: unknown): ValidationResult<BusinessType[]> {
  if (!Array.isArray(input) || input.length > BUSINESS_TYPES.length * 2) {
    return { ok: false, error: "Something went wrong saving that. Please try again." };
  }
  if (!input.every(isBusinessType)) {
    return { ok: false, error: "Choose from the list." };
  }
  const chosen = new Set<string>(input);
  return { ok: true, value: BUSINESS_TYPES.map((t) => t.key).filter((k) => chosen.has(k)) };
}

/** What the database holds (null = never asked) as a clean list: only keys the app knows. */
export function businessTypesFromRow(value: unknown): BusinessType[] | null {
  if (!Array.isArray(value)) return null;
  return BUSINESS_TYPES.map((t) => t.key).filter((k) => value.includes(k));
}

/** Anything that can say which types it fits. No types means it fits everyone. */
export type Typed = { types?: readonly BusinessType[] };

/** Does the maker's answer say anything? ("Something else" and no answer do not.) */
export function hasSpecificTypes(chosen: readonly BusinessType[] | null | undefined): chosen is readonly BusinessType[] {
  return !!chosen && chosen.some((t) => t !== "other");
}

const fits = (item: Typed, chosen: readonly BusinessType[]) => !!item.types?.length && item.types.some((t) => chosen.includes(t));

/**
 * Splits a list into what is for this business (the ones that fit their types first, then the ones
 * that fit everyone) and the rest (kept, never hidden). With no answer, everything is for them in the
 * list's own order.
 */
export function splitForTypes<T extends Typed>(
  items: readonly T[],
  chosen: readonly BusinessType[] | null | undefined,
): { forYou: T[]; others: T[] } {
  if (!hasSpecificTypes(chosen)) return { forYou: [...items], others: [] };
  return {
    forYou: [...items.filter((i) => fits(i, chosen)), ...items.filter((i) => !i.types?.length)],
    others: items.filter((i) => !!i.types?.length && !fits(i, chosen)),
  };
}

/** The same, as one list: theirs first, then the rest. */
export function rankForTypes<T extends Typed>(items: readonly T[], chosen: readonly BusinessType[] | null | undefined): T[] {
  const { forYou, others } = splitForTypes(items, chosen);
  return [...forYou, ...others];
}

/** "food and baking and workshops and classes" for a sentence ("Showing examples for ..."). */
export function describeTypes(chosen: readonly BusinessType[]): string {
  const labels = chosen.filter((t) => t !== "other").map((t) => businessTypeLabel(t).toLowerCase());
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
