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
      value: { kind: "product", name: "Wedding cake", description: null, unitPriceCents: 80000 },
    });
  });

  it("reads a service with a description, keeping its line breaks", () => {
    const r = parseProductForm(form({ kind: "service", name: "Design time", unitPrice: "450,50", description: "Per hour\nMinimum one hour" }));
    expect(r).toEqual({
      ok: true,
      value: { kind: "service", name: "Design time", description: "Per hour\nMinimum one hour", unitPriceCents: 45050 },
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

describe("productMatchesSearch", () => {
  const p: ProductSummary = {
    id: "1",
    organisationId: "o",
    kind: "product",
    name: "Wedding cake",
    description: "Three tiers, buttercream",
    unitPriceCents: 80000,
    archived: false,
  };
  it("searches the name and description without caring about case", () => {
    expect(productMatchesSearch(p, "WEDDING")).toBe(true);
    expect(productMatchesSearch(p, "buttercream")).toBe(true);
    expect(productMatchesSearch(p, "cupcake")).toBe(false);
    expect(productMatchesSearch(p, " ")).toBe(true);
  });
});
