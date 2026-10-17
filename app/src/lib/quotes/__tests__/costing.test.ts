import { describe, expect, it } from "vitest";
import type { ProductSummary } from "../../products";
import type { VatSettings } from "../../money";
import { freezeCosting, frozenMargins } from "../costing";
import { parseQuote, toDatabasePayload, type LineFormValues, type QuoteFormValues } from "../index";
import { toFormValues } from "../form-values";
import { ZA_LOCALE } from "../../locale/za";

const NOT_REGISTERED: VatSettings = { registered: false };
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const FLOUR = "22222222-2222-4222-8222-222222222222";
const settings = {
  materials: new Map([[FLOUR, { unit: "kg" as const, boughtQuantityMilli: 12_500, priceCents: 18_750, vatTreatment: "none" as const }]]),
  hourlyRateCents: 12_000,
  vatRateBp: null,
};
const product: ProductSummary = {
  id: PRODUCT,
  organisationId: "o",
  kind: "product",
  name: "Cake",
  description: null,
  unitPriceCents: 10_000,
  unit: null,
  archived: false,
  photoImageId: null,
  vatStatus: "standard",
  variationLabel: null,
  variations: [],
  options: [],
  extras: [],
  priceBreaks: [],
  steps: [],
  makesMilli: 1000,
  costLines: [
    { id: "c1", kind: "material", materialId: FLOUR, amountMilli: 600_000, unit: "g", logic: "all", conditions: [] },
    { id: "c2", kind: "time", minutes: 30, logic: "all", conditions: [] },
  ],
};
const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "a",
  kind: "product",
  productId: PRODUCT,
  name: "Cake",
  description: "",
  quantity: "2",
  unit: "",
  unitPrice: "100",
  discountKind: "none",
  discountValue: "",
  ...over,
});
const quote = (lines: LineFormValues[], over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-02",
  validUntil: "2026-10-16",
  neededBy: "",
  lines,
  fulfilment: "none",
  deliveryFee: "",
  deliveryAddress: "",
  discountKind: "none",
  discountValue: "",
  notes: "",
  title: "",
  description: "",
  signOff: "",
  paymentInstructions: "",
  showBankDetails: true,
  showPhotos: true,
  depositKind: "none",
  depositValue: "",
  balanceDue: "handover",
  balanceDueDate: "",
  balanceDueText: "",
  policies: [],
  ...over,
});
const parsed = (values: QuoteFormValues) => {
  const r = parseQuote(values, NOT_REGISTERED);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.quote;
};
const freeze = (values: QuoteFormValues) =>
  freezeCosting({ quote: parsed(values), vat: NOT_REGISTERED, products: [product], settings, materialNames: new Map([[FLOUR, "Cake flour"]]) });

describe("freezeCosting", () => {
  it("freezes what each item cost, with what it is made of", () => {
    const c = freeze(quote([line()]))!;
    // two cakes: 2 × (R9,00 flour + R60,00 time) = R138,00; they sold for R200,00
    expect(c.items).toEqual([
      {
        name: "Cake",
        productId: PRODUCT,
        quantityMilli: 2000,
        revenueCents: 20_000,
        costCents: 13_800,
        incomplete: false,
        parts: [
          { label: "Cake flour", cents: 1800 },
          { label: "Your time", cents: 12_000 },
        ],
      },
    ]);
    expect(c).toMatchObject({ schema: 1, hourlyRateCents: 12_000, vatRateBp: null });
  });

  it("a one-off item costs what it was said to cost, each, for the quantity", () => {
    const c = freeze(quote([line({ key: "b", kind: "custom", productId: "", name: "Shelf", quantity: "1,5", unitPrice: "200", unitCost: "120,50" })]))!;
    expect(c.items[0]).toMatchObject({ name: "Shelf", productId: null, revenueCents: 30_000, costCents: 18_075 });
    expect(c.items[0].parts).toEqual([{ label: "Cost you gave", cents: 18_075 }]);
  });

  it("an item with no costs is named and left out of the figures; nothing costed freezes nothing", () => {
    const c = freeze(quote([line(), line({ key: "b", kind: "custom", productId: "", name: "Sign", unitPrice: "50" })]))!;
    expect(c.items.map((i) => [i.name, i.costCents])).toEqual([["Cake", 13_800], ["Sign", null]]);
    expect(freeze(quote([line({ key: "b", kind: "custom", productId: "", name: "Sign", unitPrice: "50" })]))).toBeNull();
  });

  it("revenue is after the item's discount and its share of the quote's", () => {
    const c = freeze(quote([line({ quantity: "1", discountKind: "percent", discountValue: "10" })], { discountKind: "percent", discountValue: "10" }))!;
    // R100 less 10% = R90, less 10% of that = R81
    expect(c.items[0].revenueCents).toBe(8100);
  });

  it("a delivery or collection is not an item", () => {
    const c = freeze(quote([line()], { fulfilment: "delivery", deliveryFee: "50" }))!;
    expect(c.items).toHaveLength(1);
  });

  it("a line that could not be costed makes the cost a minimum", () => {
    const c = freezeCosting({ quote: parsed(quote([line({ quantity: "1" })])), vat: NOT_REGISTERED, products: [product], settings: { ...settings, hourlyRateCents: null }, materialNames: new Map() })!;
    expect(c.items[0]).toMatchObject({ costCents: 900, incomplete: true });
    expect(c.items[0].parts).toEqual([{ label: "Material", cents: 900 }, { label: "Your time", cents: null }]);
  });
});

describe("frozenMargins", () => {
  it("reads a frozen costing back as the rows the margin panel shows", () => {
    const rows = frozenMargins(freeze(quote([line(), line({ key: "b", kind: "custom", productId: "", name: "Sign", unitPrice: "50" })])))!;
    expect(rows.map((r) => [r.name, r.margin?.costCents ?? null, r.margin?.marginBp ?? null])).toEqual([["Cake", 13_800, 3100], ["Sign", null, null]]);
  });
  it("leaves out what it cannot read, and says nothing for a costing it does not know", () => {
    expect(frozenMargins(null)).toBeNull();
    expect(frozenMargins({ schema: 2, items: [] })).toBeNull();
    expect(frozenMargins({ schema: 1, items: [{ name: "x" }, "junk", null] })).toEqual([]);
  });
});

describe("a one-off item's cost", () => {
  it("is kept with the line, comes back as typed, and is dropped for an item from a product", () => {
    const values = quote([line({ key: "b", kind: "custom", productId: "", name: "Shelf", unitCost: "120,50" }), line()]);
    const payload = toDatabasePayload(parsed(values), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.lines.map((l) => l.unit_cost_cents)).toEqual([12_050, null]);
    const back = toFormValues(
      {
        ...(values as unknown as Record<string, unknown>),
        lines: payload.lines.map((l, i) => ({ id: `l${i}`, sortOrder: i, kind: l.kind, productId: l.product_id, name: l.name, description: null, quantityMilli: l.quantity_milli, unit: null, unitPriceCents: l.unit_price_cents, discountKind: "none", discountValue: 0, unitCostCents: l.unit_cost_cents })),
      } as never,
      ZA_LOCALE.numberStyle,
    );
    expect(back.lines[0].unitCost).toBe("120,50");
    expect(back.lines[1].unitCost).toBeUndefined();
  });

  it("says how to fix a cost that is not money, and ignores one on an item from a product", () => {
    const bad = parseQuote(quote([line({ kind: "custom", productId: "", unitCost: "lots" })]), NOT_REGISTERED);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.lines.a.unitCost).toBeDefined();
    const fromProduct = parsed(quote([line({ unitCost: "5" })]));
    expect(fromProduct.lines[0].unitCostCents).toBeNull();
  });
});
