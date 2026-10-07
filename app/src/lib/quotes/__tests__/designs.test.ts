import { describe, expect, it } from "vitest";
import {
  DESIGNS,
  PRESETS,
  contrast,
  isDesignKey,
  isTheme,
  normaliseColour,
  onColour,
  parseDesignOptions,
  readableOn,
  resolveTheme,
} from "../designs";

describe("normaliseColour", () => {
  it("accepts #rrggbb and shorthand in any case, and nothing else", () => {
    expect(normaliseColour("#0F766E")).toBe("#0f766e");
    expect(normaliseColour(" abc ")).toBe("#aabbcc");
    for (const bad of ["red", "#12345", "#gggggg", "#1234567", "url(x)", "", null, undefined, 5]) {
      expect(normaliseColour(bad)).toBeNull();
    }
  });
});

describe("parseDesignOptions", () => {
  it("keeps only the choices we know", () => {
    expect(
      parseDesignOptions({ accent: "#ABCDEF", header: "band", totals: "huge", rows: "zebra", evil: "x", paper: "tinted" }),
    ).toEqual({ accent: "#abcdef", header: "band", rows: "zebra", paper: "tinted" });
  });
  it("turns anything that is not an object into no choices", () => {
    for (const bad of [null, undefined, "x", 3, [], [{ header: "band" }]]) expect(parseDesignOptions(bad)).toEqual({});
  });
});

describe("resolveTheme", () => {
  it("uses the design's own look, and classic for an unknown or missing design", () => {
    expect(resolveTheme("bold").header).toBe("band");
    expect(resolveTheme("bold").accent).toBe(PRESETS.bold.accent);
    expect(resolveTheme(undefined).key).toBe("classic");
    expect(resolveTheme("future").key).toBe("classic");
  });
  it("takes the accent from the quote's own choice, then the brand colour, then the design", () => {
    expect(resolveTheme("modern", {}, "#112233").accent).toBe("#112233");
    expect(resolveTheme("modern", { accent: "#445566" }, "#112233").accent).toBe("#445566");
    expect(resolveTheme("modern", { accent: "nonsense" }, null).accent).toBe(PRESETS.modern.accent);
  });
  it("lets each component be changed on its own", () => {
    const t = resolveTheme("classic", { header: "band", totals: "solid", corners: "round", paper: "tinted", headingFont: "serif" });
    expect([t.header, t.totals, t.radius, t.headingFont]).toEqual(["band", "solid", 10, "serif"]);
    expect(t.paper).not.toBe("#ffffff");
  });
  it("keeps text readable for any brand colour", () => {
    for (const colour of ["#ffffff", "#ffff00", "#000000", "#fde68a", "#1e3a8a", "#ff00ff"]) {
      for (const d of DESIGNS) {
        const t = resolveTheme(d.key, {}, colour);
        expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentInk, t.paper)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it("always produces a theme that isTheme accepts, and rejects damaged ones", () => {
    for (const d of DESIGNS) expect(isTheme(resolveTheme(d.key))).toBe(true);
    const t = resolveTheme("warm");
    expect(isTheme({ ...t, accent: "red" })).toBe(false);
    expect(isTheme({ ...t, header: "sparkly" })).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme("warm")).toBe(false);
  });
});

describe("colour helpers", () => {
  it("picks white or dark text for a background, and darkens a colour until it reads", () => {
    expect(onColour("#1e3a8a")).toBe("#ffffff");
    expect(onColour("#fde68a")).toBe("#1a1a1a");
    expect(contrast(readableOn("#ffffff", "#fde68a"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(readableOn("#ffffff", "#1e3a8a")).toBe("#1e3a8a");
  });
  it("knows its design keys", () => {
    expect(DESIGNS).toHaveLength(5);
    expect(isDesignKey("soft")).toBe(true);
    expect(isDesignKey("nope")).toBe(false);
  });
});
