import { describe, expect, it } from "vitest";
import type { Material } from "../../materials";
import { itemCost, itemMargin, lineApplies, marginBp, quoteMargin, type CostLine, type CostSettings } from "../index";

type Mat = Pick<Material, "unit" | "boughtQuantityMilli" | "priceCents" | "vatTreatment">;
const flour: Mat = { unit: "kg", boughtQuantityMilli: 12_500, priceCents: 18_750, vatTreatment: "none" }; // R15,00 per kg
const sugar: Mat = { unit: "kg", boughtQuantityMilli: 2_000, priceCents: 4_600, vatTreatment: "included" };
const settings = (over: Partial<CostSettings> = {}): CostSettings => ({
  materials: new Map<string, Mat>([["flour", flour], ["sugar", sugar]]),
  hourlyRateCents: 12_000,
  vatRateBp: null,
  ...over,
});
const base = { logic: "all" as const, conditions: [] };
const item = (quantityMilli = 1_000, chosenIds: string[] = []) => ({ quantityMilli, chosenIds });

describe("lineApplies", () => {
  it("a line with no conditions always applies", () => {
    expect(lineApplies({ ...base, id: "a" }, item())).toBe(true);
  });

  it("a choice applies when it was chosen, and 'not' turns it round", () => {
    const line = (negate: boolean) => ({ id: "a", logic: "all" as const, conditions: [{ kind: "chosen" as const, negate, id: "large" }] });
    expect(lineApplies(line(false), item(1_000, ["large"]))).toBe(true);
    expect(lineApplies(line(false), item(1_000, ["small"]))).toBe(false);
    expect(lineApplies(line(true), item(1_000, ["small"]))).toBe(true);
    expect(lineApplies(line(true), item(1_000, ["large"]))).toBe(false);
  });

  it("a quantity applies from the number up, and 'not' is below it", () => {
    const line = (negate: boolean) => ({ id: "a", logic: "all" as const, conditions: [{ kind: "quantity" as const, negate, quantityMilli: 12_000 }] });
    expect(lineApplies(line(false), item(12_000))).toBe(true);
    expect(lineApplies(line(false), item(11_999))).toBe(false);
    expect(lineApplies(line(true), item(11_999))).toBe(true);
    expect(lineApplies(line(true), item(12_000))).toBe(false);
  });

  it("all of several, or any of them", () => {
    const conditions = [
      { kind: "chosen" as const, negate: false, id: "large" },
      { kind: "chosen" as const, negate: false, id: "wrap" },
    ];
    expect(lineApplies({ id: "a", logic: "all", conditions }, item(1_000, ["large"]))).toBe(false);
    expect(lineApplies({ id: "a", logic: "all", conditions }, item(1_000, ["large", "wrap"]))).toBe(true);
    expect(lineApplies({ id: "a", logic: "any", conditions }, item(1_000, ["wrap"]))).toBe(true);
    expect(lineApplies({ id: "a", logic: "any", conditions }, item(1_000, []))).toBe(false);
  });
});

describe("itemCost", () => {
  it("adds the lines that apply: a material, the maker's time and another cost", () => {
    const lines: CostLine[] = [
      { ...base, id: "m", kind: "material", materialId: "flour", amountMilli: 500, unit: "kg" }, // 0,5 kg = R7,50
      { ...base, id: "t", kind: "time", minutes: 30 }, // half an hour at R120 = R60,00
      { ...base, id: "o", kind: "other", name: "Box", cents: 1_250 },
    ];
    const c = itemCost(lines, 1_000, item(), settings());
    expect(c.lines).toEqual([{ id: "m", cents: 750 }, { id: "t", cents: 6_000 }, { id: "o", cents: 1_250 }]);
    expect(c.cents).toBe(8_000);
    expect(c.problems).toEqual([]);
  });

  it("converts the amount's unit to the material's, exactly", () => {
    const lines: CostLine[] = [{ ...base, id: "m", kind: "material", materialId: "flour", amountMilli: 250_000, unit: "g" }]; // 250 g
    expect(itemCost(lines, 1_000, item(), settings()).cents).toBe(375);
  });

  it("scales by quantity and by what a batch makes, rounding once for each line", () => {
    // A batch of 12 cupcakes uses 1 kg of flour (R15,00) and 1 box (R12,50): R27,50 a batch.
    const lines: CostLine[] = [
      { ...base, id: "m", kind: "material", materialId: "flour", amountMilli: 1_000, unit: "kg" },
      { ...base, id: "o", kind: "other", name: "Box", cents: 1_250 },
    ];
    // 1 cupcake: 1500/12 = 125,0 and 1250/12 = 104,17 -> 104
    const one = itemCost(lines, 12_000, item(1_000), settings());
    expect(one.lines).toEqual([{ id: "m", cents: 125 }, { id: "o", cents: 104 }]);
    // 30 cupcakes: 2,5 batches -> 3750 and 3125
    const thirty = itemCost(lines, 12_000, item(30_000), settings());
    expect(thirty.lines).toEqual([{ id: "m", cents: 3_750 }, { id: "o", cents: 3_125 }]);
    expect(thirty.cents).toBe(6_875);
  });

  it("rounds half up, once: a few grams of something cheap is never nothing by an early rounding", () => {
    // 1 g of flour is R0,015 -> 2 cents (half up from 1,5), not 1 or 0.
    const lines: CostLine[] = [{ ...base, id: "m", kind: "material", materialId: "flour", amountMilli: 1_000, unit: "g" }];
    expect(itemCost(lines, 1_000, item(), settings()).cents).toBe(2);
    // The same gram, ten of the item: 15 cents, not 10 or 20 from rounding each first.
    expect(itemCost(lines, 1_000, item(10_000), settings()).cents).toBe(15);
  });

  it("takes the VAT out of a material priced with it, only for a VAT-registered business", () => {
    // R46 for 2 kg including 15% VAT: R40 without -> R20 per kg.
    const lines: CostLine[] = [{ ...base, id: "m", kind: "material", materialId: "sugar", amountMilli: 1_000, unit: "kg" }];
    expect(itemCost(lines, 1_000, item(), settings({ vatRateBp: 1_500 })).cents).toBe(2_000);
    expect(itemCost(lines, 1_000, item(), settings({ vatRateBp: null })).cents).toBe(2_300);
  });

  it("leaves out lines whose conditions do not hold, and counts those that do", () => {
    const lines: CostLine[] = [
      { ...base, id: "always", kind: "other", name: "Box", cents: 1_000 },
      { id: "large", logic: "all", conditions: [{ kind: "chosen", negate: false, id: "L" }], kind: "other", name: "Extra tier", cents: 5_000 },
      { id: "big", logic: "all", conditions: [{ kind: "quantity", negate: false, quantityMilli: 12_000 }], kind: "other", name: "Big-order tray", cents: 700 },
    ];
    expect(itemCost(lines, 1_000, item(1_000, []), settings()).cents).toBe(1_000);
    expect(itemCost(lines, 1_000, item(1_000, ["L"]), settings()).cents).toBe(6_000);
    // 12 of them: the tray applies, and every line is for 12.
    expect(itemCost(lines, 1_000, item(12_000, ["L"]), settings()).cents).toBe(12 * 6_000 + 12 * 700);
  });

  it("names a line it cannot cost and leaves it out, never guessing", () => {
    const lines: CostLine[] = [
      { ...base, id: "t", kind: "time", minutes: 30 },
      { ...base, id: "gone", kind: "material", materialId: "missing", amountMilli: 1_000, unit: "kg" },
      { ...base, id: "units", kind: "material", materialId: "flour", amountMilli: 1_000, unit: "l" },
      { ...base, id: "o", kind: "other", name: "Box", cents: 500 },
    ];
    const c = itemCost(lines, 1_000, item(), settings({ hourlyRateCents: null }));
    expect(c.cents).toBe(500);
    expect(c.problems).toEqual([
      { kind: "rate", lineId: "t" },
      { kind: "material", lineId: "gone" },
      { kind: "units", lineId: "units" },
    ]);
    expect(c.lines.find((l) => l.id === "t")?.cents).toBeNull();
  });

  it("an hourly rate of nothing makes the time free, which is different from not set", () => {
    const lines: CostLine[] = [{ ...base, id: "t", kind: "time", minutes: 30 }];
    const c = itemCost(lines, 1_000, item(), settings({ hourlyRateCents: 0 }));
    expect(c.cents).toBe(0);
    expect(c.problems).toEqual([]);
  });

  it("a line that does not apply is not a problem even if it could not be costed", () => {
    const lines: CostLine[] = [{ id: "t", logic: "all", conditions: [{ kind: "chosen", negate: false, id: "L" }], kind: "time", minutes: 30 }];
    expect(itemCost(lines, 1_000, item(), settings({ hourlyRateCents: null })).problems).toEqual([]);
  });

  it("costs nothing for a batch that makes nothing, and refuses a cost money cannot hold", () => {
    const lines: CostLine[] = [{ ...base, id: "o", kind: "other", name: "Huge", cents: 99_999_999_999 }];
    expect(itemCost(lines, 0, item(), settings()).cents).toBe(0);
    const big = itemCost(lines, 1_000, item(9_999_999_999), settings());
    expect(big.problems).toEqual([{ kind: "size", lineId: "o" }]);
    expect(big.cents).toBe(0);
  });
});

describe("margin", () => {
  it("is profit as a share of revenue without VAT, in basis points", () => {
    expect(marginBp(2_500, 10_000)).toBe(2_500);
    expect(marginBp(1, 3)).toBe(3_333);
    expect(marginBp(2, 3)).toBe(6_667);
    expect(marginBp(-1_000, 10_000)).toBe(-1_000);
    expect(marginBp(-1, 3)).toBe(-3_333);
    expect(marginBp(0, 0)).toBeNull();
  });

  it("an item with no costs has no margin, rather than a margin of 100%", () => {
    const m = itemMargin(10_000, { cents: 0, hasCosts: false, incomplete: false });
    expect(m).toEqual({ revenueCents: 10_000, costCents: null, profitCents: null, marginBp: null, incomplete: false });
  });

  it("an item with costs: profit, margin, and whether the cost is a minimum", () => {
    const m = itemMargin(10_000, { cents: 6_500, hasCosts: true, incomplete: true });
    expect(m).toEqual({ revenueCents: 10_000, costCents: 6_500, profitCents: 3_500, marginBp: 3_500, incomplete: true });
    expect(itemMargin(10_000, { cents: 12_000, hasCosts: true, incomplete: false }).profitCents).toBe(-2_000);
  });

  it("a quote counts the costed items and says how many", () => {
    const q = quoteMargin([
      itemMargin(10_000, { cents: 6_000, hasCosts: true, incomplete: false }),
      itemMargin(5_000, { cents: 0, hasCosts: false, incomplete: false }),
      itemMargin(20_000, { cents: 10_000, hasCosts: true, incomplete: true }),
    ]);
    expect(q).toEqual({
      revenueCents: 35_000,
      costedRevenueCents: 30_000,
      costCents: 16_000,
      profitCents: 14_000,
      marginBp: 4_667,
      costedItems: 2,
      totalItems: 3,
      incomplete: true,
    });
  });

  it("a quote with no costed items has no margin", () => {
    const q = quoteMargin([itemMargin(5_000, { cents: 0, hasCosts: false, incomplete: false })]);
    expect(q.marginBp).toBeNull();
    expect(q.costedItems).toBe(0);
    expect(q.profitCents).toBe(0);
  });
});
