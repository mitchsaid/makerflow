"""Step one of `pnpm fonts:build`: for each font, joins the "latin" and "latin-ext" subsets of the
@fontsource package into one WOFF (so letters like Š, ž and Ṱ, used in some South African names, are in
the font), and writes src/lib/quotes/pdf/fonts/missing.ts: for each font, the letters the Noto Sans
files cover (see noto-sans-ranges.ts) that this font has no shape for. The document drops those letters
from text drawn in the font, as it already does for emoji. Needs fontTools (pip install fonttools brotli).
Step two, build.mjs, embeds the joined files.
"""
import json
import os
import re
import sys

from fontTools.merge import Merger
from fontTools.ttLib import TTFont

here = os.path.dirname(os.path.abspath(__file__))
app = os.path.join(here, "..", "..")
modules = os.path.join(app, "node_modules", "@fontsource")
staging = os.path.join(here, "merged")
out_dir = os.path.join(app, "src", "lib", "quotes", "pdf", "fonts")

# id, @fontsource package, has a bold face
FONTS = json.load(open(os.path.join(here, "fonts.json")))

ranges_source = open(os.path.join(out_dir, "noto-sans-ranges.ts")).read()
RANGES = [(int(a, 16), int(b, 16)) for a, b in re.findall(r"\[(0x[0-9a-fA-F]+),\s*(0x[0-9a-fA-F]+)\]", ranges_source)]
if not RANGES:
    sys.exit("could not read noto-sans-ranges.ts")

os.makedirs(staging, exist_ok=True)
missing = {}
for f in FONTS:
    weights = [400, 700] if f["bold"] else [400]
    for w in weights:
        base = os.path.join(modules, f["pkg"], "files", f"{f['pkg']}-%s-{w}-normal.woff")
        merger = Merger()
        font = merger.merge([base % "latin", base % "latin-ext"])
        font.flavor = "woff"
        font.save(os.path.join(staging, f"{f['id']}-{w}.woff"))
        if w == 400:
            cmap = TTFont(os.path.join(staging, f"{f['id']}-{w}.woff")).getBestCmap()
            lacks = [cp for lo, hi in RANGES for cp in range(lo, hi + 1) if cp not in cmap]
            # Compress to ranges.
            packed = []
            for cp in lacks:
                if packed and packed[-1][1] == cp - 1:
                    packed[-1][1] = cp
                else:
                    packed.append([cp, cp])
            missing[f["id"]] = packed
    print(f"{f['id']}: {len(missing[f['id']])} gaps")

lines = [
    "// GENERATED FILE: do not edit by hand (pnpm fonts:build).",
    "// For each font, the letters Noto Sans can draw that it cannot (as [from, to] code point ranges).",
    "export const MISSING_LETTERS: Record<string, readonly (readonly [number, number])[]> = {",
]
for fid, packed in missing.items():
    lines.append(f'  "{fid}": {json.dumps(packed)},')
lines += ["};", ""]
open(os.path.join(out_dir, "missing.ts"), "w").write("\n".join(lines))
