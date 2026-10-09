import { describe, expect, it } from "vitest";
import {
  calculateDeposit,
  calculateDocument,
  type Discount,
  type LineInput,
  type VatSettings,
} from "../document";

const NOT_REGISTERED: VatSettings = { registered: false };
const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const EXCLUSIVE: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };

const line = (
  id: string,
  qty: number,
  priceCents: number,
  extra: Partial<LineInput> = {},
): LineInput => ({
  id,
  quantityMilli: qty * 1000,
  unitPriceCents: priceCents,
  vatStatus: "standard",
  ...extra,
});

describe("lines and discounts", () => {
  it("multiplies quantity by price exactly, including fractional quantities", () => {
    const t = calculateDocument({
      lines: [
        { id: "a", quantityMilli: 500, unitPriceCents: 9999, vatStatus: "standard" }, // 0.5 x R99.99
        { id: "b", quantityMilli: 3000, unitPriceCents: 1250, vatStatus: "standard" }, // 3 x R12.50
      ],
      vat: NOT_REGISTERED,
    });
    expect(t.lines.map((l) => l.amountCents)).toEqual([5000, 3750]);
    expect(t.grossCents).toBe(8750);
  });

  it("takes line discounts off the line (percentage and fixed, fixed never below zero)", () => {
    const t = calculateDocument({
      lines: [
        line("a", 2, 10_000, { discount: { kind: "percent", basisPoints: 1000 } }), // R200 - 10%
        line("b", 1, 5000, { discount: { kind: "fixed", cents: 99_999 } }), // R50 - more than R50
      ],
      vat: NOT_REGISTERED,
    });
    expect(t.lines[0].lineDiscountCents).toBe(2000);
    expect(t.lines[0].amountCents).toBe(18_000);
    expect(t.lines[1].lineDiscountCents).toBe(5000);
    expect(t.lines[1].amountCents).toBe(0);
    expect(t.lineDiscountsCents).toBe(7000);
  });

  it("shares a quote-level discount across lines with exact cents", () => {
    const t = calculateDocument({
      lines: [line("a", 1, 10_000), line("b", 1, 10_000), line("c", 1, 10_000)],
      quoteDiscount: { kind: "fixed", cents: 100 },
      vat: NOT_REGISTERED,
    });
    expect(t.quoteDiscountCents).toBe(100);
    expect(t.lines.map((l) => l.quoteDiscountShareCents)).toEqual([34, 33, 33]);
    expect(t.subtotalCents).toBe(29_900);
  });

  it("works out a percentage quote discount on the sum after line discounts", () => {
    const t = calculateDocument({
      lines: [line("a", 1, 10_000, { discount: { kind: "fixed", cents: 2000 } }), line("b", 1, 12_000)],
      quoteDiscount: { kind: "percent", basisPoints: 500 }, // 5% of R200
      vat: NOT_REGISTERED,
    });
    expect(t.quoteDiscountCents).toBe(1000);
    expect(t.grossCents).toBe(19_000);
  });
});

describe("amounts charged once for a line", () => {
  it("adds them after quantity x price, before the line's discount, and VAT is on the whole", () => {
    // 12 cupcakes at R17 (R15 plus R2 of sprinkles each) and a R30 gift box once: R234.
    const t = calculateDocument({ lines: [line("a", 12, 1700, { onceCents: 3000 })], vat: NOT_REGISTERED });
    expect(t.lines[0].amountBeforeDiscountCents).toBe(23400);
    const d = calculateDocument({
      lines: [line("a", 12, 1700, { onceCents: 3000, discount: { kind: "percent", basisPoints: 1000 } })],
      vat: INCLUSIVE,
    });
    expect(d.lines[0].lineDiscountCents).toBe(2340);
    expect(d.grossCents).toBe(21060);
    expect(d.vatCents).toBe(Math.round((21060 * 15) / 115));
  });

  it("refuses a negative or fractional one", () => {
    expect(() => calculateDocument({ lines: [line("a", 1, 100, { onceCents: -1 })], vat: NOT_REGISTERED })).toThrow();
    expect(() => calculateDocument({ lines: [line("a", 1, 100, { onceCents: 1.5 })], vat: NOT_REGISTERED })).toThrow();
  });
});

describe("VAT", () => {
  it("not registered: no VAT at all", () => {
    const t = calculateDocument({ lines: [line("a", 1, 115_000)], vat: NOT_REGISTERED });
    expect(t.vatCents).toBe(0);
    expect(t.netCents).toBe(115_000);
    expect(t.grossCents).toBe(115_000);
    expect(t.groups.map((g) => g.vatStatus)).toEqual(["standard"]);
  });

  it("inclusive: the VAT is inside the amount (R1 150 includes R150)", () => {
    const t = calculateDocument({ lines: [line("a", 1, 115_000)], vat: INCLUSIVE });
    expect(t.vatCents).toBe(15_000);
    expect(t.netCents).toBe(100_000);
    expect(t.grossCents).toBe(115_000);
  });

  it("inclusive: rounds the VAT to the cent, halves up (R100 includes R13.04)", () => {
    const t = calculateDocument({ lines: [line("a", 1, 10_000)], vat: INCLUSIVE });
    expect(t.vatCents).toBe(1304); // 15/115 of 10000 = 1304.35
    expect(t.netCents).toBe(8696);
    expect(t.grossCents).toBe(10_000);
  });

  it("exclusive: the VAT is added on top (R16 000 plus R2 400, as in SARS's example)", () => {
    const t = calculateDocument({
      lines: [line("a", 1, 100_000), line("b", 1, 1_000_000), line("c", 1, 500_000)],
      vat: EXCLUSIVE,
    });
    expect(t.subtotalCents).toBe(1_600_000);
    expect(t.vatCents).toBe(240_000);
    expect(t.grossCents).toBe(1_840_000);
  });

  it("charges VAT once per status, not line by line (no rounding drift)", () => {
    // 10 lines of R0.10 excluding VAT: per line the VAT is 1.5c -> 2c (R0.20 in all);
    // on the group total R1.00 the VAT is exactly R0.15.
    const lines = Array.from({ length: 10 }, (_, i) => line(`l${i}`, 1, 10));
    const t = calculateDocument({ lines, vat: EXCLUSIVE });
    expect(t.vatCents).toBe(15);
    expect(t.grossCents).toBe(115);
  });

  it("taxes standard lines only, and shows zero-rated and exempt lines as their own groups", () => {
    const t = calculateDocument({
      lines: [
        line("shuttle", 2, 15_000, { vatStatus: "exempt" }),
        line("guide", 1, 100_000),
        line("rooms", 4, 250_000),
        line("art", 5, 100_000),
        line("diesel", 1, 20_000, { vatStatus: "zero" }),
      ],
      vat: EXCLUSIVE,
    });
    const standard = t.groups.find((g) => g.vatStatus === "standard")!;
    expect(standard.amountCents).toBe(1_600_000); // 1 000 + 10 000 + 5 000 rands
    expect(standard.vatCents).toBe(240_000);
    expect(t.groups.map((g) => g.vatStatus)).toEqual(["standard", "zero", "exempt"]);
    expect(t.vatCents).toBe(240_000);
    expect(t.grossCents).toBe(1_600_000 + 20_000 + 30_000 + 240_000);
  });

  it("charges VAT on discounted amounts, never before the discount", () => {
    const withDiscount = calculateDocument({
      lines: [line("a", 1, 100_000)],
      quoteDiscount: { kind: "percent", basisPoints: 1000 },
      vat: EXCLUSIVE,
    });
    expect(withDiscount.subtotalCents).toBe(90_000);
    expect(withDiscount.vatCents).toBe(13_500);
    expect(withDiscount.grossCents).toBe(103_500);
  });

  it("an empty document is all zeros", () => {
    const t = calculateDocument({ lines: [], vat: INCLUSIVE });
    expect(t).toMatchObject({ subtotalCents: 0, vatCents: 0, grossCents: 0, groups: [] });
  });
});

describe("deposits", () => {
  it("percentage deposits round to the cent and the balance makes the total exact", () => {
    expect(calculateDeposit(10_001, { kind: "percent", basisPoints: 5000 })).toEqual({
      depositCents: 5001, // 5000.5 -> 5001
      balanceCents: 5000,
    });
    expect(calculateDeposit(100_000, { kind: "percent", basisPoints: 3333 })).toEqual({
      depositCents: 33_330,
      balanceCents: 66_670,
    });
  });

  it("fixed deposits are capped at the total", () => {
    expect(calculateDeposit(50_000, { kind: "fixed", cents: 20_000 })).toEqual({
      depositCents: 20_000,
      balanceCents: 30_000,
    });
    expect(calculateDeposit(50_000, { kind: "fixed", cents: 90_000 })).toEqual({
      depositCents: 50_000,
      balanceCents: 0,
    });
  });
});

describe("invalid input", () => {
  it("throws on negatives, fractions and impossible percentages", () => {
    expect(() => calculateDocument({ lines: [line("a", 1, -5)], vat: NOT_REGISTERED })).toThrow();
    expect(() =>
      calculateDocument({
        lines: [{ id: "a", quantityMilli: 1.5, unitPriceCents: 100, vatStatus: "standard" }],
        vat: NOT_REGISTERED,
      }),
    ).toThrow();
    expect(() =>
      calculateDocument({
        lines: [line("a", 1, 100)],
        quoteDiscount: { kind: "percent", basisPoints: 20_000 },
        vat: NOT_REGISTERED,
      }),
    ).toThrow();
    expect(() => calculateDeposit(100, { kind: "percent", basisPoints: -1 })).toThrow();
  });
});

describe("invariants over many random documents", () => {
  function prng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  it("always adds up, in every VAT mode", () => {
    const random = prng(2026);
    const modes: VatSettings[] = [NOT_REGISTERED, INCLUSIVE, EXCLUSIVE];
    for (let i = 0; i < 400; i++) {
      const lines: LineInput[] = Array.from({ length: 1 + Math.floor(random() * 6) }, (_, j) => {
        const status = (["standard", "standard", "standard", "zero", "exempt"] as const)[
          Math.floor(random() * 5)
        ];
        const discount: Discount | undefined =
          random() < 0.3
            ? random() < 0.5
              ? { kind: "percent", basisPoints: Math.floor(random() * 10_001) }
              : { kind: "fixed", cents: Math.floor(random() * 200_000) }
            : undefined;
        return {
          id: `l${j}`,
          quantityMilli: 1 + Math.floor(random() * 20_000),
          unitPriceCents: Math.floor(random() * 1_000_000),
          vatStatus: status,
          discount,
        };
      });
      const quoteDiscount: Discount | undefined =
        random() < 0.4 ? { kind: "percent", basisPoints: Math.floor(random() * 10_001) } : undefined;
      const vat = modes[Math.floor(random() * 3)];
      const t = calculateDocument({ lines, quoteDiscount, vat });

      // lines add up to the subtotal; shares add up to the quote discount
      expect(t.lines.reduce((a, l) => a + l.amountCents, 0)).toBe(t.subtotalCents);
      expect(t.lines.reduce((a, l) => a + l.quoteDiscountShareCents, 0)).toBe(t.quoteDiscountCents);
      t.lines.forEach((l) => {
        expect(l.amountCents).toBeGreaterThanOrEqual(0);
        expect(l.amountBeforeDiscountCents - l.lineDiscountCents - l.quoteDiscountShareCents).toBe(
          l.amountCents,
        );
      });
      // net + VAT = gross, per group and overall
      t.groups.forEach((g) => expect(g.netCents + g.vatCents).toBe(g.grossCents));
      expect(t.netCents + t.vatCents).toBe(t.grossCents);
      // groups add up to the subtotal in the entry mode
      expect(t.groups.reduce((a, g) => a + g.amountCents, 0)).toBe(t.subtotalCents);
      // nothing is taxed unless registered and standard-rated
      if (!vat.registered) expect(t.vatCents).toBe(0);
      t.groups.filter((g) => g.vatStatus !== "standard").forEach((g) => expect(g.vatCents).toBe(0));
      // inclusive mode never changes the customer's total; exclusive mode only adds VAT
      if (vat.registered && vat.entry === "inclusive") expect(t.grossCents).toBe(t.subtotalCents);
      if (vat.registered && vat.entry === "exclusive") {
        expect(t.grossCents).toBe(t.subtotalCents + t.vatCents);
      }
    }
  });
});
