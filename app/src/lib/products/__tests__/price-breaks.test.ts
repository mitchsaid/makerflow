import { describe, expect, it } from "vitest";
import { parseProductForm } from "../index";
import { breakAt, parsePriceBreaks, priceBreakText, quantityPrice, referencePrice, type PriceBreak, type PriceBreakFormRow } from "../price-breaks";
import { ZA_NUMBER_STYLE } from "@/lib/locale/za";

const row = (over: Partial<PriceBreakFormRow> = {}): PriceBreakFormRow => ({ key: "k1", from: "10", percent: "10", ...over });
const BREAKS: PriceBreak[] = [
  { fromMilli: 10_000, percentBp: 1_000 },
  { fromMilli: 50_000, percentBp: 2_500 },
];

describe("parsePriceBreaks", () => {
  it("reads rows into thousandths and hundredths of a percent, in order of quantity", () => {
    const r = parsePriceBreaks([row({ key: "b", from: "50", percent: "25" }), row({ key: "a", from: "10", percent: "12,5" })]);
    expect(r).toEqual({
      ok: true,
      breaks: [
        { fromMilli: 10_000, percentBp: 1_250 },
        { fromMilli: 50_000, percentBp: 2_500 },
      ],
    });
  });

  it("no rows is fine", () => {
    expect(parsePriceBreaks([])).toEqual({ ok: true, breaks: [] });
  });

  it("says how to fix each problem at its row", () => {
    const r = parsePriceBreaks([
      row({ key: "a", from: "", percent: "" }),
      row({ key: "b", from: "abc", percent: "0" }),
      row({ key: "c", from: "5", percent: "100" }),
      row({ key: "d", from: "20", percent: "10" }),
      row({ key: "e", from: "20", percent: "15" }),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.a.from).toMatch(/starts at/);
    expect(r.errors.rows.a.percent).toMatch(/taken off/);
    expect(r.errors.rows.b.from).toBeTruthy();
    expect(r.errors.rows.b.percent).toMatch(/above 0 and below 100/);
    expect(r.errors.rows.c.percent).toMatch(/above 0 and below 100/);
    expect(r.errors.rows.e.from).toMatch(/Another row starts at this quantity/);
    expect(r.errors.rows.d).toBeUndefined();
  });

  it("refuses more than ten rows, and a list it cannot read", () => {
    const many = parsePriceBreaks(Array.from({ length: 11 }, (_, i) => row({ key: `k${i}`, from: String(i + 2) })));
    expect(!many.ok && many.errors.list).toMatch(/10/);
    const bad = parsePriceBreaks("nope");
    expect(!bad.ok && bad.errors.list).toMatch(/could not be read/);
  });
});

describe("breakAt and quantityPrice", () => {
  it("applies no row below the first quantity, and the right row at and above each start", () => {
    expect(breakAt(BREAKS, 9_999)).toBeNull();
    expect(breakAt(BREAKS, 10_000)).toEqual(BREAKS[0]);
    expect(breakAt(BREAKS, 49_999)).toEqual(BREAKS[0]);
    expect(breakAt(BREAKS, 50_000)).toEqual(BREAKS[1]);
    expect(breakAt(BREAKS, 9_999_999)).toEqual(BREAKS[1]);
  });

  it("takes the percent off the price, rounded once to the cent (half up)", () => {
    expect(quantityPrice(10_000, BREAKS, 1_000)).toEqual({ cents: 10_000, applied: null });
    expect(quantityPrice(10_000, BREAKS, 10_000).cents).toBe(9_000);
    expect(quantityPrice(10_000, BREAKS, 50_000).cents).toBe(7_500);
    // 12,34 less 12,5% = 10,7975 -> 10,80
    expect(quantityPrice(1_234, [{ fromMilli: 1_000, percentBp: 1_250 }], 1_000).cents).toBe(1_080);
    expect(quantityPrice(50, [{ fromMilli: 1_000, percentBp: 1_000 }], 1_000).cents).toBe(45);
    // exactly half a cent rounds up: 5c less 10% = 4,5c -> 5c
    expect(quantityPrice(5, [{ fromMilli: 1_000, percentBp: 1_000 }], 1_000).cents).toBe(5);
    expect(quantityPrice(0, BREAKS, 10_000).cents).toBe(0);
  });

  it("stays exact for the largest price", () => {
    expect(quantityPrice(99_999_999_999, [{ fromMilli: 1_000, percentBp: 9_999 }], 1_000).cents).toBe(10_000_000);
  });
});

describe("referencePrice", () => {
  const plain = { unitPriceCents: 10_000, variations: [], priceBreaks: BREAKS };
  const sized = {
    unitPriceCents: 30_000,
    variations: [
      { id: "s", priceCents: 30_000 },
      { id: "l", priceCents: 60_000 },
    ],
    priceBreaks: BREAKS,
  };

  it("uses the product's price, or the chosen variation's, at the quantity typed", () => {
    expect(referencePrice(plain, undefined, "1")?.cents).toBe(10_000);
    expect(referencePrice(plain, undefined, "10")?.cents).toBe(9_000);
    expect(referencePrice(sized, "l", "50")?.cents).toBe(45_000);
    expect(referencePrice(sized, "s", "10")?.cents).toBe(27_000);
  });

  it("has no price when variations exist and none is chosen, and treats an unreadable quantity as 1", () => {
    expect(referencePrice(sized, undefined, "10")).toBeUndefined();
    expect(referencePrice(plain, undefined, "x")?.cents).toBe(10_000);
    expect(referencePrice(plain, undefined, "0,5")?.cents).toBe(10_000);
  });
});

describe("priceBreakText", () => {
  it("says it in words, with the unit", () => {
    expect(priceBreakText(BREAKS[0], null, ZA_NUMBER_STYLE)).toBe("10 or more: 10% off");
    expect(priceBreakText({ fromMilli: 2_500, percentBp: 1_250 }, "kg", ZA_NUMBER_STYLE)).toBe("2,5 kg or more: 12,5% off");
  });
});

describe("the product form", () => {
  const form = (rows?: unknown) => {
    const f = new FormData();
    f.set("kind", "product");
    f.set("name", "Cupcakes");
    f.set("unitPrice", "100");
    if (rows !== undefined) f.set("priceBreaks", JSON.stringify(rows));
    return f;
  };

  it("carries the quantity prices when the form had them, and leaves them alone when it did not", () => {
    const withRows = parseProductForm(form([row()]));
    expect(withRows.ok && withRows.value.priceBreaks).toEqual([{ fromMilli: 10_000, percentBp: 1_000 }]);
    const without = parseProductForm(form());
    expect(without.ok && "priceBreaks" in without.value).toBe(false);
  });

  it("reports a bad row at that row", () => {
    const r = parseProductForm(form([row({ percent: "" })]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.priceBreaks?.rows.k1.percent).toBeTruthy();
  });
});
