import { Font } from "@react-pdf/renderer";
import { NOTO_SANS_BOLD } from "./fonts/noto-sans-bold";
import { NOTO_SANS_RANGES } from "./fonts/noto-sans-ranges";
import { NOTO_SANS_REGULAR } from "./fonts/noto-sans-regular";
import { NOTO_SERIF_BOLD } from "./fonts/noto-serif-bold";
import { NOTO_SERIF_REGULAR } from "./fonts/noto-serif-regular";

import { isFontId } from "../font-list";
import { MISSING_LETTERS } from "./fonts/missing";

export const PDF_FONT = "Noto Sans";
/** The serif face some designs use for headings. Same letters covered as the sans (see the font files). */
export const PDF_FONT_SERIF = "Noto Serif";

/** The family name a font id is registered under (the Noto pair keep their long-standing names). */
export function pdfFamily(id: string): string {
  if (id === "sans") return PDF_FONT;
  if (id === "serif") return PDF_FONT_SERIF;
  return `mf-${isFontId(id) ? id : "sans"}`;
}

let basics = false;
const loading = new Map<string, Promise<void>>();

/** Registers the two Noto fonts that always ship, once per process. */
function registerBasics() {
  if (basics) return;
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: NOTO_SANS_REGULAR, fontWeight: 400 },
      { src: NOTO_SANS_BOLD, fontWeight: 700 },
    ],
  });
  Font.register({
    family: PDF_FONT_SERIF,
    fonts: [
      { src: NOTO_SERIF_REGULAR, fontWeight: 400 },
      { src: NOTO_SERIF_BOLD, fontWeight: 700 },
    ],
  });
  // Never break a word with a hyphen: a name or a number split across lines reads wrongly.
  Font.registerHyphenationCallback((word) => [word]);
  basics = true;
}

/** Each other font's file, loaded only when a theme uses it (every one is its own chunk). */
const LOADERS: Record<string, () => Promise<{ REGULAR: string; BOLD: string | null }>> = {
  inter: () => import("./fonts/inter"),
  poppins: () => import("./fonts/poppins"),
  montserrat: () => import("./fonts/montserrat"),
  lato: () => import("./fonts/lato"),
  raleway: () => import("./fonts/raleway"),
  nunito: () => import("./fonts/nunito"),
  "dm-sans": () => import("./fonts/dm-sans"),
  "work-sans": () => import("./fonts/work-sans"),
  playfair: () => import("./fonts/playfair"),
  lora: () => import("./fonts/lora"),
  merriweather: () => import("./fonts/merriweather"),
  cormorant: () => import("./fonts/cormorant"),
  "libre-baskerville": () => import("./fonts/libre-baskerville"),
  "roboto-slab": () => import("./fonts/roboto-slab"),
  "dm-serif": () => import("./fonts/dm-serif"),
  oswald: () => import("./fonts/oswald"),
  "dancing-script": () => import("./fonts/dancing-script"),
  pacifico: () => import("./fonts/pacifico"),
};

/**
 * Makes these fonts ready for a document (call before drawing it). The two Noto fonts are always
 * there; any other is loaded on first use and then kept. An unknown id is simply not loaded (the
 * document falls back to Noto Sans).
 */
export async function ensureFonts(ids: readonly string[]): Promise<void> {
  registerBasics();
  await Promise.all(
    [...new Set(ids)].map((id) => {
      const load = LOADERS[id];
      if (!load) return undefined;
      let ready = loading.get(id);
      if (!ready) {
        ready = load().then((file) => {
          Font.register({
            family: pdfFamily(id),
            fonts: [{ src: file.REGULAR, fontWeight: 400 }, ...(file.BOLD ? [{ src: file.BOLD, fontWeight: 700 as const }] : [])],
          });
        });
        // A failed load is not remembered: the next drawing tries again.
        ready.catch(() => loading.delete(id));
        loading.set(id, ready);
      }
      return ready;
    }),
  );
}

/** The ids that can be loaded here (a test checks every font in the list is one of them). */
export const LOADABLE_FONTS: readonly string[] = ["sans", "serif", ...Object.keys(LOADERS)];

function inRanges(ranges: readonly (readonly [number, number])[], codePoint: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [from, to] = ranges[mid];
    if (codePoint < from) high = mid - 1;
    else if (codePoint > to) low = mid + 1;
    else return true;
  }
  return false;
}

const canDraw = (codePoint: number) => inRanges(NOTO_SANS_RANGES, codePoint);

/**
 * Removes the characters the embedded font has no shape for (emoji and symbols, mostly): the
 * PDF would otherwise print a wrong glyph or a box. Letters of every South African language,
 * punctuation and currency signs are kept. New lines are kept; runs of spaces left behind
 * are tidied.
 */
export function drawable(text: string, fonts: readonly string[] = []): string {
  // Letters Noto Sans can draw but a chosen font cannot are left out too (see fonts/missing.ts).
  const gaps = fonts.flatMap((id) => (MISSING_LETTERS[id] ? [MISSING_LETTERS[id]] : []));
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n" || (canDraw(cp) && !gaps.some((g) => inRanges(g, cp)))) out += ch;
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trim();
}
