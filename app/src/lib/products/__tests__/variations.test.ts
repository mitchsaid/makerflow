import { describe, expect, it } from "vitest";
import { parseProductForm } from "../index";
import { lowestPrice, parseVariations, variationSuggestions, type VariationFormRow } from "../variations";

const row = (over: Partial<VariationFormRow> = {}): VariationFormRow => ({ key: "k1", id: "", name: "Small", price: "300", usual: false, ...over });
const ID = "11111111-1111-4111-8111-111111111111";

describe("parseVariations", () => {
  it("reads a named list, keeping ids of existing ones and one usual", () => {
    const r = parseVariations(" Size ", [row({ id: ID }), row({ key: "k2", name: " Large ", price: "600", usual: true })]);
    expect(r).toEqual({
      ok: true,
      label: "Size",
      variations: [
        { id: ID, name: "Small", priceCents: 30000, usual: false },
        { id: null, name: "Large", priceCents: 60000, usual: true },
      ],
    });
  });

  it("no rows is a single price, and needs no name", () => {
    expect(parseVariations("", [])).toEqual({ ok: true, label: null, variations: [] });
  });

  it("says how to fix each problem at its row", () => {
    const r = parseVariations("", [row(), row({ key: "k2", name: "small", price: "" }), row({ key: "k3", name: "", price: "abc" })]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.label).toMatch(/Size/);
    expect(r.errors.rows.k2.name).toMatch(/Two have this name/);
    expect(r.errors.rows.k2.price).toMatch(/Enter a price/);
    expect(r.errors.rows.k3.name).toMatch(/Give it a name/);
    expect(r.errors.rows.k3.price).toBeTruthy();
  });

  it("needs at least two, and refuses more than fifty or a list it can't read", () => {
    const one = parseVariations("Size", [row()]);
    expect(!one.ok && one.errors.list).toMatch(/at least one more/);
    const many = parseVariations("Size", Array.from({ length: 51 }, (_, i) => row({ key: `k${i}`, name: `V${i}` })));
    expect(!many.ok && many.errors.list).toMatch(/50/);
    expect(parseVariations("Size", [{ nope: true }]).ok).toBe(false);
    expect(parseVariations("Size", "not a list").ok).toBe(false);
  });

  it("keeps only the first usual one if a hand-built request sends two", () => {
    const r = parseVariations("Size", [row({ usual: true }), row({ key: "k2", name: "Large", usual: true })]);
    expect(r.ok && r.variations.map((v) => v.usual)).toEqual([true, false]);
  });
});

describe("the product form with variations", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };
  it("takes the lowest variation's price as the product's, and needs no single price", () => {
    const r = parseProductForm(
      form({ name: "Cake", unitPrice: "", variationLabel: "Size", variations: JSON.stringify([row({ price: "450" }), row({ key: "k2", name: "Large", price: "300" })]) }),
    );
    expect(r.ok && r.value.unitPriceCents).toBe(30000);
    expect(r.ok && r.value.variations?.length).toBe(2);
  });
  it("leaves variations alone when the form has none to send, and refuses one it can't read", () => {
    const absent = parseProductForm(form({ name: "Cake", unitPrice: "80" }));
    expect(absent.ok && absent.value.variations).toBeUndefined();
    const bad = parseProductForm(form({ name: "Cake", unitPrice: "80", variations: "{" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.variations?.list).toBeTruthy();
  });
});

describe("suggestions and prices", () => {
  it("suggests the business's own words first, then general ones, six at most", () => {
    expect(variationSuggestions(["food"], "product").slice(0, 2)).toEqual(["Size", "Tiers"]);
    expect(variationSuggestions(["workshops"], "product")[0]).toBe("Ticket");
    expect(variationSuggestions(null, "service")[0]).toBe("Duration");
    expect(variationSuggestions(["food", "jewellery", "art"], "product").length).toBeLessThanOrEqual(6);
    expect(new Set(variationSuggestions(["food", "jewellery"], "product")).size).toBe(variationSuggestions(["food", "jewellery"], "product").length);
  });
  it("the from price is the lowest variation's", () => {
    expect(lowestPrice([{ priceCents: 500 }, { priceCents: 300 }], 999)).toBe(300);
    expect(lowestPrice([], 999)).toBe(999);
  });
});
