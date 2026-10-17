import { describe, expect, it } from "vitest";
import { blankCostRow, type CostFormRow } from "../costs";
import { summariseCosts } from "../cost-summary";

const flour = { unit: "kg" as const, boughtQuantityMilli: 12_500, priceCents: 18_750, vatTreatment: "none" as const }; // R15,00 per kg
const settings = { materials: new Map([["flour", flour]]), hourlyRateCents: 12_000, vatRateBp: null };
const row = (kind: CostFormRow["kind"], over: Partial<CostFormRow> = {}): CostFormRow => ({ ...blankCostRow(`k-${kind}-${Math.random()}`, kind), ...over });
const base = {
  makes: "1",
  variations: [] as { key: string; name: string; price: string }[],
  unitPrice: "100",
  vatStatus: "standard" as const,
  vat: { registered: false } as const,
  settings,
  materialUnits: new Map([["flour", "kg" as const]]),
};

describe("summariseCosts", () => {
  it("costs one, from a batch that makes several", () => {
    const s = summariseCosts({
      ...base,
      makes: "12",
      rows: [row("material", { materialId: "flour", amount: "600", unit: "g" }), row("time", { time: "1", timeUnit: "hours" }), row("other", { name: "Box", cost: "12" })],
    });
    // (R9,00 + R120,00 + R12,00) ÷ 12 = R11,75; price R100,00
    expect(s.scopes).toHaveLength(1);
    expect(s.scopes[0].margin).toMatchObject({ costCents: 1175, revenueCents: 10_000, profitCents: 8825, marginBp: 8825, incomplete: false });
  });

  it("takes VAT out of the price the maker typed, and out of a price that includes it", () => {
    const s = summariseCosts({
      ...base,
      unitPrice: "115",
      vat: { registered: true, entry: "inclusive", standardRateBp: 1500 },
      settings: { ...settings, vatRateBp: 1500 },
      rows: [row("other", { name: "Box", cost: "50" })],
    });
    expect(s.scopes[0].margin).toMatchObject({ revenueCents: 10_000, costCents: 5000, marginBp: 5000 });
  });

  it("works out each variation, with lines only for one of them", () => {
    const s = summariseCosts({
      ...base,
      variations: [
        { key: "s", name: "Small", price: "60" },
        { key: "l", name: "Large", price: "100" },
      ],
      rows: [
        row("other", { name: "Base", cost: "20" }),
        row("other", { name: "Extra tier", cost: "15", conditions: [{ key: "c", kind: "chosen", negate: false, ref: "variation:l", quantity: "" }] }),
      ],
    });
    expect(s.scopes.map((x) => [x.name, x.margin?.costCents])).toEqual([["Small", 2000], ["Large", 3500]]);
    expect(s.leftOutConditions).toBe(false);
  });

  it("says when lines depend on something it does not try", () => {
    const s = summariseCosts({
      ...base,
      rows: [row("other", { name: "Wrap", cost: "5", conditions: [{ key: "c", kind: "chosen", negate: false, ref: "extra:wrap", quantity: "" }] })],
    });
    expect(s.leftOutConditions).toBe(true);
    // the line is left out, so there is nothing to cost and no margin to show
    expect(s.scopes[0].margin?.costCents).toBeNull();
    // a "not" is left out too, rather than counted because nothing was chosen
    const negated = summariseCosts({
      ...base,
      rows: [row("other", { name: "Plain", cost: "5", conditions: [{ key: "c", kind: "chosen", negate: true, ref: "extra:wrap", quantity: "" }] })],
    });
    expect(negated.scopes[0].margin?.costCents).toBeNull();
  });

  it("an unfinished line leaves the cost a minimum, and no lines is no margin", () => {
    const partial = summariseCosts({ ...base, rows: [row("other", { name: "Box", cost: "10" }), row("material", { materialId: "flour" })] });
    expect(partial.scopes[0].margin).toMatchObject({ costCents: 1000, incomplete: true });
    expect(summariseCosts({ ...base, rows: [] }).scopes[0].margin).toMatchObject({ costCents: null });
  });

  it("time with no hourly rate is a problem, not a free hour", () => {
    const s = summariseCosts({ ...base, settings: { ...settings, hourlyRateCents: null }, rows: [row("time", { time: "30" })] });
    // nothing could be costed, so there is no margin to show (never a free item)
    expect(s.scopes[0].margin?.costCents).toBeNull();
  });

  it("no price yet gives no margin", () => {
    const s = summariseCosts({ ...base, unitPrice: "", rows: [row("other", { name: "Box", cost: "10" })] });
    expect(s.scopes[0].margin).toBeNull();
  });
});
