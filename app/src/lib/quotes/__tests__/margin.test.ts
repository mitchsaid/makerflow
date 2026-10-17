import { describe, expect, it } from "vitest";
import type { ProductSummary } from "../../products";
import { calculateDocument } from "../../money";
import { lineMargins } from "../margin";
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
