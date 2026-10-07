import { describe, expect, it } from "vitest";
import { parseProductForm, productMatchesSearch, validateProductName, type ProductSummary } from "../index";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("validateProductName", () => {
  it("needs a name, tidies spaces, and has a limit", () => {
    expect(validateProductName("  Wedding   cake ")).toEqual({ ok: true, value: "Wedding cake" });
    expect(validateProductName("").ok).toBe(false);
    expect(validateProductName(null).ok).toBe(false);
    expect(validateProductName("x".repeat(201)).ok).toBe(false);
    expect(validateProductName("x".repeat(200)).ok).toBe(true);
  });
});

describe("parseProductForm", () => {
  it("accepts a name and a price, as a product by default", () => {
    expect(parseProductForm(form({ name: "Wedding cake", unitPrice: "800" }))).toEqual({
      ok: true,
      value: { kind: "product", name: "Wedding cake", description: null, unitPriceCents: 80000, unit: null },
    });
  });

  it("reads a service with a description, keeping its line breaks", () => {
    const r = parseProductForm(form({ kind: "service", name: "Design time", unitPrice: "450,50", description: "Per hour\nMinimum one hour" }));
    expect(r).toEqual({
      ok: true,
      value: { kind: "service", name: "Design time", description: "Per hour\nMinimum one hour", unitPriceCents: 45050, unit: null },
    });
  });

  it("allows a free item but needs the price typed", () => {
    expect(parseProductForm(form({ name: "Tasting", unitPrice: "0" })).ok).toBe(true);
    const r = parseProductForm(form({ name: "Tasting", unitPrice: "" }));
    expect(!r.ok && r.errors.unitPrice).toMatch(/Use 0 if it is free/);
  });

  it("reports every problem at once, in plain words", () => {
    const r = parseProductForm(form({ kind: "gadget", name: "", unitPrice: "abc", description: "x".repeat(1001) }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["description", "kind", "name", "unitPrice"]);
    expect(r.errors.name).toMatch(/Give it a name/);
  });
});

describe("a product's unit", () => {
  it("is optional, tidied, and limited to 20 characters", () => {
    const withUnit = parseProductForm(form({ name: "Sourdough", unitPrice: "80", unit: "  loaf " }));
    expect(withUnit.ok && withUnit.value.unit).toBe("loaf");
    const blank = parseProductForm(form({ name: "Sourdough", unitPrice: "80", unit: "  " }));
    expect(blank.ok && blank.value.unit).toBeNull();
    const long = parseProductForm(form({ name: "Sourdough", unitPrice: "80", unit: "u".repeat(21) }));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.unit).toMatch(/up to 20 characters/);
  });
});

describe("productMatchesSearch", () => {
  const p: ProductSummary = {
    id: "1",
    organisationId: "o",
    kind: "product",
    name: "Wedding cake",
    description: "Three tiers, buttercream",
    unit: null,
    unitPriceCents: 80000,
    archived: false,
    photoImageId: null,
  };
  it("searches the name and description without caring about case", () => {
    expect(productMatchesSearch(p, "WEDDING")).toBe(true);
    expect(productMatchesSearch(p, "buttercream")).toBe(true);
    expect(productMatchesSearch(p, "cupcake")).toBe(false);
    expect(productMatchesSearch(p, " ")).toBe(true);
  });
});

describe("the photo on a product form", () => {
  it("is attached by id, cleared when empty, and left alone when the form has no photo field", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const base = { name: "Cake", unitPrice: "80" };
    const withPhoto = parseProductForm(form({ ...base, photoImageId: id }));
    expect(withPhoto.ok && withPhoto.value.photoImageId).toBe(id);
    const cleared = parseProductForm(form({ ...base, photoImageId: "" }));
    expect(cleared.ok && cleared.value.photoImageId).toBeNull();
    const absent = parseProductForm(form(base));
    expect(absent.ok && absent.value.photoImageId).toBeUndefined();
  });

  it("refuses something that is not a picture id, and never gives a service a photo", () => {
    const bad = parseProductForm(form({ name: "Cake", unitPrice: "80", photoImageId: "not-an-id" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.photo).toBeDefined();
    const service = parseProductForm(
      form({ kind: "service", name: "Design", unitPrice: "300", photoImageId: "11111111-1111-4111-8111-111111111111" }),
    );
    expect(service.ok && service.value.photoImageId).toBeNull();
  });
});
