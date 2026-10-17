import { describe, expect, it } from "vitest";
import type { ProductSummary } from "../../products";
import { calculateDocument } from "../../money";
import { costItem, extrasOn, lineMargins } from "../margin";
import type { LineFormValues, QuoteFormValues } from "../index";

const LARGE = "11111111-1111-4111-8111-111111111111";
const settings = { materials: new Map(), hourlyRateCents: 12_000, vatRateBp: null };
const product = (over: Partial<ProductSummary> = {}): ProductSummary => ({
  id: "p1",
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
  costLines: [{ id: "c1", kind: "other", name: "Box", cents: 2500, logic: "all", conditions: [] }],
  ...over,
});
const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "a",
  kind: "product",
  productId: "p1",
  name: "Cake",
  description: "",
  quantity: "2",
  unit: "",
  unitPrice: "100",
  discountKind: "none",
  discountValue: "",
  ...over,
});
const values = (lines: LineFormValues[], discountKind: "none" | "percent" = "none", discountValue = ""): QuoteFormValues =>
  ({ lines, discountKind, discountValue, fulfilment: "none", deliveryFee: "" }) as unknown as QuoteFormValues;
const vat = { registered: false } as const;
const totalsFor = (ls: LineFormValues[]) =>
  calculateDocument({ lines: ls.map((l) => ({ id: l.key, quantityMilli: Number(l.quantity) * 1000, unitPriceCents: Number(l.unitPrice) * 100, vatStatus: "standard" as const })), vat });

describe("lineMargins", () => {
  it("costs the item for the quantity on the quote", () => {
    const ls = [line()];
    const [m] = lineMargins(values(ls), totalsFor(ls), vat, [product()], settings);
    // two cakes: R200,00 less 2 × R25,00
    expect(m.margin).toMatchObject({ revenueCents: 20_000, costCents: 5000, profitCents: 15_000, marginBp: 7500 });
  });

  it("a one-off item, or a product with no costs, has no margin to show", () => {
    const ls = [line({ key: "a", productId: "" }), line({ key: "b", productId: "p2" })];
    const out = lineMargins(values(ls), totalsFor(ls), vat, [product({ id: "p2", costLines: [] })], settings);
    expect(out.map((o) => o.margin)).toEqual([null, null]);
    expect(out[1].productId).toBe("p2");
  });

  it("counts a line only for a choice when that choice is on the item", () => {
    const p = product({
      costLines: [
        { id: "c1", kind: "other", name: "Box", cents: 1000, logic: "all", conditions: [] },
        { id: "c2", kind: "other", name: "Tier", cents: 4000, logic: "all", conditions: [{ kind: "chosen", negate: false, variationId: LARGE, optionValueId: null, extraId: null }] },
      ],
    });
    const without = [line({ quantity: "1" })];
    const withLarge = [line({ quantity: "1", variationId: LARGE })];
    expect(lineMargins(values(without), totalsFor(without), vat, [p], settings)[0].margin?.costCents).toBe(1000);
    expect(lineMargins(values(withLarge), totalsFor(withLarge), vat, [p], settings)[0].margin?.costCents).toBe(5000);
  });

  it("revenue is after the item's discount", () => {
    const ls = [line({ quantity: "1", discountKind: "percent", discountValue: "10" })];
    const totals = calculateDocument({ lines: [{ id: "a", quantityMilli: 1000, unitPriceCents: 10_000, vatStatus: "standard", discount: { kind: "percent", basisPoints: 1000 } }], vat });
    expect(lineMargins(values(ls), totals, vat, [product()], settings)[0].margin?.revenueCents).toBe(9000);
  });

  it("nothing until the totals can be worked out; blank lines are skipped", () => {
    expect(lineMargins(values([line()]), null, vat, [product()], settings)).toEqual([]);
    const ls = [line({ key: "x", name: "", productId: "", quantity: "", unitPrice: "" })];
    expect(lineMargins(values(ls), totalsFor([line({ key: "y" })]), vat, [], settings)).toEqual([]);
  });
});

describe("an extra's own costs", () => {
  const WRAP = "33333333-3333-4333-8333-333333333333";
  const withWrap = product({
    costLines: [{ id: "c1", kind: "other", name: "Box", cents: 2500, logic: "all", conditions: [] }],
    extras: [
      {
        id: WRAP,
        name: "Gift wrap",
        priceCents: 3000,
        asksForWording: false,
        textMax: 100,
        shared: true,
        usedOn: 1,
        priceByVariation: false,
        prices: {},
        costLines: [
          { id: "x1", kind: "other", name: "Paper", cents: 400, logic: "all", conditions: [] },
          { id: "x2", kind: "time", minutes: 5, logic: "all", conditions: [] },
        ],
      },
    ],
  });
  const wrapOption = { groupId: "", group: "Gift wrap", kind: "any" as const, valueId: WRAP, value: "", text: "", amountCents: 3000 };

  it("counts what is in the extra once for each item", () => {
    const ls = [line({ quantity: "2", options: [wrapOption] })];
    const [m] = lineMargins(values(ls), totalsFor(ls), vat, [withWrap], settings);
    // 2 cakes: 2 × R25,00; 2 wraps: 2 × (R4,00 + 5 minutes at R120 an hour = R10,00)
    expect(m.margin).toMatchObject({ costCents: 5000 + 2800 });
  });

  it("counts a fixed number of an extra, whatever the quantity", () => {
    const ls = [line({ quantity: "5", options: [{ ...wrapOption, quantityMilli: 1000 }] })];
    const [m] = lineMargins(values(ls), totalsFor(ls), vat, [withWrap], settings);
    expect(m.margin?.costCents).toBe(5 * 2500 + 1400);
  });

  it("an extra the item does not have costs nothing, and a product with only an extra's cost is costed", () => {
    const ls = [line({ quantity: "1" })];
    expect(lineMargins(values(ls), totalsFor(ls), vat, [withWrap], settings)[0].margin?.costCents).toBe(2500);
    const onlyExtra = { ...withWrap, costLines: [] };
    const ls2 = [line({ quantity: "1", options: [wrapOption] })];
    expect(lineMargins(values(ls2), totalsFor(ls2), vat, [onlyExtra], settings)[0].margin?.costCents).toBe(1400);
  });

  it("names each part with its extra", () => {
    const r = costItem({ quantityMilli: 1000, chosenIds: [], extras: extrasOn([wrapOption], 1000), revenueCents: 10_000, product: withWrap, unitCostCents: null, settings });
    expect(r.parts.map((p) => p.label)).toEqual(["Box", "Gift wrap: Paper", "Gift wrap: Your time"]);
  });

  it("extrasOn takes only extras (not a list choice) and the item's quantity unless a count is fixed", () => {
    expect(extrasOn([wrapOption, { ...wrapOption, kind: "one", valueId: "v" }, { ...wrapOption, valueId: null }], 3000)).toEqual([{ id: WRAP, countMilli: 3000 }]);
    expect(extrasOn([{ ...wrapOption, quantityMilli: 2000 }], 3000)).toEqual([{ id: WRAP, countMilli: 2000 }]);
  });
});
