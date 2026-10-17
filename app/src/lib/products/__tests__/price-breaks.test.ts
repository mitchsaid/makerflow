import { describe, expect, it } from "vitest";
import { parseProductForm } from "../index";
import {
  breakAt,
  breaksFor,
  carryPriceBreaks,
  parsePriceBreaks,
  priceAfter,
  priceBreaksPayload,
  priceBreakText,
  quantityPrice,
  referencePrice,
  sentPriceBreaks,
  type PriceBreak,
  type PriceBreakFormRow,
} from "../price-breaks";
import { ZA_NUMBER_STYLE } from "@/lib/locale/za";

const row = (over: Partial<PriceBreakFormRow> = {}): PriceBreakFormRow => ({ key: "k1", variationKey: "", from: "10", kind: "percent", value: "10", ...over });
const pct = (fromMilli: number, bp: number, variationId: string | null = null): PriceBreak => ({ variationId, fromMilli, off: { kind: "percent", bp } });
const amt = (fromMilli: number, cents: number, variationId: string | null = null): PriceBreak => ({ variationId, fromMilli, off: { kind: "amount", cents } });
const BREAKS: PriceBreak[] = [pct(10_000, 1_000), pct(50_000, 2_500)];
const money = (cents: number) => `R${(cents / 100).toFixed(2).replace(".", ",")}`;

describe("parsePriceBreaks", () => {
  it("reads rows into thousandths and hundredths of a percent, in order of quantity", () => {
    const r = parsePriceBreaks([row({ key: "b", from: "50", value: "25" }), row({ key: "a", from: "10", value: "12,5" })]);
    expect(r).toEqual({
      ok: true,
      breaks: [
        { variationIndex: null, fromMilli: 10_000, off: { kind: "percent", bp: 1_250 } },
        { variationIndex: null, fromMilli: 50_000, off: { kind: "percent", bp: 2_500 } },
      ],
    });
  });

  it("reads an amount in cents", () => {
    const r = parsePriceBreaks([row({ kind: "amount", value: "20,50" })], [], { single: 10_000, variations: [] });
    expect(r).toEqual({ ok: true, breaks: [{ variationIndex: null, fromMilli: 10_000, off: { kind: "amount", cents: 2_050 } }] });
  });

  it("no rows is fine", () => {
    expect(parsePriceBreaks([])).toEqual({ ok: true, breaks: [] });
  });

  it("says how to fix each problem at its row", () => {
    const r = parsePriceBreaks([
      row({ key: "a", from: "", value: "" }),
      row({ key: "b", from: "abc", value: "0" }),
      row({ key: "c", from: "5", value: "100" }),
      row({ key: "d", from: "20", value: "10" }),
      row({ key: "e", from: "20", value: "15" }),
    ]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.a.from).toMatch(/starts at/);
    expect(r.errors.rows.a.value).toMatch(/taken off/);
    expect(r.errors.rows.b.from).toBeTruthy();
    expect(r.errors.rows.b.value).toMatch(/above 0 and below 100/);
    expect(r.errors.rows.c.value).toMatch(/above 0 and below 100/);
    expect(r.errors.rows.e.from).toMatch(/Another row starts at this quantity/);
    expect(r.errors.rows.d).toBeUndefined();
  });

  it("refuses an amount of nothing, one that is not money, and one that takes off the whole price or more", () => {
    const r = parsePriceBreaks(
      [
        row({ key: "zero", kind: "amount", value: "0" }),
        row({ key: "text", from: "11", kind: "amount", value: "lots" }),
        row({ key: "all", from: "12", kind: "amount", value: "100" }),
        row({ key: "more", from: "13", kind: "amount", value: "150" }),
        row({ key: "ok", from: "14", kind: "amount", value: "99,99" }),
        row({ key: "blank", from: "15", kind: "amount", value: "" }),
      ],
      [],
      { single: 10_000, variations: [] },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.zero.value).toMatch(/above 0/);
    expect(r.errors.rows.text.value).toBeTruthy();
    expect(r.errors.rows.all.value).toMatch(/less than the price/);
    expect(r.errors.rows.more.value).toMatch(/less than the price/);
    expect(r.errors.rows.blank.value).toMatch(/taken off/);
    expect(r.errors.rows.ok).toBeUndefined();
  });

  it("an amount is checked against the price it comes off: the variation's own", () => {
    const rows = [
      row({ key: "s", variationKey: "small", kind: "amount", value: "150" }),
      row({ key: "l", variationKey: "large", from: "10", kind: "amount", value: "150" }),
    ];
    const r = parsePriceBreaks(rows, ["small", "large"], { single: undefined, variations: [10_000, 60_000] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.s.value).toMatch(/less than the price/);
    expect(r.errors.rows.l).toBeUndefined();
  });

  it("each variation has its own rows: the same quantity on two is fine, on one twice is not, and ten for each", () => {
    const ok = parsePriceBreaks([row({ key: "a", variationKey: "s" }), row({ key: "b", variationKey: "l" })], ["s", "l"]);
    expect(ok).toEqual({
      ok: true,
      breaks: [
        { variationIndex: 0, fromMilli: 10_000, off: { kind: "percent", bp: 1_000 } },
        { variationIndex: 1, fromMilli: 10_000, off: { kind: "percent", bp: 1_000 } },
      ],
    });
    const twice = parsePriceBreaks([row({ key: "a", variationKey: "s" }), row({ key: "b", variationKey: "s" })], ["s", "l"]);
    expect(!twice.ok && twice.errors.rows.b.from).toMatch(/Another row/);
    const many = (scope: string) => Array.from({ length: 10 }, (_, i) => row({ key: `${scope}${i}`, variationKey: scope, from: String(i + 1) }));
    expect(parsePriceBreaks([...many("s"), ...many("l")], ["s", "l"]).ok).toBe(true);
    const eleven = parsePriceBreaks([...many("s"), row({ key: "extra", variationKey: "s", from: "50" })], ["s", "l"]);
    expect(!eleven.ok && eleven.errors.list).toMatch(/10/);
  });

  it("a row for a variation that was removed, or for the product when it has variations, is a problem at the row", () => {
    const gone = parsePriceBreaks([row({ key: "a", variationKey: "removed" })], ["s", "l"]);
    expect(!gone.ok && gone.errors.rows.a.from).toMatch(/removed/);
    const own = parsePriceBreaks([row({ key: "a", variationKey: "" })], ["s", "l"]);
    expect(!own.ok && own.errors.rows.a.from).toMatch(/on a variation/);
    const forNone = parsePriceBreaks([row({ key: "a", variationKey: "s" })], []);
    expect(!forNone.ok && forNone.errors.rows.a.from).toMatch(/removed/);
  });

  it("refuses a list it cannot read, and reads a row from a form that only knew percent", () => {
    const bad = parsePriceBreaks("nope");
    expect(!bad.ok && bad.errors.list).toMatch(/could not be read/);
    const odd = parsePriceBreaks([{ key: "a", from: "10" }]);
    expect(!odd.ok && odd.errors.list).toMatch(/could not be read/);
    const old = parsePriceBreaks([{ key: "a", from: "10", percent: "10" }]);
    expect(old).toEqual({ ok: true, breaks: [{ variationIndex: null, fromMilli: 10_000, off: { kind: "percent", bp: 1_000 } }] });
  });

  it("is sent to the database with the variation's place and one kind of reduction", () => {
    const parsed = parsePriceBreaks([row({ key: "a", variationKey: "l", kind: "amount", value: "5" }), row({ key: "b", variationKey: "l", from: "20", value: "10" })], ["s", "l"]);
    expect(parsed.ok && priceBreaksPayload(parsed.breaks)).toEqual([
      { from_quantity_milli: 10_000, amount_off_cents: 500, variation: 1 },
      { from_quantity_milli: 20_000, percent_off_bp: 1_000, variation: 1 },
    ]);
  });
});

describe("carrying quantity prices between one price and variations", () => {
  const rows = [row({ key: "own", variationKey: "" }), row({ key: "s", variationKey: "small" }), row({ key: "l", variationKey: "large" })];

  it("when variations start, the product's rows go to the first variation", () => {
    const next = carryPriceBreaks(rows, [], [{ key: "small" }, { key: "large" }]);
    expect(next.map((r) => r.variationKey)).toEqual(["small", "small", "large"]);
  });

  it("when the last variation goes, the first one's rows go back to the product; others are kept", () => {
    const next = carryPriceBreaks(rows, [{ key: "small" }, { key: "large" }], []);
    expect(next.map((r) => r.variationKey)).toEqual(["", "", "large"]);
  });

  it("otherwise nothing moves, and only the rows that fit the price are sent", () => {
    expect(carryPriceBreaks(rows, [{ key: "small" }], [{ key: "small" }, { key: "large" }]).map((r) => r.variationKey)).toEqual(["", "small", "large"]);
    expect(sentPriceBreaks(rows, []).map((r) => r.key)).toEqual(["own"]);
    expect(sentPriceBreaks(rows, [{ key: "small" }]).map((r) => r.key)).toEqual(["s"]);
    expect(sentPriceBreaks(rows, [{ key: "small" }, { key: "large" }]).map((r) => r.key)).toEqual(["s", "l"]);
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
    expect(quantityPrice(1_234, [pct(1_000, 1_250)], 1_000).cents).toBe(1_080);
    expect(quantityPrice(50, [pct(1_000, 1_000)], 1_000).cents).toBe(45);
    // exactly half a cent rounds up: 5c less 10% = 4,5c -> 5c
    expect(quantityPrice(5, [pct(1_000, 1_000)], 1_000).cents).toBe(5);
    expect(quantityPrice(0, BREAKS, 10_000).cents).toBe(0);
  });

  it("takes an amount off the price, never below nothing", () => {
    expect(priceAfter(10_000, { kind: "amount", cents: 1_500 })).toBe(8_500);
    expect(priceAfter(1_000, { kind: "amount", cents: 1_500 })).toBe(0);
    expect(quantityPrice(10_000, [amt(5_000, 2_000)], 5_000)).toEqual({ cents: 8_000, applied: amt(5_000, 2_000) });
  });

  it("stays exact for the largest price", () => {
    expect(quantityPrice(99_999_999_999, [pct(1_000, 9_999)], 1_000).cents).toBe(10_000_000);
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
    priceBreaks: [pct(10_000, 1_000, "s"), amt(10_000, 5_000, "l"), amt(50_000, 15_000, "l")],
  };

  it("uses the product's price, or the chosen variation's, at the quantity typed", () => {
    expect(referencePrice(plain, undefined, "1")?.cents).toBe(10_000);
    expect(referencePrice(plain, undefined, "10")?.cents).toBe(9_000);
    expect(referencePrice(sized, "l", "50")?.cents).toBe(45_000);
    expect(referencePrice(sized, "s", "10")?.cents).toBe(27_000);
  });

  it("each variation uses only its own rows", () => {
    expect(referencePrice(sized, "s", "50")?.cents).toBe(27_000);
    expect(referencePrice(sized, "l", "10")?.cents).toBe(55_000);
    expect(referencePrice(sized, "l", "9")?.cents).toBe(60_000);
    expect(breaksFor(sized.priceBreaks, "l")).toHaveLength(2);
    expect(breaksFor(sized.priceBreaks, null)).toHaveLength(0);
  });

  it("a product with one price ignores rows that belong to a variation", () => {
    expect(referencePrice({ ...plain, priceBreaks: [pct(1_000, 5_000, "gone")] }, undefined, "5")?.cents).toBe(10_000);
  });

  it("has no price when variations exist and none is chosen, and treats an unreadable quantity as 1", () => {
    expect(referencePrice(sized, undefined, "10")).toBeUndefined();
    expect(referencePrice(plain, undefined, "x")?.cents).toBe(10_000);
    expect(referencePrice(plain, undefined, "0,5")?.cents).toBe(10_000);
  });
});

describe("priceBreakText", () => {
  it("says it in words, with the unit", () => {
    expect(priceBreakText(BREAKS[0], null, ZA_NUMBER_STYLE, money)).toBe("10 or more: 10% off");
    expect(priceBreakText(pct(2_500, 1_250), "kg", ZA_NUMBER_STYLE, money)).toBe("2,5 kg or more: 12,5% off");
    expect(priceBreakText(amt(10_000, 2_000), null, ZA_NUMBER_STYLE, money)).toBe("10 or more: R20,00 off");
  });
});

describe("the product form", () => {
  const form = (rows?: unknown, extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set("kind", "product");
    f.set("name", "Cupcakes");
    f.set("unitPrice", "100");
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    if (rows !== undefined) f.set("priceBreaks", JSON.stringify(rows));
    return f;
  };

  it("carries the quantity prices when the form had them, and leaves them alone when it did not", () => {
    const withRows = parseProductForm(form([row()]));
    expect(withRows.ok && withRows.value.priceBreaks).toEqual([{ variationIndex: null, fromMilli: 10_000, off: { kind: "percent", bp: 1_000 } }]);
    const without = parseProductForm(form());
    expect(without.ok && "priceBreaks" in without.value).toBe(false);
  });

  it("reports a bad row at that row", () => {
    const r = parseProductForm(form([row({ value: "" })]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.priceBreaks?.rows.k1.value).toBeTruthy();
  });

  it("checks an amount against the product's price", () => {
    const r = parseProductForm(form([row({ kind: "amount", value: "100" })]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.priceBreaks?.rows.k1.value).toMatch(/less than the price/);
    expect(parseProductForm(form([row({ kind: "amount", value: "99,99" })])).ok).toBe(true);
  });

  it("puts a variation's rows on the variation, by place, and checks them against that variation's price", () => {
    const variations = JSON.stringify([
      { key: "s", id: "", name: "Small", price: "300", usual: false },
      { key: "l", id: "", name: "Large", price: "600", usual: false },
    ]);
    const extra = { variationLabel: "Size", variations, unitPrice: "" };
    const good = parseProductForm(form([row({ key: "a", variationKey: "l", kind: "amount", value: "100" })], extra));
    expect(good.ok && good.value.priceBreaks).toEqual([{ variationIndex: 1, fromMilli: 10_000, off: { kind: "amount", cents: 10_000 } }]);
    const bad = parseProductForm(form([row({ key: "a", variationKey: "s", kind: "amount", value: "300" })], extra));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.priceBreaks?.rows.a.value).toMatch(/less than the price/);
  });
});
