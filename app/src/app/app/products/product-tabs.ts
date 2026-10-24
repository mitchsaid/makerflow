export type ProductTab = "details" | "production" | "inputs";

/**
 * The tab of the product form that a problem's field is on: the steps' on Production, the product's own cost lines' (and
 * how many one batch makes) on Inputs, everything else on Details. An extra's cost lines are edited with the extra, so
 * theirs are on Details: `costKeys` are the keys of the product's own cost lines only.
 */
export function productTabOf(fieldId: string, fid: (key: string) => string, costKeys: readonly string[]): ProductTab {
  if (fieldId.startsWith(fid("step-")) || fieldId === fid("steps-error")) return "production";
  if (fieldId === fid("makes") || fieldId === fid("costs-error") || costKeys.some((k) => fieldId.startsWith(fid(`cost-${k}-`)))) return "inputs";
  return "details";
}
