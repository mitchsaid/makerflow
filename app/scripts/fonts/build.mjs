// Builds the embedded font files for quote PDFs from the @fontsource packages (dev dependencies):
//   pnpm fonts:build
// For each font in the list below it writes src/lib/quotes/pdf/fonts/<id>.ts, a module with the regular
// (and bold, where there is one) face as a WOFF in a data address, so the font travels with the code and
// is loaded only when a theme uses it (see src/lib/quotes/pdf/fonts.ts). The "latin" subset is used: it
// covers English, Afrikaans and the other South African languages written with plain Latin letters.
// Keep the ids and labels in step with src/lib/quotes/font-list.ts. All of these fonts are free to embed
// (SIL Open Font License 1.1, except Roboto Slab: Apache License 2.0); the licences ship in the packages.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../src/lib/quotes/pdf/fonts");
const modules = join(here, "../../node_modules/@fontsource");

const FONTS = [
  { id: "inter", pkg: "inter", name: "Inter", bold: true },
  { id: "poppins", pkg: "poppins", name: "Poppins", bold: true },
  { id: "montserrat", pkg: "montserrat", name: "Montserrat", bold: true },
  { id: "lato", pkg: "lato", name: "Lato", bold: true },
  { id: "raleway", pkg: "raleway", name: "Raleway", bold: true },
  { id: "nunito", pkg: "nunito", name: "Nunito", bold: true },
  { id: "dm-sans", pkg: "dm-sans", name: "DM Sans", bold: true },
  { id: "work-sans", pkg: "work-sans", name: "Work Sans", bold: true },
  { id: "playfair", pkg: "playfair-display", name: "Playfair Display", bold: true },
  { id: "lora", pkg: "lora", name: "Lora", bold: true },
  { id: "merriweather", pkg: "merriweather", name: "Merriweather", bold: true },
  { id: "cormorant", pkg: "cormorant-garamond", name: "Cormorant Garamond", bold: true },
  { id: "libre-baskerville", pkg: "libre-baskerville", name: "Libre Baskerville", bold: true },
  { id: "roboto-slab", pkg: "roboto-slab", name: "Roboto Slab", bold: true },
  { id: "dm-serif", pkg: "dm-serif-display", name: "DM Serif Display", bold: false },
  { id: "oswald", pkg: "oswald", name: "Oswald", bold: true },
  { id: "dancing-script", pkg: "dancing-script", name: "Dancing Script", bold: true },
  { id: "pacifico", pkg: "pacifico", name: "Pacifico", bold: false },
];

const dataAddress = (pkg, weight) => {
  const file = join(modules, pkg, "files", `${pkg}-latin-${weight}-normal.woff`);
  return `data:font/woff;base64,${readFileSync(file).toString("base64")}`;
};

for (const f of FONTS) {
  const version = JSON.parse(readFileSync(join(modules, f.pkg, "package.json"), "utf8")).version;
  const body = [
    "// GENERATED FILE: do not edit by hand (pnpm fonts:build).",
    `// ${f.name}, free to embed (see the licence in the @fontsource/${f.pkg} ${version} npm package it comes from).`,
    '// The "latin" subset as WOFF, embedded as text so it travels with the code and loads only when a theme uses it.',
    `export const REGULAR = "${dataAddress(f.pkg, 400)}";`,
    f.bold ? `export const BOLD: string | null = "${dataAddress(f.pkg, 700)}";` : "export const BOLD: string | null = null;",
    "",
  ].join("\n");
  writeFileSync(join(out, `${f.id}.ts`), body);
  console.log(`${f.id}: ${(body.length / 1024).toFixed(0)} KB`);
}
