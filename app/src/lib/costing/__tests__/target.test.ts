import { describe, expect, it } from "vitest";
import { lineNetCents } from "../../money/document";
import { parseTargetMargin, priceForMarginCents, priceToEnterCents, targetStanding } from "../target";

describe("parseTargetMargin", () => {
  it("reads a percentage from 1 to 99, and empty as not set", () => {
    expect(parseTargetMargin("40")).toEqual({ ok: true, value: 4000 });
    expect(parseTargetMargin(" 12,5 % ")).toEqual({ ok: true, value: 1250 });
    expect(parseTargetMargin("1")).toEqual({ ok: true, value: 100 });
    expect(parseTargetMargin("99")).toEqual({ ok: true, value: 9900 });
    expect(parseTargetMargin("")).toEqual({ ok: true, value: null });
    expect(parseTargetMargin("   ")).toEqual({ ok: true, value: null });
    expect(parseTargetMargin(undefined)).toEqual({ ok: true, value: null });
  });
  it("refuses what is not a margin, saying how to fix it", () => {
    for (const bad of ["0", "0,5", "100", "150", "-5", "abc"]) {
      const r = parseTargetMargin(bad);
      expect(r.ok).toBe(false);
    }
    expect(parseTargetMargin("100")).toEqual({ ok: false, error: "Enter a margin from 1 to 99 percent, like 40." });
  });
});

describe("targetStanding", () => {
  it("meets at the target exactly, is below one basis point under, and says nothing without both", () => {
    expect(targetStanding(4000, 4000)).toBe("meets");
    expect(targetStanding(4001, 4000)).toBe("meets");
    expect(targetStanding(3999, 4000)).toBe("below");
    expect(targetStanding(-500, 4000)).toBe("below");
    expect(targetStanding(null, 4000)).toBeNull();
    expect(targetStanding(4000, null)).toBeNull();
  });
});

describe("priceForMarginCents", () => {
  it("is cost ÷ (1 − margin): a cost of R60 at 40% is R100", () => {
    expect(priceForMarginCents(6000, 4000)).toBe(10000);
    expect(priceForMarginCents(5000, 5000)).toBe(10000); // 50% margin is double the cost, not 1.5 times
  });
  it("rounds UP to the cent, so the margin is never under the target", () => {
    // R10,00 at 33% is R14,9253... so R14,93
    expect(priceForMarginCents(1000, 3300)).toBe(1493);
    // exact: no extra cent
    expect(priceForMarginCents(7500, 2500)).toBe(10000);
    for (const cost of [1, 7, 99, 1234, 98765]) {
      for (const bp of [100, 1250, 3333, 4000, 9900]) {
        const price = priceForMarginCents(cost, bp)!;
        // The margin of that price is at least the target; one cent less is not enough.
        expect((price - cost) * 10_000 >= bp * price).toBe(true);
        expect((price - 1 - cost) * 10_000 >= bp * (price - 1)).toBe(false);
      }
    }
  });
  it("has no answer without a cost, with a target outside 1% to 99%, or too large for money", () => {
    expect(priceForMarginCents(0, 4000)).toBeNull();
    expect(priceForMarginCents(-5, 4000)).toBeNull();
    expect(priceForMarginCents(1000, 0)).toBeNull();
    expect(priceForMarginCents(1000, 10000)).toBeNull();
    expect(priceForMarginCents(99_999_999_999, 9900)).toBeNull();
  });
});

describe("priceToEnterCents", () => {
  const inclusive = { registered: true, entry: "inclusive", standardRateBp: 1500 } as const;
  const exclusive = { registered: true, entry: "exclusive", standardRateBp: 1500 } as const;
  it("adds the VAT only when prices are entered including it and the item is at the standard rate", () => {
    expect(priceToEnterCents(10000, inclusive)).toBe(11500);
    expect(priceToEnterCents(10000, inclusive, "zero")).toBe(10000);
    expect(priceToEnterCents(10000, inclusive, "exempt")).toBe(10000);
    expect(priceToEnterCents(10000, exclusive)).toBe(10000);
    expect(priceToEnterCents(10000, { registered: false })).toBe(10000);
  });
  it("never leaves less than the price without VAT once the VAT is taken out again", () => {
    for (const net of [1, 3, 99, 1493, 8696, 123_456]) {
      const entered = priceToEnterCents(net, inclusive)!;
      const back = lineNetCents({ amountCents: entered, vatStatus: "standard" }, inclusive);
      expect(back).toBeGreaterThanOrEqual(net);
      expect(back).toBeLessThanOrEqual(net + 1);
    }
  });
  it("has no answer when the result is too large for money", () => {
    expect(priceToEnterCents(99_999_999_999, inclusive)).toBeNull();
  });
});
