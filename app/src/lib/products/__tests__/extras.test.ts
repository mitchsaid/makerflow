import { describe, expect, it } from "vitest";
import { extraAmount, extrasPayload, parseExtras, usedOnWords, type ExtraFormRow } from "../extras";

const ID = "11111111-1111-4111-8111-111111111111";
const row = (over: Partial<ExtraFormRow> = {}): ExtraFormRow => ({
  key: "x1",
  id: "",
  name: "Gift wrap",
  price: "30",
  asksForWording: false,
  textMax: "",
  shared: true,
  usedOn: 0,
  ...over,
});

describe("parseExtras", () => {
  it("reads a shared extra, a product-only one and one that asks for wording; an empty price is R0", () => {
    const r = parseExtras([
      row({ id: ID }),
      row({ key: "x2", name: "Engraving", price: "50", asksForWording: true, textMax: "40", shared: false }),
      row({ key: "x3", name: "Message on the cake", price: "" , asksForWording: true }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extras[0]).toMatchObject({ id: ID, name: "Gift wrap", priceCents: 3000, shared: true, asksForWording: false, textMax: 100 });
    expect(r.extras[1]).toMatchObject({ id: null, shared: false, asksForWording: true, textMax: 40, priceCents: 5000 });
    expect(r.extras[2]).toMatchObject({ priceCents: 0, textMax: 100 });
  });

  it("says how to fix each problem where it is", () => {
    const r = parseExtras([
      row({ name: "" }),
      row({ key: "x2", name: "gift wrap" }),
      row({ key: "x3", name: "Gift  Wrap" }),
      row({ key: "x4", name: "Box", price: "abc" }),
      row({ key: "x5", name: "Card", asksForWording: true, textMax: "0" }),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.x1.name).toBeTruthy();
    expect(r.errors.rows.x3.name).toMatch(/Two extras have this name/);
    expect(r.errors.rows.x4.price).toBeTruthy();
    expect(r.errors.rows.x5.textMax).toMatch(/or leave it empty for 100/);
  });

  it("limits the number, and refuses a list it can't read", () => {
    expect(parseExtras(Array.from({ length: 41 }, (_, i) => row({ key: `x${i}`, name: `E${i}` }))).ok).toBe(false);
    expect(parseExtras("nope").ok).toBe(false);
    expect(parseExtras([{ ...row(), shared: "yes" }]).ok).toBe(false);
  });

  it("ignores how long the wording can be when it asks for none", () => {
    const r = parseExtras([row({ textMax: "9999" })]);
    expect(r.ok && r.extras[0].textMax).toBe(100);
  });
});

describe("an extra priced by variation", () => {
  const by = (prices: Record<string, string>, shared = false) => row({ name: "Gold leaf", shared, priceByVariation: true, prices });

  it("stores a price for each variation by its place in the list, the lowest as its own", () => {
    const r = parseExtras([by({ small: "50", large: "120" })], ["small", "large"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.extras[0]).toMatchObject({ priceByVariation: true, priceCents: 5000, prices: [{ variationIndex: 0, priceCents: 5000 }, { variationIndex: 1, priceCents: 12000 }] });
    expect(extrasPayload(r.extras)[0]).toMatchObject({ shared: false, price_by_variation: true, prices: [{ variation_index: 0, price_cents: 5000 }, { variation_index: 1, price_cents: 12000 }] });
  });

  it("says so at the size with an empty or bad price (0 is fine when typed)", () => {
    const bad = parseExtras([by({ small: "", large: "abc" })], ["small", "large"]);
    expect(!bad.ok && bad.errors.rows.x1.prices?.small).toMatch(/Use 0 if nothing/);
    expect(!bad.ok && bad.errors.rows.x1.prices?.large).toBeTruthy();
    expect(parseExtras([by({ small: "0", large: "120" })], ["small", "large"]).ok).toBe(true);
  });

  it("is off for a shared extra (it has no sizes to ask about) and without variations", () => {
    const shared = parseExtras([by({ small: "50", large: "120" }, true)], ["small", "large"]);
    expect(shared.ok && shared.extras[0].priceByVariation).toBe(false);
    const none = parseExtras([by({})], []);
    expect(none.ok && none.extras[0].priceByVariation).toBe(false);
  });
});

describe("extra amounts and words", () => {
  it("is the extra's own price, or the one for the size chosen", () => {
    const x = { priceCents: 5000, priceByVariation: true, prices: { s: 5000, l: 12000 } };
    expect(extraAmount(x, "l")).toBe(12000);
    expect(extraAmount(x, "")).toBe(5000);
    expect(extraAmount({ ...x, priceByVariation: false }, "l")).toBe(5000);
  });

  it("says how many other products have a shared extra", () => {
    expect(usedOnWords(1)).toBeNull();
    expect(usedOnWords(2)).toMatch(/1 other product\./);
    expect(usedOnWords(4)).toMatch(/3 other products\. Changing it changes it there too/);
  });

  it("becomes what save_product takes, with ids kept", () => {
    const r = parseExtras([row({ id: ID, asksForWording: true, textMax: "40" })]);
    expect(r.ok && extrasPayload(r.extras)).toEqual([
      { id: ID, name: "Gift wrap", price_cents: 3000, asks_for_wording: true, text_max: 40, shared: true, price_by_variation: false },
    ]);
  });
});
