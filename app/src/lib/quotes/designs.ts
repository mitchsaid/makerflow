/**
 * The designs a quote document can be drawn in. Only the classic one exists so far; the picker
 * on the preview screen shows the rest as "coming soon". Plain data, safe for the browser.
 */

export const DESIGNS = [
  { key: "classic", name: "Classic", description: "Clean and simple, black on white." },
] as const;

export type DesignKey = (typeof DESIGNS)[number]["key"];

export const DEFAULT_DESIGN: DesignKey = "classic";
