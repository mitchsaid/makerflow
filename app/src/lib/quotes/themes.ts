/**
 * Quote themes. A theme is a complete, named look a business owns (a "spec": every part has a value,
 * nothing is "the default with changes"). Five starters ship with the app and can be used or remixed;
 * a maker's own themes are saved per business. `resolveTheme` turns a spec into the plain values the
 * PDF and the miniatures are drawn from, and a sent version stores that resolved theme, so a quote
 * never changes when a theme is edited later.
 *
 * Plain data and small functions, safe for the browser (the studio draws the same choices).
 */

// ---------------------------------------------------------------------------
// The parts, and the choices each one has
// ---------------------------------------------------------------------------

export const FONTS = ["sans", "serif"] as const;
export const HEADERS = ["plain", "bar", "band", "boxed"] as const;
export const LOGO_MODES = ["both", "logo", "name"] as const;
export const ALIGNS = ["left", "center"] as const;
export const LAYOUTS = ["table", "list", "cards", "showcase"] as const;
export const TABLE_HEADS = ["line", "tint", "filled", "none"] as const;
export const ROWS = ["lines", "zebra", "grid", "none"] as const;
export const DENSITIES = ["compact", "comfortable", "airy"] as const;
export const PHOTOS = ["none", "small", "large"] as const;
export const PHOTO_SHAPES = ["square", "rounded", "round"] as const;
export const TOTALS = ["rule", "tint", "solid", "pill"] as const;
export const CORNERS = ["square", "soft", "round"] as const;

export type Font = (typeof FONTS)[number];
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

/** Every part of a theme. All present, always: a theme is whole. */
export type ThemeSpec = {
  /** "#rrggbb". */
  accent: string;
  /** The paper's colour, "#rrggbb" (text turns white on a dark one). */
  paper: string;
  headingFont: Font;
  bodyFont: Font;
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
  totals: TotalsStyle;
  corners: Corners;
};

export const BOOLEAN_PARTS = ["showQty", "showUnitPrice", "numbered", "descriptions"] as const;

/** The words the studio uses for each choice, in the order shown. */
export const CHOICES = {
  headingFont: { label: "Headings", options: [["sans", "Clean"], ["serif", "Serif"]] },
  bodyFont: { label: "Text", options: [["sans", "Clean"], ["serif", "Serif"]] },
  header: { label: "Top of the page", options: [["plain", "Plain"], ["bar", "Line of colour"], ["band", "Band of colour"], ["boxed", "Boxed"]] },
  headerLogo: { label: "Logo", options: [["both", "Logo and name"], ["logo", "Logo only"], ["name", "Name only"]] },
  headerAlign: { label: "Alignment", options: [["left", "Left"], ["center", "Centred"]] },
  layout: { label: "How items are shown", options: [["table", "Table"], ["list", "List"], ["cards", "Cards"], ["showcase", "Showcase"]] },
  tableHead: { label: "Table heading", options: [["line", "A line"], ["tint", "Light colour"], ["filled", "Solid colour"], ["none", "None"]] },
  rows: { label: "Table rows", options: [["lines", "Lines between"], ["zebra", "Alternating shade"], ["grid", "Full grid"], ["none", "Just space"]] },
  density: { label: "Spacing", options: [["compact", "Compact"], ["comfortable", "Comfortable"], ["airy", "Airy"]] },
  photo: { label: "Product photos", options: [["none", "None"], ["small", "Small"], ["large", "Large"]] },
  photoShape: { label: "Photo shape", options: [["square", "Square"], ["rounded", "Rounded"], ["round", "Round"]] },
  totals: { label: "Total", options: [["rule", "A line"], ["tint", "Light box"], ["solid", "Solid box"], ["pill", "Pill"]] },
  corners: { label: "Corners", options: [["square", "Square"], ["soft", "Soft"], ["round", "Round"]] },
} as const satisfies Record<string, { label: string; options: readonly (readonly [string, string])[] }>;

export type ChoiceName = keyof typeof CHOICES;

const LISTS: Record<ChoiceName, readonly string[]> = {
  headingFont: FONTS,
  bodyFont: FONTS,
  header: HEADERS,
  headerLogo: LOGO_MODES,
  headerAlign: ALIGNS,
  layout: LAYOUTS,
  tableHead: TABLE_HEADS,
  rows: ROWS,
  density: DENSITIES,
  photo: PHOTOS,
  photoShape: PHOTO_SHAPES,
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

/** The colour itself if it reads as text on `paper`, else a shade of it that does (darker on a light paper, lighter on a dark one). */
export function readableOn(paper: string, colour: string, ratio = 4.5): string {
  let c = colour;
  const towards = luminance(paper) > 0.4 ? "#000000" : "#ffffff";
  for (let step = 0; step < 20 && contrast(c, paper) < ratio; step++) c = mix(towards, c, 0.1);
  return c;
}

// ---------------------------------------------------------------------------
// Specs: the starters, a blank, and reading one safely
// ---------------------------------------------------------------------------

/** A plain base to start from scratch: black and white, a simple table, nothing decorative. */
export const BLANK_SPEC: ThemeSpec = {
  accent: "#1a1a1a",
  paper: "#ffffff",
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
  const accent = normaliseColour(r.accent);
  if (accent) out.accent = accent;
  const paper = normaliseColour(r.paper);
  if (paper) out.paper = paper;
  for (const name of Object.keys(LISTS) as ChoiceName[]) {
    const value = r[name];
    if (typeof value === "string" && LISTS[name].includes(value)) out[name] = value;
  }
  for (const name of BOOLEAN_PARTS) {
    if (typeof r[name] === "boolean") out[name] = r[name];
  }
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

/** A spec as the plain values the document is drawn from. */
export function resolveTheme(spec: ThemeSpec, name = ""): Theme {
  const { accent, paper, corners, ...parts } = spec;
  const ink = onColour(paper) === WHITE ? "#f5f5f5" : INK; // near-black, or near-white on a dark paper
  const neutral = accent === INK && paper === WHITE;
  const tint = mix(accent, paper, neutral ? 0.05 : 0.1);
  return {
    ...parts,
    name,
    radius: RADIUS[corners],
    paper,
    ink,
    muted: mix(ink, paper, 0.67),
    line: mix(ink, paper, 0.16),
    accent,
    onAccent: onColour(accent),
    // Dark enough (or light enough, on dark paper) to read on the tint too.
    accentInk: readableOn(tint, accent),
    tint,
    tintStrong: mix(accent, paper, 0.06),
  };
}

/** The spec a resolved theme was made from (for editing a copy of a version's look). */
export function specOf(theme: Theme): ThemeSpec {
  const corners = (Object.entries(RADIUS).find(([, r]) => r === theme.radius)?.[0] ?? "soft") as Corners;
  const { accent, paper, headingFont, bodyFont, header, headerLogo, headerAlign, layout, tableHead, rows, density, showQty, showUnitPrice, numbered, descriptions, photo, photoShape, totals } = theme;
  return { accent, paper, headingFont, bodyFont, header, headerLogo, headerAlign, layout, tableHead, rows, density, showQty, showUnitPrice, numbered, descriptions, photo, photoShape, totals, corners };
}

/** Is this stored value a theme we can draw from? (A snapshot is ours, but never assume.) */
export function isTheme(value: unknown): value is Theme {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  const hex = (v: unknown) => typeof v === "string" && HEX.test(v);
  return (
    (Object.keys(LISTS) as ChoiceName[]).every((n) => n === "corners" || (typeof t[n] === "string" && LISTS[n].includes(t[n] as string))) &&
    BOOLEAN_PARTS.every((n) => typeof t[n] === "boolean") &&
    typeof t.radius === "number" &&
    typeof t.name === "string" &&
    [t.paper, t.ink, t.muted, t.line, t.accent, t.onAccent, t.accentInk, t.tint, t.tintStrong].every(hex)
  );
}

/**
 * The theme to draw a stored version with. A version sent with the first designs (a resolved theme with
 * the old parts, or only a design's name) is upgraded: the parts it had are kept and the new ones take
 * the plain values that draw it exactly as it was drawn. Anything unreadable is the Classic starter.
 */
export function themeFromStored(stored: { theme?: unknown; design?: string } | null | undefined): Theme {
  const t = stored?.theme;
  if (isTheme(t)) return t;
  if (typeof t === "object" && t !== null) {
    const old = t as Record<string, unknown>;
    const legacy = LEGACY_STARTERS[String(old.key)];
    if (legacy && [old.accent, old.paper].every((v) => typeof v === "string" && HEX.test(v))) {
      // The first designs' parts, mapped onto the whole spec.
      const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
        typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;
      const spec: ThemeSpec = {
        ...BLANK_SPEC,
        accent: old.accent as string,
        paper: old.paper as string,
        headingFont: pick(FONTS, old.headingFont, "sans"),
        header: pick(HEADERS, old.header, "plain"),
        tableHead: pick(TABLE_HEADS, old.tableHead, "line"),
        rows: pick(ROWS, old.rows, "lines"),
        totals: pick(TOTALS, old.totals, "rule"),
        corners: typeof old.radius === "number" ? (old.radius === 0 ? "square" : old.radius >= 10 ? "round" : "soft") : "soft",
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
 * The theme a quote uses: its own pick, else the business's default, else Classic. A pick that no
 * longer exists (its theme was deleted) counts as not chosen. `following` says the quote follows the
 * default (it has no pick of its own).
 */
export function chooseTheme(
  own: ThemeRef,
  usual: ThemeRef,
  saved: readonly SavedTheme[],
): { ref: ThemeRef; name: string; spec: ThemeSpec; following: boolean } {
  const found = (ref: ThemeRef) => {
    if (ref.id !== null) {
      const s = saved.find((t) => t.id === ref.id);
      return s ? { ref: { id: s.id, starter: null }, name: s.name, spec: s.spec } : null;
    }
    if (ref.starter !== null) {
      const s = starter(ref.starter);
      return { ref: { id: null, starter: s.key }, name: s.name, spec: s.spec };
    }
    return null;
  };
  const mine = found(own);
  if (mine) return { ...mine, following: false };
  const usually = found(usual);
  if (usually) return { ...usually, following: true };
  const classic = starter(DEFAULT_STARTER);
  return { ref: { id: null, starter: classic.key }, name: classic.name, spec: classic.spec, following: true };
}

export const THEME_NAME_MAX = 40;

/** A theme's name as typed, tidied (extra spaces gone), or null when it is empty or too long. */
export function themeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= THEME_NAME_MAX ? name : null;
}
