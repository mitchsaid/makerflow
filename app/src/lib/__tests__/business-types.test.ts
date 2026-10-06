import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../locale/za";
import { UNIT_SUGGESTIONS } from "../quotes/units";
import { TERMS_STARTERS } from "../quotes/terms-starters";
import { parsePolicy } from "../policies";
import {
  businessTypesFromRow,
  describeTypes,
  hasSpecificTypes,
  parseBusinessTypes,
  rankForTypes,
  splitForTypes,
} from "../business-types";

describe("parseBusinessTypes", () => {
  it("accepts known keys in the list's own order, drops duplicates, and allows none", () => {
    expect(parseBusinessTypes(["workshops", "food", "food"])).toEqual({ ok: true, value: ["food", "workshops"] });
    expect(parseBusinessTypes([])).toEqual({ ok: true, value: [] });
  });

  it("refuses unknown keys and anything that is not a list", () => {
    expect(parseBusinessTypes(["food", "hacking"]).ok).toBe(false);
    expect(parseBusinessTypes("food").ok).toBe(false);
    expect(parseBusinessTypes(null).ok).toBe(false);
    expect(parseBusinessTypes(Array.from({ length: 40 }, () => "food")).ok).toBe(false);
  });
});

describe("businessTypesFromRow", () => {
  it("is null when never asked, empty when skipped, and keeps only keys the app knows", () => {
    expect(businessTypesFromRow(null)).toBeNull();
    expect(businessTypesFromRow([])).toEqual([]);
    expect(businessTypesFromRow(["flowers", "old_type"])).toEqual(["flowers"]);
  });
});

describe("tailoring", () => {
  const items = [
    { id: "general" },
    { id: "food-only", types: ["food"] as const },
    { id: "flowers-only", types: ["flowers"] as const },
    { id: "both", types: ["food", "flowers"] as const },
  ];

  it("with no answer, or only 'Something else', changes nothing", () => {
    for (const none of [null, undefined, [], ["other"] as const]) {
      expect(hasSpecificTypes(none)).toBe(false);
      expect(splitForTypes(items, none)).toEqual({ forYou: items, others: [] });
      expect(rankForTypes(items, none).map((i) => i.id)).toEqual(["general", "food-only", "flowers-only", "both"]);
    }
  });

  it("puts what fits first, then what fits everyone, and keeps the rest", () => {
    const { forYou, others } = splitForTypes(items, ["food"]);
    expect(forYou.map((i) => i.id)).toEqual(["food-only", "both", "general"]);
    expect(others.map((i) => i.id)).toEqual(["flowers-only"]);
    expect(rankForTypes(items, ["food"]).map((i) => i.id)).toEqual(["food-only", "both", "general", "flowers-only"]);
    // Several types: anything that fits any of them.
    expect(splitForTypes(items, ["food", "flowers"]).others).toEqual([]);
  });

  it("never loses or repeats an item", () => {
    for (const chosen of [["food"], ["flowers"], ["workshops"], ["food", "flowers"]] as const) {
      const ranked = rankForTypes(items, chosen).map((i) => i.id).sort();
      expect(ranked).toEqual(items.map((i) => i.id).sort());
    }
  });

  it("describes the types for a sentence", () => {
    expect(describeTypes(["food"])).toBe("food and baking");
    expect(describeTypes(["food", "workshops"])).toBe("food and baking and workshops and classes");
    expect(describeTypes(["food", "flowers", "art"])).toBe("food and baking, flowers and plants and art, prints and photography");
    expect(describeTypes(["other"])).toBe("");
  });
});

describe("what the types tailor", () => {
  it("every South African example, terms starter and unit keeps a unique key and only known types", () => {
    const known = new Set(["food", "jewellery", "clothing", "flowers", "home_body", "craft", "art", "workshops", "other"]);
    const examples = ZA_LOCALE.policies.examples;
    expect(new Set(examples.map((e) => e.key)).size).toBe(examples.length);
    expect(new Set(TERMS_STARTERS.map((s) => s.key)).size).toBe(TERMS_STARTERS.length);
    expect(new Set(UNIT_SUGGESTIONS.map((u) => u.unit)).size).toBe(UNIT_SUGGESTIONS.length);
    for (const item of [...examples, ...TERMS_STARTERS, ...UNIT_SUGGESTIONS]) {
      for (const t of item.types ?? []) expect(known.has(t), t).toBe(true);
    }
  });

  it("the new South African examples are valid policies, marked for their types, with a note and bracketed blanks or a plain instruction", () => {
    const keys = ["food-storage", "food-collection", "engraving", "measurements", "flowers-substitutions", "safe-use"];
    for (const key of keys) {
      const e = ZA_LOCALE.policies.examples.find((x) => x.key === key)!;
      expect(e, key).toBeDefined();
      expect(e.types?.length, key).toBeGreaterThan(0);
      expect(e.goodToKnow.length, key).toBeGreaterThan(40);
      expect(parsePolicy({ title: e.title, body: e.text, includeByDefault: false }).ok, key).toBe(true);
    }
  });

  it("no example takes away a legal right or caps liability", () => {
    for (const e of ZA_LOCALE.policies.examples) {
      expect(e.text, e.key).not.toMatch(/not (be )?(liable|responsible)|no refunds?|all sales are final|limited to/i);
    }
    const measurements = ZA_LOCALE.policies.examples.find((x) => x.key === "measurements")!;
    expect(measurements.text).toMatch(/does not affect your legal rights/);
  });
});
