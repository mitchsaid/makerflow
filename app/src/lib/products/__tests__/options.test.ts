import { describe, expect, it } from "vitest";
import { optionsPayload, parseOptionGroups, type OptionGroupFormRow } from "../options";

const ID = "11111111-1111-4111-8111-111111111111";
const group = (over: Partial<OptionGroupFormRow> = {}): OptionGroupFormRow => ({
  key: "g1",
  id: "",
  name: "Flavour",
  kind: "one",
  required: true,
  textPrice: "",
  textMax: "100",
  values: [
    { key: "v1", id: ID, name: "Vanilla", price: "", usual: true },
    { key: "v2", id: "", name: "Red velvet", price: "50", usual: false },
  ],
  ...over,
});

describe("parseOptionGroups", () => {
  it("reads each kind, with empty amounts as R0 and ids kept", () => {
    const r = parseOptionGroups([
      group(),
      group({ key: "g2", name: "Extras", kind: "any", required: true, values: [{ key: "v3", id: "", name: "Gift box", price: "30", usual: true }] }),
      group({ key: "g3", name: "Message", kind: "text", required: false, textPrice: "25", textMax: "60", values: [] }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.groups[0]).toMatchObject({ name: "Flavour", kind: "one", required: true, values: [{ id: ID, name: "Vanilla", priceCents: 0, usual: true }, { id: null, priceCents: 5000 }] });
    // "Choose any" can never be required, and has no usual value.
    expect(r.groups[1]).toMatchObject({ kind: "any", required: false, values: [{ priceCents: 3000, usual: false }] });
    expect(r.groups[1]).not.toHaveProperty("charge");
    expect(r.groups[2]).toMatchObject({ kind: "text", textPriceCents: 2500, textMax: 60, values: [] });
  });

  it("always needs a choice for “choose one”, and the maker decides for “type something”", () => {
    const r = parseOptionGroups([
      group({ required: false }),
      group({ key: "g2", name: "Message", kind: "text", required: true, values: [] }),
      group({ key: "g3", name: "Note", kind: "text", required: false, values: [] }),
    ]);
    expect(r.ok && r.groups.map((g) => g.required)).toEqual([true, true, false]);
  });

  it("uses the usual length when “Longest” is left empty", () => {
    const r = parseOptionGroups([group({ name: "Message", kind: "text", textMax: "", values: [] })]);
    expect(r.ok && r.groups[0].textMax).toBe(100);
  });

  it("still reads a form sent by an older app, with how the price was added (now always each item)", () => {
    const r = parseOptionGroups([{ ...group(), charge: "line" }]);
    expect(r.ok && optionsPayload(r.groups)[0]).not.toHaveProperty("charge");
  });

  it("says how to fix each problem where it is", () => {
    const r = parseOptionGroups([
      group({ name: "" }),
      group({ key: "g2", name: "flavour", values: [] }),
      group({ key: "g3", name: "Sizes", values: [{ key: "a", id: "", name: "A", price: "x", usual: false }, { key: "b", id: "", name: "a", price: "", usual: false }] }),
      group({ key: "g4", name: "Message", kind: "text", textMax: "0", textPrice: "abc", values: [] }),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.groups.g1.name).toBeTruthy();
    expect(r.errors.groups.g2.values).toMatch(/at least one/);
    expect(r.errors.groups.g3.rows.a.price).toBeTruthy();
    expect(r.errors.groups.g3.rows.b.name).toMatch(/Two have this name/);
    expect(r.errors.groups.g4.textMax).toBeTruthy();
    expect(r.errors.groups.g4.textPrice).toBeTruthy();
  });

  it("refuses two options of the same name, too many, or a list it can't read", () => {
    const r = parseOptionGroups([group(), group({ key: "g2" })]);
    expect(!r.ok && r.errors.groups.g2.name).toMatch(/Two options/);
    expect(parseOptionGroups(Array.from({ length: 21 }, (_, i) => group({ key: `g${i}`, name: `O${i}` }))).ok).toBe(false);
    expect(parseOptionGroups("nope").ok).toBe(false);
    expect(parseOptionGroups([{ ...group(), kind: "maybe" }]).ok).toBe(false);
  });

  it("becomes what save_product takes", () => {
    const r = parseOptionGroups([group()]);
    expect(r.ok && optionsPayload(r.groups)).toEqual([
      {
        name: "Flavour",
        kind: "one",
        required: true,
        text_price_cents: 0,
        text_max: 100,
        price_by_variation: false,
        values: [
          { id: ID, name: "Vanilla", price_cents: 0, usual: true },
          { name: "Red velvet", price_cents: 5000, usual: false },
        ],
      },
    ]);
  });
});

describe("an option priced by variation", () => {
  const byVariation = (prices: Record<string, string>) =>
    group({ name: "Extras", kind: "any", required: false, priceByVariation: true, values: [{ key: "v1", id: "", name: "Gold leaf", price: "", usual: false, prices }] });

  it("stores a price for each variation by its place in the list, the lowest as the value's own", () => {
    const r = parseOptionGroups([byVariation({ small: "50", large: "120" })], ["small", "large"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.groups[0].priceByVariation).toBe(true);
    expect(r.groups[0].values[0]).toMatchObject({ priceCents: 5000, prices: [{ variationIndex: 0, priceCents: 5000 }, { variationIndex: 1, priceCents: 12000 }] });
    expect(optionsPayload(r.groups)[0].values[0]).toMatchObject({ prices: [{ variation_index: 0, price_cents: 5000 }, { variation_index: 1, price_cents: 12000 }] });
  });

  it("an empty or bad price says so at its field (0 is fine when typed), and without variations the switch is off", () => {
    const bad = parseOptionGroups([byVariation({ small: "", large: "abc" })], ["small", "large"]);
    expect(!bad.ok && bad.errors.groups.g1.rows.v1.prices?.large).toBeTruthy();
    expect(!bad.ok && bad.errors.groups.g1.rows.v1.prices?.small).toMatch(/Use 0 if nothing/);
    expect(parseOptionGroups([byVariation({ small: "0", large: "120" })], ["small", "large"]).ok).toBe(true);
    const none = parseOptionGroups([byVariation({})], []);
    expect(none.ok && none.groups[0].priceByVariation).toBe(false);
  });
});
