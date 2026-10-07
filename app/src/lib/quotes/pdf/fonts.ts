import { Font } from "@react-pdf/renderer";
import { NOTO_SANS_BOLD } from "./fonts/noto-sans-bold";
import { NOTO_SANS_RANGES } from "./fonts/noto-sans-ranges";
import { NOTO_SANS_REGULAR } from "./fonts/noto-sans-regular";
import { NOTO_SERIF_BOLD } from "./fonts/noto-serif-bold";
import { NOTO_SERIF_REGULAR } from "./fonts/noto-serif-regular";

export const PDF_FONT = "Noto Sans";
/** The serif face some designs use for headings. Same letters covered as the sans (see the font files). */
export const PDF_FONT_SERIF = "Noto Serif";

let registered = false;

/** Registers the embedded font once per process. */
export function registerPdfFonts() {
  if (registered) return;
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
  registered = true;
}

function canDraw(codePoint: number): boolean {
  let low = 0;
  let high = NOTO_SANS_RANGES.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [from, to] = NOTO_SANS_RANGES[mid];
    if (codePoint < from) high = mid - 1;
    else if (codePoint > to) low = mid + 1;
    else return true;
  }
  return false;
}

/**
 * Removes the characters the embedded font has no shape for (emoji and symbols, mostly): the
 * PDF would otherwise print a wrong glyph or a box. Letters of every South African language,
 * punctuation and currency signs are kept. New lines are kept; runs of spaces left behind
 * are tidied.
 */
export function drawable(text: string): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n" || canDraw(cp)) out += ch;
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").trim();
}
