import { describe, expect, it } from "vitest";
import { FONT_IDS, FONT_LIST, isFontId } from "../font-list";
import { LOADABLE_FONTS } from "../pdf/fonts";
import {
  BLANK_SPEC,
  CHOICES,
  STARTERS,
  chooseTheme,
  contrast,
  fitGradientEnd,
  isStarterKey,
  isTheme,
  normaliseColour,
  onColour,
  parseSpec,
  readableOn,
  resolveTheme,
  sameSpec,
  specOf,
  themeFromStored,
  type SavedTheme,
} from "../themes";

describe("normaliseColour", () => {
  it("accepts #rrggbb and shorthand in any case, and nothing else", () => {
    expect(normaliseColour("#0F766E")).toBe("#0f766e");
    expect(normaliseColour(" abc ")).toBe("#aabbcc");
    for (const bad of ["red", "#12345", "#gggggg", "#1234567", "url(x)", "", null, undefined, 5]) {
      expect(normaliseColour(bad)).toBeNull();
    }
  });
});

describe("parseSpec", () => {
  it("keeps only the choices we know and fills the rest from the base", () => {
    const spec = parseSpec({ accent: "#ABCDEF", header: "band", totals: "huge", layout: "cards", evil: "x", showQty: false, numbered: "yes" });
    expect(spec).toMatchObject({ accent: "#abcdef", header: "band", layout: "cards", showQty: false, numbered: false, totals: BLANK_SPEC.totals });
    expect(Object.keys(spec).sort()).toEqual(Object.keys(BLANK_SPEC).sort());
  });
  it("turns anything that is not an object into the base", () => {
    for (const bad of [null, undefined, "x", 3, [], [{ header: "band" }]]) expect(parseSpec(bad)).toEqual(BLANK_SPEC);
  });
  it("never lets a colour carry anything but #rrggbb", () => {
    expect(parseSpec({ accent: "red; background:url(x)", paper: "#fff; x" })).toMatchObject({ accent: BLANK_SPEC.accent, paper: BLANK_SPEC.paper });
  });
  it("knows whether two specs are the same look", () => {
    expect(sameSpec(BLANK_SPEC, { ...BLANK_SPEC })).toBe(true);
    expect(sameSpec(BLANK_SPEC, { ...BLANK_SPEC, rows: "zebra" })).toBe(false);
  });
});

describe("the starters", () => {
  it("are five whole themes with names, and each choice they use is one the studio offers", () => {
    expect(STARTERS).toHaveLength(5);
    for (const s of STARTERS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(sameSpec(parseSpec(s.spec), s.spec), s.key).toBe(true);
      for (const [name, group] of Object.entries(CHOICES)) {
        expect(group.options.map(([v]) => v), `${s.key} ${name}`).toContain((s.spec as Record<string, unknown>)[name]);
      }
    }
    expect(isStarterKey("soft")).toBe(true);
    expect(isStarterKey("nope")).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("carries the parts and works out the colours", () => {
    const t = resolveTheme({ ...BLANK_SPEC, accent: "#0f766e", header: "band", corners: "round", layout: "cards" }, "Teal");
    expect([t.name, t.header, t.radius, t.layout]).toEqual(["Teal", "band", 10, "cards"]);
    expect(t.onAccent).toBe("#ffffff");
  });
  it("keeps text readable for any accent and paper", () => {
    for (const accent of ["#ffffff", "#ffff00", "#000000", "#fde68a", "#1e3a8a", "#ff00ff", "#ff0000"]) {
      for (const paper of ["#ffffff", "#fbf7f0", "#fdf5f8", "#1f2937", "#000000", "#9ca3af", "#a0a0a0", "#808080", "#c7c7c7"]) {
        const t = resolveTheme({ ...BLANK_SPEC, accent, paper }, "x");
        expect(contrast(t.onAccent, t.accent), `${accent} text`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentInk, t.paper), `${accent} on ${paper}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentInk, t.tint), `${accent} on its tint over ${paper}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.ink, t.paper), `ink on ${paper}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.muted, t.paper), `muted on ${paper}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("draws an accent that would vanish into the paper in the text colour instead", () => {
    const t = resolveTheme({ ...BLANK_SPEC, paper: "#1f2937" }, "x");
    expect(contrast(t.accent, t.paper)).toBeGreaterThanOrEqual(7);
    // An accent that shows is left alone.
    expect(resolveTheme({ ...BLANK_SPEC, accent: "#fbbf24", paper: "#1f2937" }, "x").accent).toBe("#fbbf24");
  });
  it("turns the text light on a dark paper", () => {
    expect(resolveTheme({ ...BLANK_SPEC, paper: "#111827" }, "x").ink).toBe("#f5f5f5");
    expect(resolveTheme(BLANK_SPEC, "x").ink).toBe("#1a1a1a");
  });
  it("round-trips through specOf", () => {
    for (const s of STARTERS) expect(sameSpec(specOf(resolveTheme(s.spec, s.name)), s.spec), s.key).toBe(true);
  });
  it("is accepted by isTheme, and damaged themes are not", () => {
    for (const s of STARTERS) expect(isTheme(resolveTheme(s.spec, s.name))).toBe(true);
    const t = resolveTheme(BLANK_SPEC, "x");
    expect(isTheme({ ...t, accent: "red" })).toBe(false);
    expect(isTheme({ ...t, layout: "sparkly" })).toBe(false);
    expect(isTheme({ ...t, showQty: "yes" })).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme("warm")).toBe(false);
  });
});

describe("themeFromStored", () => {
  it("uses a finished theme as it is, Classic for nothing, and a named starter for an old design name", () => {
    const t = resolveTheme({ ...BLANK_SPEC, accent: "#123456" }, "Mine");
    expect(themeFromStored({ theme: t })).toBe(t);
    expect(themeFromStored(undefined).name).toBe("Classic");
    expect(themeFromStored({ design: "warm" }).name).toBe("Warm");
    expect(themeFromStored({ design: "future" }).name).toBe("Classic");
    expect(themeFromStored({ theme: { key: "warm" } }).name).toBe("Classic");
  });
  it("upgrades the first designs' theme shape, keeping its colours", () => {
    const first = {
      key: "warm", headingFont: "serif", header: "bar", tableHead: "tint", rows: "lines", totals: "tint", radius: 4,
      paper: "#fbf7f0", ink: "#1a1a1a", muted: "#666666", line: "#e5e1da", accent: "#b45309", onAccent: "#ffffff",
      accentInk: "#b45309", tint: "#f3e8dc", tintStrong: "#f6eee4",
    };
    const t = themeFromStored({ theme: first });
    expect(t).toMatchObject({ name: "Warm", header: "bar", headingFont: "serif", layout: "table", muted: "#666666", line: "#e5e1da", tint: "#f3e8dc", showQty: true });
    expect(isTheme(t)).toBe(true);
  });
});

describe("colour helpers", () => {
  it("picks white or dark text for a background, and darkens (or lightens) a colour until it reads", () => {
    expect(onColour("#1e3a8a")).toBe("#ffffff");
    expect(onColour("#fde68a")).toBe("#000000");
    expect(contrast(readableOn("#ffffff", "#fde68a"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(readableOn("#111111", "#222266"), "#111111")).toBeGreaterThanOrEqual(4.5);
    expect(readableOn("#ffffff", "#1e3a8a")).toBe("#1e3a8a");
  });
});

describe("chooseTheme", () => {
  const saved: SavedTheme[] = [{ id: "t1", name: "Stall", spec: { ...BLANK_SPEC, accent: "#b45309" } }];
  const none = { id: null, starter: null };
  it("uses the quote's own pick", () => {
    expect(chooseTheme({ id: "t1", starter: null }, saved).name).toBe("Stall");
    expect(chooseTheme({ id: null, starter: "soft" }, saved).name).toBe("Soft");
  });
  it("is Classic when the quote has no pick, or its theme no longer exists", () => {
    expect(chooseTheme(none, saved).name).toBe("Classic");
    expect(chooseTheme({ id: "gone", starter: null }, saved).name).toBe("Classic");
    expect(chooseTheme({ id: "t1", starter: null }, []).name).toBe("Classic");
  });
});

describe("fonts", () => {
  it("accepts the fonts in the list (the two Noto fonts keep their old names) and drops anything else", () => {
    expect(parseSpec({ headingFont: "playfair", bodyFont: "serif" })).toMatchObject({ headingFont: "playfair", bodyFont: "serif" });
    expect(parseSpec({ headingFont: "Comic Sans", bodyFont: "x; y" })).toMatchObject({ headingFont: "sans", bodyFont: "sans" });
    expect(FONT_LIST.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FONT_IDS).size).toBe(FONT_IDS.length);
    expect(isFontId("inter")).toBe(true);
    expect(isFontId("nope")).toBe(false);
  });
  it("has a loader for every font that is not one of the two always there", () => {
    for (const id of FONT_IDS) expect(LOADABLE_FONTS, id).toContain(id);
  });
});

describe("rows", () => {
  it("turns the first release's full grid into the spreadsheet (a table) or boxed rows (anything else)", () => {
    expect(parseSpec({ rows: "grid", layout: "table" }).rows).toBe("sheet");
    expect(parseSpec({ rows: "grid", layout: "cards" }).rows).toBe("boxed");
    expect(parseSpec({ rows: "sheet" }).rows).toBe("sheet");
    expect(parseSpec({ rows: "boxed" }).rows).toBe("boxed");
  });
});

describe("backgrounds", () => {
  const png = "3f2a1b2c-0000-4000-8000-000000000001";
  it("keeps a gradient's colour and direction and a picture's id, and drops what isn't one", () => {
    expect(parseSpec({ background: "gradient", gradientTo: "#E8EEF6", gradientDirection: "diagonal" })).toMatchObject({ background: "gradient", gradientTo: "#e8eef6", gradientDirection: "diagonal" });
    expect(parseSpec({ background: "image", backgroundImageId: png, imageStrength: "faint" })).toMatchObject({ background: "image", backgroundImageId: png, imageStrength: "faint" });
    expect(parseSpec({ backgroundImageId: "../../etc/passwd" }).backgroundImageId).toBeNull();
    expect(parseSpec({ background: "video", gradientTo: "red" })).toMatchObject({ background: "paper", gradientTo: BLANK_SPEC.gradientTo });
  });
  it("reads text against the middle of a gradient, so soft gradients stay readable and the ends are close to it", () => {
    for (const [from, to] of [["#ffffff", "#e8eef6"], ["#fbf7f0", "#fde9d9"], ["#1f2937", "#111827"], ["#fdf5f8", "#e9e3f5"]]) {
      const t = resolveTheme({ ...BLANK_SPEC, background: "gradient", paper: from, gradientTo: to }, "x");
      for (const end of [from, to]) expect(contrast(t.ink, end), `${from} to ${to}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accentInk, t.tint)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("eases a gradient whose ends are too far apart for any text colour, and leaves a soft one alone", () => {
    const harsh = resolveTheme({ ...BLANK_SPEC, background: "gradient", paper: "#ffffff", gradientTo: "#1f2937" }, "x");
    expect(harsh.gradientTo).not.toBe("#1f2937");
    for (const end of ["#ffffff", harsh.gradientTo]) expect(contrast(harsh.ink, end)).toBeGreaterThanOrEqual(4.5);
    const reverse = resolveTheme({ ...BLANK_SPEC, background: "gradient", paper: "#1f2937", gradientTo: "#ffffff" }, "x");
    for (const end of ["#1f2937", reverse.gradientTo]) expect(contrast(reverse.ink, end)).toBeGreaterThanOrEqual(4.5);
    expect(resolveTheme({ ...BLANK_SPEC, background: "gradient", paper: "#fbf7f0", gradientTo: "#fde9d9" }, "x").gradientTo).toBe("#fde9d9");
    expect(fitGradientEnd("#ffffff", "#e8eef6")).toBe("#e8eef6");
  });
  it("carries the background through resolveTheme, isTheme and specOf", () => {
    const spec = { ...BLANK_SPEC, background: "image" as const, backgroundImageId: png, imageStrength: "medium" as const };
    const t = resolveTheme(spec, "x");
    expect(isTheme(t)).toBe(true);
    expect(sameSpec(specOf(t), spec)).toBe(true);
    expect(isTheme({ ...t, backgroundImageId: "nope" })).toBe(false);
    expect(isTheme({ ...t, background: "video" })).toBe(false);
  });
});

describe("a theme from the first release", () => {
  it("is upgraded: no background, fonts keep their names, grid rows become the spreadsheet or boxed rows", () => {
    const first = {
      ...resolveTheme({ ...BLANK_SPEC, accent: "#0f766e", headingFont: "serif" }, "Mine"),
      rows: "grid",
    } as Record<string, unknown>;
    for (const key of ["background", "gradientTo", "gradientDirection", "backgroundImageId", "imageStrength"]) delete first[key];
    const t = themeFromStored({ theme: first });
    expect(t).toMatchObject({ name: "Mine", background: "paper", headingFont: "serif", rows: "sheet", accent: "#0f766e" });
    expect(isTheme(t)).toBe(true);
    expect(themeFromStored({ theme: { ...first, layout: "cards" } }).rows).toBe("boxed");
  });
});

describe("the extra prices part", () => {
  it("defaults to included, is kept by a spec, and older stored themes read as included", () => {
    expect(BLANK_SPEC.extraPrices).toBe("included");
    expect(parseSpec({ extraPrices: "separate" }).extraPrices).toBe("separate");
    expect(parseSpec({ extraPrices: "loud" }).extraPrices).toBe("included");
    const resolved = resolveTheme({ ...BLANK_SPEC, extraPrices: "separate" }, "T");
    expect(specOf(resolved).extraPrices).toBe("separate");
    const { extraPrices: _dropped, ...older } = resolveTheme(BLANK_SPEC, "Old");
    void _dropped;
    expect(themeFromStored({ theme: older }).extraPrices).toBe("included");
  });
});
