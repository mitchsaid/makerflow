import { describe, expect, it } from "vitest";
import { costPerUnitCents, materialCostCents, materialMatchesSearch, parseMaterialForm, type Material } from "../index";
import { sameKind, toBaseMilli } from "../units";

const flour = { unit: "kg", boughtQuantityMilli: 12_500, priceCents: 18_750, vatTreatment: "none" } as const;
const RATE = 1500;

describe("units", () => {
  it("converts only within a kind, exactly", () => {
    expect(sameKind("g", "kg")).toBe(true);
    expect(sameKind("ml", "l")).toBe(true);
    expect(sameKind("dozen", "each")).toBe(true);
    expect(sameKind("l", "kg")).toBe(false);
    expect(sameKind("m", "each")).toBe(false);
    expect(toBaseMilli(1000, "kg")).toBe(BigInt(1_000_000_000));
    expect(toBaseMilli(1500, "dozen")).toBe(BigInt(18_000));
  });
});

describe("what an amount of a material costs", () => {
  it("is the price for the quantity bought, in proportion", () => {
    // R187,50 for 12,5 kg: R15,00 a kg, so 200 g is R3,00 and 1 kg is R15,00.
    expect(materialCostCents(200_000, "g", flour, null)).toBe(300);
    expect(materialCostCents(1000, "kg", flour, null)).toBe(1500);
    expect(costPerUnitCents(flour, null)).toBe(1500);
  });

  it("rounds once, at the end: a few grams of something cheap is not rounded to nothing before it adds up", () => {
    // 1 kg for R15,00: 1 g is 1,5 c, so 3 g is 4,5 c -> 5 c; 100 g is R1,50.
    const m = { unit: "kg", boughtQuantityMilli: 1000, priceCents: 1500, vatTreatment: "none" } as const;
    expect(materialCostCents(3000, "g", m, null)).toBe(5);
    expect(materialCostCents(100_000, "g", m, null)).toBe(150);
  });

  it("refuses units of a different kind instead of reading them as 1:1", () => {
    expect(materialCostCents(1000, "l", flour, null)).toBeNull();
    expect(materialCostCents(1000, "each", flour, null)).toBeNull();
  });

  it("is worked out WITHOUT VAT: taken out of a price that includes it, left alone otherwise", () => {
    const included = { ...flour, vatTreatment: "included" } as const;
    // R187,50 includes 15%: R163,04 without (187,50 / 1,15 = 163,043...), so a kg is R13,04.
    expect(materialCostCents(12_500, "kg", included, RATE)).toBe(16_304);
    expect(costPerUnitCents(included, RATE)).toBe(1304);
    // Excluded, or no VAT charged: the price is already the cost.
    expect(materialCostCents(12_500, "kg", { ...flour, vatTreatment: "excluded" }, RATE)).toBe(18_750);
    expect(materialCostCents(12_500, "kg", { ...flour, vatTreatment: "none" }, RATE)).toBe(18_750);
    // A business that is not registered has no VAT to take out, whatever the material says.
    expect(materialCostCents(12_500, "kg", included, null)).toBe(18_750);
  });

  it("takes the VAT out of the exact amount, not of a rounded unit cost", () => {
    // R1,15 for 3 g included 15%: 1 g is 0,333.. c without VAT = 0,3333 ... 3 g exactly R1,00.
    const m = { unit: "g", boughtQuantityMilli: 3000, priceCents: 115, vatTreatment: "included" } as const;
    expect(materialCostCents(3000, "g", m, RATE)).toBe(100);
    expect(materialCostCents(1000, "g", m, RATE)).toBe(33);
  });

  it("handles large and tiny amounts without losing a cent", () => {
    const big = { unit: "kg", boughtQuantityMilli: 9_999_999_999, priceCents: 99_999_999_999, vatTreatment: "included" } as const;
    expect(materialCostCents(9_999_999_999, "kg", big, RATE)).toBe(Math.round(99_999_999_999 / 1.15));
    expect(materialCostCents(1, "mg", flour, null)).toBe(0);
  });
});

describe("search", () => {
  const m = { name: "Cake flour", supplier: "Makro" } as Pick<Material, "name" | "supplier">;
  it("looks in the name and the supplier, ignoring case", () => {
    expect(materialMatchesSearch(m, "")).toBe(true);
    expect(materialMatchesSearch(m, "FLOUR")).toBe(true);
    expect(materialMatchesSearch(m, "makro")).toBe(true);
    expect(materialMatchesSearch(m, "wire")).toBe(false);
  });
});

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("parseMaterialForm", () => {
  const good = { name: "  Cake   flour ", unit: "kg", quantity: "12,5", price: "187,50", vatTreatment: "included", supplier: " Makro " };

  it("reads a material, tidying names and keeping the VAT answer only for a VAT-registered business", () => {
    const r = parseMaterialForm(form(good), { vatRegistered: true });
    expect(r).toEqual({
      ok: true,
      value: { name: "Cake flour", unit: "kg", boughtQuantityMilli: 12_500, priceCents: 18_750, vatTreatment: "included", supplier: "Makro" },
    });
    const plain = parseMaterialForm(form(good), { vatRegistered: false });
    expect(plain.ok && plain.value.vatTreatment).toBe("none");
  });

  it("an empty supplier is none", () => {
    const r = parseMaterialForm(form({ ...good, supplier: "  " }), { vatRegistered: false });
    expect(r.ok && r.value.supplier).toBeNull();
  });

  it("says how to fix each problem at its field", () => {
    const r = parseMaterialForm(form({ name: "", unit: "bucket", quantity: "", price: "x", vatTreatment: "" }), { vatRegistered: true });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.name).toMatch(/name/);
    expect(r.errors.unit).toMatch(/unit/);
    expect(r.errors.quantity).toMatch(/how much you bought/);
    expect(r.errors.price).toBeTruthy();
    expect(r.errors.vatTreatment).toMatch(/includes VAT/);
  });

  it("refuses a quantity of zero and a long name, and does not ask about VAT for a business that is not registered", () => {
    const r = parseMaterialForm(form({ ...good, quantity: "0", name: "x".repeat(121), vatTreatment: "" }), { vatRegistered: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.quantity).toBeTruthy();
    expect(r.errors.name).toMatch(/120/);
    expect(r.errors.vatTreatment).toBeUndefined();
  });

  it("keeps the price of nothing", () => {
    const r = parseMaterialForm(form({ ...good, price: "0" }), { vatRegistered: false });
    expect(r.ok && r.value.priceCents).toBe(0);
  });
});
