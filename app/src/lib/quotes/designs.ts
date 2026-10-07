/**
 * How a quote document looks. A design is a named set of choices for a handful of components (the
 * header, the table heading, the rows, the totals, the corners, the paper, the heading font and the
 * accent colour). A maker picks a design, can change any component on its own, and puts their brand
 * colour on it; `resolveTheme` turns all of that into one plain set of values the PDF is drawn from.
 * A sent version stores the resolved theme, so it never changes when a design or the brand colour does.
 *
 * Plain data and small functions, safe for the browser (the preview screen shows the same choices).
 */

export type DesignKey = "classic" | "modern" | "warm" | "bold" | "soft";

export const DEFAULT_DESIGN: DesignKey = "classic";

/** The five designs, in the order they are offered. */
export const DESIGNS: readonly { key: DesignKey; name: string; description: string }[] = [
  { key: "classic", name: "Classic", description: "Clean and simple, black on white." },
  { key: "modern", name: "Modern", description: "Light and airy, with a thin line of your colour." },
  { key: "warm", name: "Warm", description: "Cream paper and serif headings, soft and personal." },
  { key: "bold", name: "Bold", description: "A solid band of your colour at the top and strong totals." },
  { key: "soft", name: "Soft", description: "Rounded and gentle, with light tinted blocks." },
];

export const isDesignKey = (value: unknown): value is DesignKey => DESIGNS.some((d) => d.key === value);

// ---------------------------------------------------------------------------
// The components, and the choices each one has
// ---------------------------------------------------------------------------

export const HEADING_FONTS = ["sans", "serif"] as const;
export const HEADERS = ["plain", "bar", "band"] as const;
export const TABLE_HEADS = ["line", "tint", "filled"] as const;
export const ROWS = ["lines", "zebra", "none"] as const;
export const TOTALS = ["rule", "tint", "solid"] as const;
export const CORNERS = ["square", "soft", "round"] as const;
export const PAPERS = ["white", "tinted"] as const;

export type HeadingFont = (typeof HEADING_FONTS)[number];
export type HeaderStyle = (typeof HEADERS)[number];
export type TableHeadStyle = (typeof TABLE_HEADS)[number];
export type RowStyle = (typeof ROWS)[number];
export type TotalsStyle = (typeof TOTALS)[number];
export type Corners = (typeof CORNERS)[number];
export type Paper = (typeof PAPERS)[number];

/** The words the "make it yours" choices use, in the order shown. */
export const COMPONENT_CHOICES = {
  headingFont: { label: "Headings", options: [["sans", "Clean"], ["serif", "Classic serif"]] },
  header: { label: "Top of the page", options: [["plain", "Plain"], ["bar", "A line of colour"], ["band", "A band of colour"]] },
  tableHead: { label: "Item headings", options: [["line", "A line"], ["tint", "Light colour"], ["filled", "Solid colour"]] },
  rows: { label: "Item rows", options: [["lines", "Lines between"], ["zebra", "Alternating shade"], ["none", "Just space"]] },
  totals: { label: "Total", options: [["rule", "A line"], ["tint", "Light box"], ["solid", "Solid box"]] },
  corners: { label: "Corners", options: [["square", "Square"], ["soft", "Soft"], ["round", "Round"]] },
  paper: { label: "Paper", options: [["white", "White"], ["tinted", "Tinted"]] },
} as const satisfies Record<string, { label: string; options: readonly (readonly [string, string])[] }>;

export type ComponentName = keyof typeof COMPONENT_CHOICES;

/** What a maker (or a business default) has changed from a design's own look. Missing means "the design's own". */
export type DesignOptions = {
  /** "#rrggbb". */
  accent?: string;
  headingFont?: HeadingFont;
  header?: HeaderStyle;
  tableHead?: TableHeadStyle;
  rows?: RowStyle;
  totals?: TotalsStyle;
  corners?: Corners;
  paper?: Paper;
};

const HEX = /^#[0-9a-f]{6}$/;

/** "#ABC123" or "abc123" or "#abc" as "#aabbcc"; null when it isn't a colour. */
export function normaliseColour(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (v.startsWith("#")) v = v.slice(1);
  if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : null;
}

/**
 * Whatever came from the database or the browser, as options we know: unknown keys and values are
 * dropped, never trusted. (A colour is only ever "#rrggbb", so it can't carry anything else.)
 */
export function parseDesignOptions(raw: unknown): DesignOptions {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: DesignOptions = {};
  const accent = normaliseColour(r.accent);
  if (accent) out.accent = accent;
  const pick = <T extends string>(list: readonly T[], value: unknown): T | undefined =>
    typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : undefined;
  const headingFont = pick(HEADING_FONTS, r.headingFont);
  if (headingFont) out.headingFont = headingFont;
  const header = pick(HEADERS, r.header);
  if (header) out.header = header;
  const tableHead = pick(TABLE_HEADS, r.tableHead);
  if (tableHead) out.tableHead = tableHead;
  const rows = pick(ROWS, r.rows);
  if (rows) out.rows = rows;
  const totals = pick(TOTALS, r.totals);
  if (totals) out.totals = totals;
  const corners = pick(CORNERS, r.corners);
  if (corners) out.corners = corners;
  const paper = pick(PAPERS, r.paper);
  if (paper) out.paper = paper;
  return out;
}

// ---------------------------------------------------------------------------
// The five designs, as data
// ---------------------------------------------------------------------------

type Preset = Required<Omit<DesignOptions, "paper">> & { paper: Paper; tintedPaper: string };

export const PRESETS: Record<DesignKey, Preset> = {
  classic: {
    accent: "#1a1a1a",
    headingFont: "sans",
    header: "plain",
    tableHead: "line",
    rows: "lines",
    totals: "rule",
    corners: "soft",
    paper: "white",
    tintedPaper: "#f7f5f0",
  },
  modern: {
    accent: "#0f766e",
    headingFont: "sans",
    header: "bar",
    tableHead: "line",
    rows: "none",
    totals: "rule",
    corners: "square",
    paper: "white",
    tintedPaper: "#f4f8f7",
  },
  warm: {
    accent: "#b45309",
    headingFont: "serif",
    header: "bar",
    tableHead: "tint",
    rows: "lines",
    totals: "tint",
    corners: "soft",
    paper: "tinted",
    tintedPaper: "#fbf7f0",
  },
  bold: {
    accent: "#1e3a8a",
    headingFont: "sans",
    header: "band",
    tableHead: "filled",
    rows: "zebra",
    totals: "solid",
    corners: "square",
    paper: "white",
    tintedPaper: "#f3f5fb",
  },
  soft: {
    accent: "#be185d",
    headingFont: "sans",
    header: "plain",
    tableHead: "tint",
    rows: "none",
    totals: "tint",
    corners: "round",
    paper: "tinted",
    tintedPaper: "#fdf5f8",
  },
};

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

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
const MUTED = "#666666";
const WHITE = "#ffffff";

/** Black or white, whichever reads better on this colour. */
export function onColour(background: string): string {
  return contrast(background, WHITE) >= contrast(background, INK) ? WHITE : INK;
}

/** The colour itself if it reads as text on `paper`, else a darker shade of it that does. */
export function readableOn(paper: string, colour: string, ratio = 4.5): string {
  let c = colour;
  // Ten per cent blacker each time, until it reads.
  for (let step = 0; step < 20 && contrast(c, paper) < ratio; step++) c = mix("#000000", c, 0.1);
  return c;
}

// ---------------------------------------------------------------------------
// The resolved theme: everything the PDF needs, nothing to look up
// ---------------------------------------------------------------------------

export type Theme = {
  key: DesignKey;
  headingFont: HeadingFont;
  header: HeaderStyle;
  tableHead: TableHeadStyle;
  rows: RowStyle;
  totals: TotalsStyle;
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
  /** The accent as text or a thin rule on the paper: darkened when the colour alone would be hard to read. */
  accentInk: string;
  /** A light wash of the accent for blocks and shaded rows, and the text on it. */
  tint: string;
  tintStrong: string;
};

const RADIUS: Record<Corners, number> = { square: 0, soft: 4, round: 10 };

/**
 * A design, the brand colour, and what the maker changed, as one theme. The accent comes from
 * (in this order) the quote's own choice, the business's brand colour, the design's own colour.
 */
export function resolveTheme(key: DesignKey | string | undefined, options: DesignOptions = {}, brandColour: string | null = null): Theme {
  const design = isDesignKey(key) ? key : DEFAULT_DESIGN;
  const preset = PRESETS[design];
  const accent = normaliseColour(options.accent) ?? normaliseColour(brandColour) ?? preset.accent;
  const paperChoice = options.paper ?? preset.paper;
  const paper = paperChoice === "tinted" ? preset.tintedPaper : WHITE;
  const tint = mix(accent, paper, design === "classic" && !options.accent && !brandColour ? 0.05 : 0.1);
  return {
    key: design,
    headingFont: options.headingFont ?? preset.headingFont,
    header: options.header ?? preset.header,
    tableHead: options.tableHead ?? preset.tableHead,
    rows: options.rows ?? preset.rows,
    totals: options.totals ?? preset.totals,
    radius: RADIUS[options.corners ?? preset.corners],
    paper,
    ink: INK,
    muted: MUTED,
    line: mix(INK, paper, 0.16),
    accent,
    onAccent: onColour(accent),
    // Dark enough to read on the tint too (the tint is a little darker than the paper).
    accentInk: readableOn(tint, accent),
    tint,
    tintStrong: mix(accent, paper, 0.06),
  };
}

/** Is this stored value a theme we can draw from? (A snapshot is ours, but never assume.) */
export function isTheme(value: unknown): value is Theme {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  const hex = (v: unknown) => typeof v === "string" && HEX.test(v);
  return (
    isDesignKey(t.key) &&
    (HEADING_FONTS as readonly unknown[]).includes(t.headingFont) &&
    (HEADERS as readonly unknown[]).includes(t.header) &&
    (TABLE_HEADS as readonly unknown[]).includes(t.tableHead) &&
    (ROWS as readonly unknown[]).includes(t.rows) &&
    (TOTALS as readonly unknown[]).includes(t.totals) &&
    typeof t.radius === "number" &&
    [t.paper, t.ink, t.muted, t.line, t.accent, t.onAccent, t.accentInk, t.tint, t.tintStrong].every(hex)
  );
}

/** The theme to draw a snapshot with: its own frozen one, else the design it names, else classic. */
export function themeFor(snapshot: { theme?: unknown; design?: string }): Theme {
  return isTheme(snapshot.theme) ? snapshot.theme : resolveTheme(snapshot.design as DesignKey | undefined);
}
