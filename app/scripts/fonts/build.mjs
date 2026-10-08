// Builds the embedded font files for quote PDFs from the @fontsource packages (dev dependencies):
//   pnpm fonts:build   (runs scripts/fonts/merge.py first, which needs: pip install fonttools brotli)
// For each font in the list below it writes src/lib/quotes/pdf/fonts/<id>.ts, a module with the regular
// (and bold, where there is one) face as a WOFF in a data address, so the font travels with the code and
// is loaded only when a theme uses it (see src/lib/quotes/pdf/fonts.ts). The "latin" and "latin-ext" subsets are
// joined by merge.py, so English, Afrikaans and the other South African languages written with Latin letters
// are covered (letters a font still lacks are listed in missing.ts and left out of text drawn in it).
// Keep the ids and labels in step with src/lib/quotes/font-list.ts. All of these fonts are free to embed
// (SIL Open Font License 1.1, except Roboto Slab: Apache License 2.0); the licences ship in the packages.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../src/lib/quotes/pdf/fonts");
const modules = join(here, "../../node_modules/@fontsource");

const FONTS = JSON.parse(readFileSync(join(here, "fonts.json"), "utf8"));
const staging = join(here, "merged");

const dataAddress = (id, weight) => `data:font/woff;base64,${readFileSync(join(staging, `${id}-${weight}.woff`)).toString("base64")}`;

for (const f of FONTS) {
  const version = JSON.parse(readFileSync(join(modules, f.pkg, "package.json"), "utf8")).version;
  const body = [
    "// GENERATED FILE: do not edit by hand (pnpm fonts:build).",
    `// ${f.name}, free to embed (see the licence in the @fontsource/${f.pkg} ${version} npm package it comes from).`,
    '// The "latin" and "latin-ext" subsets joined, as WOFF, embedded as text so it travels with the code and loads only when a theme uses it.',
    `export const REGULAR = "${dataAddress(f.id, 400)}";`,
    f.bold ? `export const BOLD: string | null = "${dataAddress(f.id, 700)}";` : "export const BOLD: string | null = null;",
    "",
  ].join("\n");
  writeFileSync(join(out, `${f.id}.ts`), body);
  console.log(`${f.id}: ${(body.length / 1024).toFixed(0)} KB`);
}
