import { describe, expect, it } from "vitest";
import { getLocalePack } from "../../locale";
import { isUnitCode, sameKind } from "../../materials/units";
import { PRODUCT_DESCRIPTION_MAX, PRODUCT_NAME_MAX, PRODUCT_UNIT_MAX } from "../../products";
import { validateEmail, validatePhone } from "../../validation";
import { demoContent } from "../content";
import { DEMO_CHOICES, DEMO_KINDS, isDemoKind, timeLeftWords } from "../index";

const za = getLocalePack("ZA");

describe("the demo kinds", () => {
  it("are a short list, each with words for the landing page", () => {
    expect(DEMO_KINDS.length).toBeGreaterThanOrEqual(3);
    expect(DEMO_KINDS.length).toBeLessThanOrEqual(5);
    for (const kind of DEMO_KINDS) {
      expect(isDemoKind(kind)).toBe(true);
      expect(DEMO_CHOICES[kind].title).not.toBe("");
    }
    expect(isDemoKind("florist")).toBe(false);
    expect(isDemoKind(undefined)).toBe(false);
  });

  it("says how long is left in plain words", () => {
    const now = Date.parse("2026-11-01T10:00:00Z");
    expect(timeLeftWords("2026-11-01T15:30:00Z", now)).toBe("6 hours");
    expect(timeLeftWords("2026-11-01T11:00:00Z", now)).toBe("1 hour");
    expect(timeLeftWords("2026-11-01T10:45:00Z", now)).toBe("45 minutes");
    expect(timeLeftWords("2026-11-01T10:01:00Z", now)).toBe("1 minute");
    expect(timeLeftWords("2026-11-01T09:00:00Z", now)).toBe("less than a minute");
  });
});

describe.each(DEMO_KINDS)("the %s demo content", (kind) => {
  const c = demoContent(kind);

  it("is a business the Business profile form would accept", () => {
    expect(c.businessName.length).toBeGreaterThan(0);
    expect(validatePhone(c.phone).ok).toBe(true);
    expect(validateEmail(c.email).ok).toBe(true);
    expect(za.address.regions).toContain(c.region);
    expect(za.address.validatePostalCode(c.postalCode).ok).toBe(true);
    if (c.vatNumber) expect(za.tax.validateRegistrationNumber(c.vatNumber).ok).toBe(true);
    expect(c.logo.background).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.logo.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.targetMarginBp).toBeGreaterThanOrEqual(100);
    expect(c.targetMarginBp).toBeLessThanOrEqual(9900);
  });

  it("has customers a quote can be made for, with no repeats", () => {
    expect(c.customers.length).toBeGreaterThanOrEqual(3);
    for (const customer of c.customers) {
      expect(validateEmail(customer.email).ok).toBe(true);
      expect(validatePhone(customer.phone).ok).toBe(true);
      expect(za.address.regions).toContain(customer.region);
      expect(za.address.validatePostalCode(customer.postalCode).ok).toBe(true);
    }
    expect(new Set(c.customers.map((x) => x.name.toLowerCase())).size).toBe(c.customers.length);
  });

  it("has materials with real units and no repeated names", () => {
    for (const m of c.materials) {
      expect(isUnitCode(m.unit)).toBe(true);
      expect(Number.isInteger(m.boughtQuantityMilli) && m.boughtQuantityMilli > 0).toBe(true);
      expect(Number.isInteger(m.priceCents) && m.priceCents >= 0).toBe(true);
    }
    expect(new Set(c.materials.map((m) => m.name.toLowerCase())).size).toBe(c.materials.length);
    expect(new Set(c.materials.map((m) => m.key)).size).toBe(c.materials.length);
  });

  it("has products with whole-cent prices, at least one costed with variations, products and services both, and costs that name real materials in a matching unit", () => {
    const materialUnits = new Map(c.materials.map((m) => [m.key, m.unit]));
    expect(new Set(c.products.map((p) => p.name.toLowerCase())).size).toBe(c.products.length);
    expect(c.products.some((p) => p.kind === "product")).toBe(true);
    expect(c.products.some((p) => p.kind === "service")).toBe(true);
    expect(c.products.some((p) => (p.variations?.length ?? 0) > 1)).toBe(true);
    expect(c.products.some((p) => p.costs)).toBe(true);
    for (const p of c.products) {
      expect(p.name.length).toBeLessThanOrEqual(PRODUCT_NAME_MAX);
      expect(p.description.length).toBeLessThanOrEqual(PRODUCT_DESCRIPTION_MAX);
      expect((p.unit ?? "").length).toBeLessThanOrEqual(PRODUCT_UNIT_MAX);
      expect(Number.isInteger(p.priceCents) && p.priceCents >= 0).toBe(true);
      if (p.variations) {
        // With variations the product's own price is the lowest of theirs.
        expect(p.priceCents).toBe(Math.min(...p.variations.map((v) => v.priceCents)));
        expect(p.variations.filter((v) => v.usual).length).toBeLessThanOrEqual(1);
      }
      for (const line of p.costs?.lines ?? []) {
        if (line.kind !== "material") continue;
        const unit = materialUnits.get(line.material);
        expect(unit, `${p.name} uses a material that is not there: ${line.material}`).toBeDefined();
        expect(sameKind(unit!, line.unit), `${p.name}: ${line.unit} does not measure what ${line.material} is bought in`).toBe(true);
      }
    }
  });

  it("has sample quotes that name real customers, products, variations and extras: a draft that shows a margin, a sent one and an accepted one", () => {
    const customers = new Set(c.customers.map((x) => x.name));
    const byName = new Map(c.products.map((p) => [p.name, p]));
    expect(c.quotes.map((q) => q.status).sort()).toEqual(["accepted", "draft", "sent"]);
    for (const q of c.quotes) {
      expect(customers.has(q.customer), `${q.customer} is not a customer`).toBe(true);
      expect(q.daysAgo).toBeGreaterThanOrEqual(0);
      expect(q.daysAgo).toBeLessThan(10);
      expect(q.items.length).toBeGreaterThan(0);
      for (const item of q.items) {
        const product = byName.get(item.product);
        expect(product, `${item.product} is not a product`).toBeDefined();
        expect(Number.isInteger(item.quantity) && item.quantity > 0).toBe(true);
        if (item.variation) expect(product!.variations?.map((v) => v.name)).toContain(item.variation);
        for (const extra of item.extras ?? []) expect(product!.extras?.map((x) => x.name)).toContain(extra);
      }
    }
    // The draft earns its keep in the demo by showing the margin: it has something with costs on it.
    const draft = c.quotes.find((q) => q.status === "draft")!;
    expect(draft.items.some((i) => byName.get(i.product)!.costs)).toBe(true);
  });
});
