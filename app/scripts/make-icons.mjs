// Draws the app icons (public/icons/*.png) from shapes, so they need no fonts and look the same everywhere.
// Run when the mark or the colours change: `node scripts/make-icons.mjs`. The PNGs are committed.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BACKGROUND = "#a94f33"; // --primary in globals.css
const FOREGROUND = "#faf8f5"; // --background

// An "M" (the start of MakerFlow) drawn as one rounded stroke, centred in a 512 box; `scale` shrinks it toward the middle
// (a maskable icon keeps its mark inside the middle 80%, because phones crop the corners).
const mark = (scale) => {
  const s = (v) => 256 + (v - 256) * scale;
  const points = [[132, 372], [132, 150], [256, 292], [380, 150], [380, 372]].map(([x, y]) => `${s(x)},${s(y)}`).join(" ");
  return `<polyline points="${points}" fill="none" stroke="${FOREGROUND}" stroke-width="${46 * scale}" stroke-linecap="round" stroke-linejoin="round"/>`;
};

// "rounded": the icon is a rounded square on a transparent background (the browser's tab or a desktop dock);
// full-bleed: the whole square is the colour, for phones that round or crop it themselves.
const svg = (rounded, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="${BACKGROUND}"/>${mark(scale)}</svg>`;

mkdirSync("public/icons", { recursive: true });
const write = (name, size, rounded, scale) => sharp(Buffer.from(svg(rounded, scale))).resize(size, size).png().toFile(`public/icons/${name}`);

await Promise.all([
  write("icon-192.png", 192, true, 1),
  write("icon-512.png", 512, true, 1),
  write("icon-maskable-512.png", 512, false, 0.8),
  write("apple-touch-icon.png", 180, false, 0.9),
]);
console.log("icons written to public/icons");
