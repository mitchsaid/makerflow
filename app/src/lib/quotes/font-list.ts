/**
 * The fonts a quote theme can use: the two that always ship (Noto Sans and Noto Serif, which cover every
 * South African language that uses the Latin alphabet) and a short list of popular, freely licensed Google
 * Fonts. Plain data, safe for the browser; the font files and how they are loaded are in pdf/fonts.ts.
 * Adding a font: add it here and in scripts/fonts/build.mjs, then run `pnpm fonts:build`.
 *
 * The ids "sans" and "serif" are the two Noto fonts and keep those names because earlier themes and sent
 * quotes were saved with them.
 */

export type FontCategory = "sans" | "serif" | "display" | "script";

export type FontEntry = {
  id: string;
  label: string;
  category: FontCategory;
  /** Has a bold face; without one, bold text is drawn in the regular face. */
  bold: boolean;
};

export const FONT_LIST: readonly FontEntry[] = [
  { id: "sans", label: "Noto Sans", category: "sans", bold: true },
  { id: "inter", label: "Inter", category: "sans", bold: true },
  { id: "poppins", label: "Poppins", category: "sans", bold: true },
  { id: "montserrat", label: "Montserrat", category: "sans", bold: true },
  { id: "lato", label: "Lato", category: "sans", bold: true },
  { id: "raleway", label: "Raleway", category: "sans", bold: true },
  { id: "nunito", label: "Nunito", category: "sans", bold: true },
  { id: "dm-sans", label: "DM Sans", category: "sans", bold: true },
  { id: "work-sans", label: "Work Sans", category: "sans", bold: true },
  { id: "serif", label: "Noto Serif", category: "serif", bold: true },
  { id: "playfair", label: "Playfair Display", category: "serif", bold: true },
  { id: "lora", label: "Lora", category: "serif", bold: true },
  { id: "merriweather", label: "Merriweather", category: "serif", bold: true },
  { id: "cormorant", label: "Cormorant Garamond", category: "serif", bold: true },
  { id: "libre-baskerville", label: "Libre Baskerville", category: "serif", bold: true },
  { id: "roboto-slab", label: "Roboto Slab", category: "serif", bold: true },
  { id: "dm-serif", label: "DM Serif Display", category: "display", bold: false },
  { id: "oswald", label: "Oswald", category: "display", bold: true },
  { id: "dancing-script", label: "Dancing Script", category: "script", bold: true },
  { id: "pacifico", label: "Pacifico", category: "script", bold: false },
];

export const FONT_IDS: readonly string[] = FONT_LIST.map((f) => f.id);

export const isFontId = (value: unknown): value is string => typeof value === "string" && FONT_IDS.includes(value);

export const fontEntry = (id: string): FontEntry => FONT_LIST.find((f) => f.id === id) ?? FONT_LIST[0];

export const CATEGORY_LABELS: Record<FontCategory, string> = {
  sans: "Clean",
  serif: "Serif",
  display: "Bold headings",
  script: "Handwritten",
};
