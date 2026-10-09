import { describe, expect, it } from "vitest";
import { optionsPayload, parseOptionGroups, type OptionGroupFormRow } from "../options";

const ID = "11111111-1111-4111-8111-111111111111";
const group = (over: Partial<OptionGroupFormRow> = {}): OptionGroupFormRow => ({
  key: "g1",
  id: "",
  name: "Flavour",
  kind: "one",
  required: true,
  charge: "item",
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
      group({ key: "g2", name: "Extras", kind: "any", required: true, charge: "line", values: [{ key: "v3", id: "", name: "Gift box", price: "30", usual: true }] }),
      group({ key: "g3", name: "Message", kind: "text", required: false, textPrice: "25", textMax: "60", values: [] }),
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.groups[0]).toMatchObject({ name: "Flavour", kind: "one", required: true, values: [{ id: ID, name: "Vanilla", priceCents: 0, usual: true }, { id: null, priceCents: 5000 }] });
    // "Choose any" can never be required, and has no usual value.
    expect(r.groups[1]).toMatchObject({ kind: "any", required: false, charge: "line", values: [{ priceCents: 3000, usual: false }] });
    expect(r.groups[2]).toMatchObject({ kind: "text", textPriceCents: 2500, textMax: 60, values: [] });
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
        charge: "item",
        text_price_cents: 0,
        text_max: 100,
        values: [
          { id: ID, name: "Vanilla", price_cents: 0, usual: true },
          { name: "Red velvet", price_cents: 5000, usual: false },
        ],
      },
    ]);
  });
});
