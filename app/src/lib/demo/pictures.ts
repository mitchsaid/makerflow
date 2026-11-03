import "server-only";
import sharp from "sharp";

/**
 * The made-up pictures of a demo's products (docs/plans/home-and-demo-polish.md): a simple object drawn with shapes on
 * a soft colour, as a PNG, in the same spirit as the logo (`logo.ts`). Shapes, not photographs and not letters: a
 * server without fonts or a photo library draws exactly the same thing everywhere, and nothing here is anyone's real
 * product. They are processed and stored the usual way (`lib/images`); this only makes the bytes.
 */
export type PictureMotif = "cake" | "cupcake" | "loaf" | "box" | "table" | "bench" | "board" | "dress" | "cushion" | "set" | "vase" | "mug";
export type DemoPicture = { motif: PictureMotif; background: string; foreground: string };

const DRAW: Record<PictureMotif, (fg: string, bg: string) => string> = {
  // Three tiers on a plate, with a candle.
  cake: (fg) =>
    `<rect x="90" y="486" width="420" height="22" rx="11" fill="${fg}" opacity="0.5"/><rect x="120" y="376" width="360" height="110" rx="20" fill="${fg}"/><rect x="170" y="286" width="260" height="96" rx="20" fill="${fg}" opacity="0.8"/><rect x="220" y="206" width="160" height="86" rx="20" fill="${fg}" opacity="0.6"/><rect x="290" y="140" width="20" height="66" rx="8" fill="${fg}"/><circle cx="300" cy="120" r="18" fill="${fg}" opacity="0.8"/>`,
  // A swirl on a paper case.
  cupcake: (fg) =>
    `<circle cx="300" cy="225" r="110" fill="${fg}"/><circle cx="300" cy="145" r="58" fill="${fg}"/><circle cx="300" cy="102" r="24" fill="${fg}"/><path d="M170 310 L430 310 L388 480 L212 480 Z" fill="${fg}" opacity="0.7"/>`,
  // A round loaf with scoring.
  loaf: (fg, bg) =>
    `<path d="M95 420 C95 255 215 185 300 185 S505 255 505 420 Z" fill="${fg}"/><path d="M215 250 L255 330 M290 235 L330 325 M365 250 L400 330" stroke="${bg}" stroke-width="16" stroke-linecap="round" opacity="0.7"/><rect x="95" y="410" width="410" height="26" rx="13" fill="${fg}" opacity="0.7"/>`,
  // A tasting box with a ribbon.
  box: (fg, bg) =>
    `<rect x="125" y="300" width="350" height="190" rx="18" fill="${fg}"/><rect x="105" y="236" width="390" height="80" rx="18" fill="${fg}" opacity="0.75"/><rect x="284" y="236" width="32" height="254" fill="${bg}" opacity="0.55"/><circle cx="262" cy="206" r="30" fill="none" stroke="${fg}" stroke-width="16"/><circle cx="338" cy="206" r="30" fill="none" stroke="${fg}" stroke-width="16"/>`,
  // A table: top, apron and legs.
  table: (fg) =>
    `<rect x="85" y="225" width="430" height="44" rx="12" fill="${fg}"/><rect x="160" y="269" width="280" height="28" fill="${fg}" opacity="0.7"/><rect x="130" y="269" width="36" height="215" rx="8" fill="${fg}"/><rect x="434" y="269" width="36" height="215" rx="8" fill="${fg}"/>`,
  // A bench with a back.
  bench: (fg) =>
    `<rect x="95" y="190" width="410" height="34" rx="10" fill="${fg}" opacity="0.8"/><rect x="140" y="224" width="24" height="86" fill="${fg}" opacity="0.8"/><rect x="436" y="224" width="24" height="86" fill="${fg}" opacity="0.8"/><rect x="95" y="306" width="410" height="48" rx="10" fill="${fg}"/><rect x="135" y="354" width="36" height="130" rx="8" fill="${fg}"/><rect x="429" y="354" width="36" height="130" rx="8" fill="${fg}"/>`,
  // A cutting board with a hanging hole and a juice groove.
  board: (fg, bg) =>
    `<rect x="150" y="105" width="300" height="390" rx="64" fill="${fg}"/><circle cx="300" cy="175" r="24" fill="${bg}"/><rect x="195" y="260" width="210" height="14" rx="7" fill="${bg}" opacity="0.6"/><rect x="195" y="420" width="210" height="14" rx="7" fill="${bg}" opacity="0.6"/>`,
  // A dress on a hanger line.
  dress: (fg, bg) =>
    `<path d="M255 120 L345 120 L362 250 L452 490 L148 490 L238 250 Z" fill="${fg}"/><rect x="236" y="244" width="128" height="24" fill="${bg}" opacity="0.55"/><path d="M262 120 C262 78 338 78 338 120" fill="none" stroke="${fg}" stroke-width="14" stroke-linecap="round"/>`,
  // A cushion with a button.
  cushion: (fg, bg) =>
    `<rect x="120" y="170" width="360" height="360" rx="70" fill="${fg}"/><circle cx="300" cy="350" r="22" fill="${bg}"/><path d="M300 350 L160 210 M300 350 L440 210 M300 350 L160 490 M300 350 L440 490" stroke="${bg}" stroke-width="8" stroke-linecap="round" opacity="0.35"/>`,
  // A dinner setting: plate with a bowl.
  set: (fg, bg) =>
    `<circle cx="300" cy="300" r="205" fill="${fg}"/><circle cx="300" cy="300" r="150" fill="${bg}"/><circle cx="300" cy="300" r="92" fill="${fg}" opacity="0.65"/>`,
  // A vase.
  vase: (fg) =>
    `<path d="M250 110 L350 110 L335 190 C 440 250, 440 400, 350 490 L250 490 C 160 400, 160 250, 265 190 Z" fill="${fg}"/><rect x="238" y="82" width="124" height="30" rx="12" fill="${fg}" opacity="0.75"/>`,
  // A mug with a handle and steam.
  mug: (fg) =>
    `<rect x="150" y="215" width="250" height="260" rx="38" fill="${fg}"/><circle cx="410" cy="338" r="72" fill="none" stroke="${fg}" stroke-width="36"/><path d="M240 165 C 220 135, 260 120, 240 90 M310 165 C 290 135, 330 120, 310 90" fill="none" stroke="${fg}" stroke-width="12" stroke-linecap="round" opacity="0.6"/>`,
};

export async function demoProductPng(picture: DemoPicture): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="${picture.background}"/>${DRAW[picture.motif](picture.foreground, picture.background)}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
