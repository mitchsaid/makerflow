import "server-only";
import sharp from "sharp";
import type { DemoKind } from "./index";

/**
 * The made-up logo of a demo business: a simple mark drawn with shapes on a colour, as a PNG. Shapes, not letters:
 * a server without fonts draws no text, and a demo must look the same everywhere. The business's own pictures are
 * processed and stored the usual way (lib/images); this only makes the bytes.
 */
const MARKS: Record<DemoKind, (fg: string) => string> = {
  // A cupcake: a swirl on a paper case.
  baker: (fg) =>
    `<circle cx="300" cy="215" r="105" fill="${fg}"/><circle cx="300" cy="140" r="55" fill="${fg}"/><circle cx="300" cy="100" r="22" fill="${fg}"/><path d="M175 300 L425 300 L385 465 L215 465 Z" fill="${fg}" opacity="0.75"/>`,
  // The rings of a tree.
  woodworker: (fg) =>
    `<circle cx="300" cy="300" r="190" fill="none" stroke="${fg}" stroke-width="26"/><circle cx="300" cy="300" r="125" fill="none" stroke="${fg}" stroke-width="26"/><circle cx="300" cy="300" r="60" fill="${fg}"/>`,
  // A needle with a loop of thread.
  seamstress: (fg) =>
    `<path d="M170 470 L430 130" stroke="${fg}" stroke-width="22" stroke-linecap="round"/><ellipse cx="418" cy="150" rx="16" ry="38" transform="rotate(36 418 150)" fill="none" stroke="${fg}" stroke-width="14"/><path d="M170 470 C 120 400, 260 420, 230 330 S 340 280, 300 210" fill="none" stroke="${fg}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>`,
  // A vase.
  ceramicist: (fg) =>
    `<path d="M250 110 L350 110 L335 190 C 440 250, 440 400, 350 480 L250 480 C 160 400, 160 250, 265 190 Z" fill="${fg}"/><rect x="238" y="82" width="124" height="30" rx="12" fill="${fg}" opacity="0.8"/>`,
};

export async function demoLogoPng(kind: DemoKind, colours: { background: string; foreground: string }): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" rx="120" fill="${colours.background}"/>${MARKS[kind](colours.foreground)}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
