/**
 * Quote themes. A theme is a complete, named look a business owns (a "spec": every part has a value,
 * nothing is "the default with changes"). Five starters ship with the app and can be used or remixed;
 * a maker's own themes are saved per business. `resolveTheme` turns a spec into the plain values the
 * PDF and the miniatures are drawn from, and a sent version stores that resolved theme, so a quote
 * never changes when a theme is edited later.
 *
 * Plain data and small functions, safe for the browser (the studio draws the same choices).
 */

import { isFontId } from "./font-list";
import { isImageId } from "../images";

// ---------------------------------------------------------------------------
// The parts, and the choices each one has
// ---------------------------------------------------------------------------

export const HEADERS = ["plain", "bar", "band", "boxed"] as const;
export const LOGO_MODES = ["both", "logo", "name"] as const;
export const ALIGNS = ["left", "center"] as const;
export const LAYOUTS = ["table", "list", "cards", "showcase"] as const;
export const TABLE_HEADS = ["line", "tint", "filled", "none"] as const;
export const ROWS = ["lines", "zebra", "boxed", "sheet", "none"] as const;
export const DENSITIES = ["compact", "comfortable", "airy"] as const;
export const PHOTOS = ["none", "small", "large"] as const;
export const PHOTO_SHAPES = ["square", "rounded", "round"] as const;
export const TOTALS = ["rule", "tint", "solid", "pill"] as const;
export const CORNERS = ["square", "soft", "round"] as const;
export const BACKGROUNDS = ["paper", "gradient", "image"] as const;
export const GRADIENT_DIRECTIONS = ["down", "diagonal"] as const;
export const IMAGE_STRENGTHS = ["faint", "soft", "medium"] as const;
/** How the prices of options and extras show on an item: in the price each, or each on its own line. */
export const EXTRA_PRICES = ["included", "separate"] as const;

/** How much of a background picture shows through over the paper (so text stays easy to read). */
export const IMAGE_OPACITY: Record<(typeof IMAGE_STRENGTHS)[number], number> = { faint: 0.12, soft: 0.25, medium: 0.4 };

export type HeaderStyle = (typeof HEADERS)[number];
export type LogoMode = (typeof LOGO_MODES)[number];
export type Align = (typeof ALIGNS)[number];
export type ItemLayout = (typeof LAYOUTS)[number];
export type TableHeadStyle = (typeof TABLE_HEADS)[number];
export type RowStyle = (typeof ROWS)[number];
export type Density = (typeof DENSITIES)[number];
export type PhotoSize = (typeof PHOTOS)[number];
export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type TotalsStyle = (typeof TOTALS)[number];
export type Corners = (typeof CORNERS)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];
export type ImageStrength = (typeof IMAGE_STRENGTHS)[number];
export type ExtraPrices = (typeof EXTRA_PRICES)[number];

/** Every part of a theme. All present, always: a theme is whole. */
export type ThemeSpec = {
  /** "#rrggbb". */
  accent: string;
  /** The paper's colour, "#rrggbb" (text turns white on a dark one); also what a gradient starts from and a picture lies on. */
  paper: string;
  /** What is behind the page: the plain paper colour, a gradient from the paper colour to `gradientTo`, or a picture over the paper. */
  background: Background;
  /** The colour a gradient ends in, "#rrggbb". */
  gradientTo: string;
  gradientDirection: GradientDirection;
  /** The picture behind the page (an id from lib/images, kind "background"), if there is one. */
  backgroundImageId: string | null;
  imageStrength: ImageStrength;
  /** A font id from font-list.ts. */
  headingFont: string;
  bodyFont: string;
  header: HeaderStyle;
  headerLogo: LogoMode;
  headerAlign: Align;
  layout: ItemLayout;
  /** Used by the table layout (the others have their own look). */
  tableHead: TableHeadStyle;
  rows: RowStyle;
  density: Density;
  showQty: boolean;
  showUnitPrice: boolean;
  numbered: boolean;
  descriptions: boolean;
  photo: PhotoSize;
  photoShape: PhotoShape;
  /** Options and extras: their prices folded into the price each, or each shown with its amount. */
  extraPrices: ExtraPrices;
  totals: TotalsStyle;
  corners: Corners;
};

export const BOOLEAN_PARTS = ["showQty", "showUnitPrice", "numbered", "descriptions"] as const;

/** The words the studio uses for each choice, in the order shown. */
export const CHOICES = {
  background: { label: "Background", options: [["paper", "Paper"], ["gradient", "Gradient"], ["image", "Image"]] },
  gradientDirection: { label: "Gradient direction", options: [["down", "Top to bottom"], ["diagonal", "Corner to corner"]] },
  imageStrength: { label: "Picture strength", options: [["faint", "Faint"], ["soft", "Soft"], ["medium", "Medium"]] },
  header: { label: "Top of the page", options: [["plain", "Plain"], ["bar", "Line of colour"], ["band", "Band of colour"], ["boxed", "Boxed"]] },
  headerLogo: { label: "Logo", options: [["both", "Logo and name"], ["logo", "Logo only"], ["name", "Name only"]] },
  headerAlign: { label: "Alignment", options: [["left", "Left"], ["center", "Centred"]] },
  layout: { label: "How items are shown", options: [["table", "Table"], ["list", "List"], ["cards", "Cards"], ["showcase", "Showcase"]] },
  tableHead: { label: "Table heading", options: [["line", "A line"], ["tint", "Light colour"], ["filled", "Solid colour"], ["none", "None"]] },
  rows: { label: "Row style", options: [["lines", "Lines between"], ["zebra", "Alternating shade"], ["boxed", "Boxed rows"], ["sheet", "Spreadsheet"], ["none", "Just space"]] },
  density: { label: "Spacing", options: [["compact", "Compact"], ["comfortable", "Comfortable"], ["airy", "Airy"]] },
  photo: { label: "Product photos", options: [["none", "None"], ["small", "Small"], ["large", "Large"]] },
  photoShape: { label: "Photo shape", options: [["square", "Square"], ["rounded", "Rounded"], ["round", "Round"]] },
  extraPrices: { label: "Extra prices", options: [["included", "In the price"], ["separate", "Shown separately"]] },
  totals: { label: "Total", options: [["rule", "A line"], ["tint", "Light box"], ["solid", "Solid box"], ["pill", "Pill"]] },
  corners: { label: "Corners", options: [["square", "Square"], ["soft", "Soft"], ["round", "Round"]] },
} as const satisfies Record<string, { label: string; options: readonly (readonly [string, string])[] }>;

export type ChoiceName = keyof typeof CHOICES;

const LISTS: Record<ChoiceName, readonly string[]> = {
  background: BACKGROUNDS,
  gradientDirection: GRADIENT_DIRECTIONS,
  imageStrength: IMAGE_STRENGTHS,
  header: HEADERS,
  headerLogo: LOGO_MODES,
  headerAlign: ALIGNS,
  layout: LAYOUTS,
  tableHead: TABLE_HEADS,
  rows: ROWS,
  density: DENSITIES,
  photo: PHOTOS,
  photoShape: PHOTO_SHAPES,
  extraPrices: EXTRA_PRICES,
  totals: TOTALS,
  corners: CORNERS,
};

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/;

/** "#ABC123" or "abc123" or "#abc" as "#aabbcc"; null when it isn't a colour. */
export function normaliseColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (v.startsWith("#")) v = v.slice(1);
  if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null;
}

type Rgb = [number, number, number];

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0")).join("")}`;
}

/** `amount` (0 to 1) of `top` over `bottom`. */
export function mix(top: string, bottom: string, amount: number): string {
  const a = toRgb(top);
  const b = toRgb(bottom);
  return toHex([0, 1, 2].map((i) => a[i] * amount + b[i] * (1 - amount)) as Rgb);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const INK = "#1a1a1a";
const WHITE = "#ffffff";

/** Black or white, whichever reads better on this colour (pure black, so even a pure red reads). */
export function onColour(background: string): string {
  return contrast(background, WHITE) >= contrast(background, "#000000") ? WHITE : "#000000";
}

/**
 * The colour itself if it reads as text on every one of the `background`s, else a shade of it that does: lighter when the
 * text on this paper is light (`lighten`), darker otherwise. `lighten` follows the paper's text colour,
 * so a mid-tone paper is never pushed the wrong way.
 */
export function readableOn(background: string | readonly string[], colour: string, ratio = 4.5, lighten?: boolean): string {
  const backgrounds = typeof background === "string" ? [background] : background;
  const goLighter = lighten ?? onColour(backgrounds[0]) === WHITE;
  let c = colour;
  const towards = goLighter ? "#ffffff" : "#000000";
  const reads = (x: string) => backgrounds.every((b) => contrast(x, b) >= ratio);
  for (let step = 0; step < 60 && !reads(c); step++) {
    const next = mix(towards, c, 0.15);
    // Colours are whole numbers, so a very dark (or light) one can stop changing: go straight to the end.
    c = next === c ? towards : next;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Specs: the starters, a blank, and reading one safely
// ---------------------------------------------------------------------------

/** A plain base to start from scratch: black and white, a simple table, nothing decorative. */
export const BLANK_SPEC: ThemeSpec = {
  accent: "#1a1a1a",
  paper: "#ffffff",
  background: "paper",
  gradientTo: "#e8eef6",
  gradientDirection: "down",
  backgroundImageId: null,
  imageStrength: "soft",
  headingFont: "sans",
  bodyFont: "sans",
  header: "plain",
  headerLogo: "both",
  headerAlign: "left",
  layout: "table",
  tableHead: "line",
  rows: "lines",
  density: "comfortable",
  showQty: true,
  showUnitPrice: true,
  numbered: false,
  descriptions: true,
  photo: "small",
  photoShape: "rounded",
  extraPrices: "included",
  totals: "rule",
  corners: "soft",
};

export type StarterKey = "classic" | "modern" | "warm" | "bold" | "soft";

export type Starter = { key: StarterKey; name: string; description: string; spec: ThemeSpec };

/** The starter themes, in the order they are offered. Read-only: use one, or remix it into your own. */
export const STARTERS: readonly Starter[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Clean and simple, black on white.",
    spec: { ...BLANK_SPEC },
  },
  {
    key: "modern",
    name: "Modern",
    description: "Light and airy, with a thin line of colour.",
    spec: { ...BLANK_SPEC, accent: "#0f766e", header: "bar", rows: "none", corners: "square", photoShape: "square" },
  },
  {
    key: "warm",
    name: "Warm",
    description: "Cream paper and serif headings, soft and personal.",
    spec: { ...BLANK_SPEC, accent: "#b45309", paper: "#fbf7f0", headingFont: "serif", header: "bar", tableHead: "tint", totals: "tint" },
  },
  {
    key: "bold",
    name: "Bold",
    description: "A solid band of colour at the top and strong totals.",
    spec: { ...BLANK_SPEC, accent: "#1e3a8a", header: "band", tableHead: "filled", rows: "zebra", totals: "solid", corners: "square", photoShape: "square" },
  },
  {
    key: "soft",
    name: "Soft",
    description: "Rounded and gentle, with light tinted blocks.",
    spec: { ...BLANK_SPEC, accent: "#be185d", paper: "#fdf5f8", tableHead: "tint", rows: "none", totals: "tint", corners: "round" },
  },
];

export const DEFAULT_STARTER: StarterKey = "classic";

export const isStarterKey = (value: unknown): value is StarterKey => STARTERS.some((s) => s.key === value);

export function starter(key: StarterKey | string | null | undefined): Starter {
  return STARTERS.find((s) => s.key === key) ?? STARTERS[0];
}

/**
 * Whatever came from the database or the browser, as a whole spec: unknown values are dropped (the part
 * takes `base`'s value), colours are only ever "#rrggbb", so nothing else can get through.
 */
export function parseSpec(raw: unknown, base: ThemeSpec = BLANK_SPEC): ThemeSpec {
  const r = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...base };
  for (const name of ["accent", "paper", "gradientTo"] as const) {
    const colour = normaliseColour(r[name]);
    if (colour) out[name] = colour;
  }
  for (const name of Object.keys(LISTS) as ChoiceName[]) {
    const value = r[name];
    if (typeof value === "string" && LISTS[name].includes(value)) out[name] = value;
  }
  for (const name of ["headingFont", "bodyFont"] as const) {
    if (isFontId(r[name])) out[name] = r[name];
  }
  for (const name of BOOLEAN_PARTS) {
    if (typeof r[name] === "boolean") out[name] = r[name];
  }
  if (r.backgroundImageId === null) out.backgroundImageId = null;
  else if (isImageId(r.backgroundImageId)) out.backgroundImageId = r.backgroundImageId.toLowerCase();
  // The first themes called the boxed-in table "grid": a table with every cell outlined is the spreadsheet,
  // anything else with outlined rows is the boxed rows.
  if (r.rows === "grid") out.rows = out.layout === "table" ? "sheet" : "boxed";
  return out as ThemeSpec;
}

/** Are these two specs the same look? */
export function sameSpec(a: ThemeSpec, b: ThemeSpec): boolean {
  return (Object.keys(BLANK_SPEC) as (keyof ThemeSpec)[]).every((k) => a[k] === b[k]);
}

// ---------------------------------------------------------------------------
// The resolved theme: everything the PDF needs, nothing to look up
// ---------------------------------------------------------------------------

export type Theme = Omit<ThemeSpec, "accent" | "paper" | "corners"> & {
  /** The theme's name, for showing (empty for a version sent before themes had names). */
  name: string;
  /** Corner radius in points. */
  radius: number;
  paper: string;
  ink: string;
  muted: string;
  line: string;
  /** The accent as chosen. */
  accent: string;
  /** Text on the accent (white or black, whichever reads). */
  onAccent: string;
  /** The accent as text or a thin rule on the paper and on the tint: darkened or lightened when the colour alone would be hard to read. */
  accentInk: string;
  /** A light wash of the accent for blocks and shaded rows. */
  tint: string;
  tintStrong: string;
};

const RADIUS: Record<Corners, number> = { square: 0, soft: 4, round: 10 };

/**
 * The colour a gradient really ends in: the one chosen, or, when the two ends are too different for any
 * one text colour to read on both (white to charcoal), a gentler one, made by easing it towards the start
 * until text reads across the whole page.
 */
export function fitGradientEnd(paper: string, to: string): string {
  let end = to;
  for (let step = 0; step < 20; step++) {
    const tone = mix(end, paper, 0.5);
    const ink = onColour(tone) === WHITE ? "#f5f5f5" : INK;
    if (contrast(ink, paper) >= 4.5 && contrast(ink, end) >= 4.5) return end;
    end = mix(paper, end, 0.15);
  }
  return paper;
}

/** A spec as the plain values the document is drawn from. */
export function resolveTheme(spec: ThemeSpec, name = ""): Theme {
  const { accent, paper, corners, ...parts } = spec;
  // The gradient, eased if its ends are too far apart for text to read on both.
  const gradientTo = spec.background === "gradient" ? fitGradientEnd(paper, spec.gradientTo) : spec.gradientTo;
  // What text sits on: the paper, or the middle of a gradient (soft colours read best across both ends).
  const tone = spec.background === "gradient" ? mix(gradientTo, paper, 0.5) : paper;
  const lightText = onColour(tone) === WHITE;
  // Near-black, or near-white on a dark paper; pushed further if a mid-tone paper needs it to read.
  const ink = readableOn(tone, lightText ? "#f5f5f5" : INK, 4.5, lightText);
  const neutral = accent === INK && paper === WHITE;
  // An accent that all but disappears into the paper (black on a dark paper) is drawn in the text colour instead.
  const fill = contrast(accent, tone) < 1.8 ? ink : accent;
  // A light wash of the accent over the paper; on a mid-tone paper it is made fainter until text still reads on it.
  let wash = neutral ? 0.05 : 0.1;
  let tint = mix(fill, tone, wash);
  const strongest = lightText ? "#ffffff" : "#000000";
  while (wash > 0 && contrast(strongest, tint) < 4.5) {
    wash = Math.max(0, wash - 0.01);
    tint = mix(fill, tone, wash);
  }
  return {
    ...parts,
    gradientTo,
    name,
    radius: RADIUS[corners],
    paper,
    ink,
    // Softer than the text, but never so soft it stops reading on a mid-tone paper.
    muted: readableOn(tone, mix(ink, tone, 0.67), 4.5, lightText),
    line: mix(ink, tone, 0.16),
    accent: fill,
    onAccent: onColour(fill),
    // Dark enough (or light enough, on dark paper) to read on the tint too.
    accentInk: readableOn([tone, tint], fill, 4.5, lightText),
    tint,
    tintStrong: mix(fill, tone, 0.06),
  };
}

/** The spec a resolved theme was made from (for editing a copy of a version's look). */
export function specOf(theme: Theme): ThemeSpec {
  const corners = (Object.entries(RADIUS).find(([, r]) => r === theme.radius)?.[0] ?? "soft") as Corners;
  const { accent, paper, background, gradientTo, gradientDirection, backgroundImageId, imageStrength, headingFont, bodyFont, header, headerLogo, headerAlign, layout, tableHead, rows, density, showQty, showUnitPrice, numbered, descriptions, photo, photoShape, extraPrices, totals } = theme;
  return { accent, paper, background, gradientTo, gradientDirection, backgroundImageId, imageStrength, headingFont, bodyFont, header, headerLogo, headerAlign, layout, tableHead, rows, density, showQty, showUnitPrice, numbered, descriptions, photo, photoShape, extraPrices, totals, corners };
}

/** Is this stored value a theme we can draw from? (A snapshot is ours, but never assume.) */
export function isTheme(value: unknown): value is Theme {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  const hex = (v: unknown) => typeof v === "string" && HEX.test(v);
  return (
    (Object.keys(LISTS) as ChoiceName[]).every((n) => n === "corners" || (typeof t[n] === "string" && LISTS[n].includes(t[n] as string))) &&
    isFontId(t.headingFont) &&
    isFontId(t.bodyFont) &&
    BOOLEAN_PARTS.every((n) => typeof t[n] === "boolean") &&
    (t.backgroundImageId === null || isImageId(t.backgroundImageId)) &&
    typeof t.radius === "number" &&
    typeof t.name === "string" &&
    [t.paper, t.ink, t.muted, t.line, t.accent, t.onAccent, t.accentInk, t.tint, t.tintStrong, t.gradientTo].every(hex)
  );
}

/**
 * The theme to draw a stored version with. Versions sent before a part existed are upgraded: the parts
 * they had are kept, with their own colours exactly, and the new parts take the plain values that draw
 * them the same way (picture corners can differ by a point or two). That covers the themes of the first
 * release (fonts "sans" and "serif" are still those two fonts, the "grid" rows became the spreadsheet or
 * the boxed rows, there was no background) and the very first designs (a resolved theme with a design's
 * key, or only a design's name). Anything unreadable is the Classic starter.
 */
export function themeFromStored(stored: { theme?: unknown; design?: string } | null | undefined): Theme {
  const t = stored?.theme;
  if (isTheme(t)) return t;
  if (typeof t === "object" && t !== null) {
    const old = t as Record<string, unknown>;
    // The first release of themes: a whole theme without the background parts, perhaps with "grid" rows.
    if (typeof old.layout === "string") {
      const next: Record<string, unknown> = {
        background: "paper",
        gradientTo: BLANK_SPEC.gradientTo,
        gradientDirection: "down",
        backgroundImageId: null,
        imageStrength: "soft",
        // Before options existed there was nothing to show separately.
        extraPrices: "included",
        ...old,
      };
      if (old.rows === "grid") next.rows = old.layout === "table" ? "sheet" : "boxed";
      if (isTheme(next)) return next;
    }
    const legacy = LEGACY_STARTERS[String(old.key)];
    if (legacy && [old.accent, old.paper].every((v) => typeof v === "string" && HEX.test(v))) {
      // The first designs' parts, mapped onto the whole spec.
      const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
        typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
      const spec: ThemeSpec = {
        ...BLANK_SPEC,
        accent: old.accent as string,
        paper: old.paper as string,
        headingFont: old.headingFont === "serif" ? "serif" : "sans",
        header: pick(HEADERS, old.header, "plain"),
        tableHead: pick(TABLE_HEADS, old.tableHead, "line"),
        rows: pick(ROWS, old.rows, "lines"),
        totals: pick(TOTALS, old.totals, "rule"),
        corners: typeof old.radius === "number" ? (old.radius === 0 ? "square" : old.radius >= 10 ? "round" : "soft") : "soft",
        // Pictures in the first designs followed the corners: square on the square ones, rounded otherwise.
        photoShape: old.radius === 0 ? "square" : "rounded",
      };
      // Keep the exact colours that version was drawn with.
      const kept: Partial<Theme> = {};
      for (const name of ["ink", "muted", "line", "onAccent", "accentInk", "tint", "tintStrong"] as const) {
        if (typeof old[name] === "string" && HEX.test(old[name] as string)) kept[name] = old[name] as string;
      }
      return { ...resolveTheme(spec, legacy), ...kept };
    }
  }
  const named = starter(stored?.design);
  return resolveTheme(named.spec, named.name);
}

const LEGACY_STARTERS: Record<string, string> = { classic: "Classic", modern: "Modern", warm: "Warm", bold: "Bold", soft: "Soft" };

// ---------------------------------------------------------------------------
// Which theme a quote uses
// ---------------------------------------------------------------------------

/** A business's own saved theme. */
export type SavedTheme = { id: string; name: string; spec: ThemeSpec };

/** A pointer to a theme: one of the business's own (an id) or a starter; neither means "not chosen". */
export type ThemeRef = { id: string | null; starter: StarterKey | null };

export const NO_THEME: ThemeRef = { id: null, starter: null };

export const hasRef = (ref: ThemeRef) => ref.id !== null || ref.starter !== null;

/** Is `ref` this saved theme or starter? */
export const sameRef = (a: ThemeRef, b: ThemeRef) => a.id === b.id && a.starter === b.starter;

/**
 * The theme a quote uses: its own pick, else Classic. (A new quote is given the theme last chosen when it
 * is created, so a quote without one is an old one.) A pick that no longer exists (its theme was
 * deleted) counts as not chosen.
 */
export function chooseTheme(own: ThemeRef, saved: readonly SavedTheme[]): { ref: ThemeRef; name: string; spec: ThemeSpec } {
  if (own.id !== null) {
    const s = saved.find((t) => t.id === own.id);
    if (s) return { ref: { id: s.id, starter: null }, name: s.name, spec: s.spec };
  } else if (own.starter !== null) {
    const s = starter(own.starter);
    return { ref: { id: null, starter: s.key }, name: s.name, spec: s.spec };
  }
  const classic = starter(DEFAULT_STARTER);
  return { ref: { id: null, starter: classic.key }, name: classic.name, spec: classic.spec };
}

export const THEME_NAME_MAX = 40;

/** A theme's name as typed, tidied (extra spaces gone), or null when it is empty or too long. */
export function themeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= THEME_NAME_MAX ? name : null;
}
