import { describe, expect, it } from "vitest";
import { blankCostRow, costLinesOf, costsPayload, extraCostsPayload, parseCosts, parseExtraCosts, type CostFormRow } from "../costs";
import type { StepChoices } from "../steps";

const choices: StepChoices = { variations: ["v-small", "v-large"], lists: [{ key: "g", values: ["red", "blue"] }], extras: ["wrap"] };
const materials = new Map([["flour", "kg" as const], ["oil", "l" as const]]);
const row = (kind: CostFormRow["kind"], over: Partial<CostFormRow> = {}): CostFormRow => ({ ...blankCostRow(`k-${Math.random()}`, kind), ...over });
const ok = (rows: CostFormRow[], makes = "1") => {
  const r = parseCosts(rows, makes, choices, materials);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.costs;
};
const fail = (rows: CostFormRow[], makes = "1") => {
  const r = parseCosts(rows, makes, choices, materials);
  if (r.ok) throw new Error("expected problems");
  return r.errors;
};

describe("parseCosts", () => {
  it("reads each kind of line and how many a batch makes", () => {
    const costs = ok(
      [
        row("material", { materialId: "flour", amount: "500", unit: "g" }),
        row("time", { time: "1,5", timeUnit: "hours" }),
        row("other", { name: "  Gift   box ", cost: "12,50" }),
      ],
      "12",
    );
    expect(costs.makesMilli).toBe(12_000);
    expect(costs.lines).toEqual([
      { kind: "material", materialId: "flour", amountMilli: 500_000, unit: "g", logic: "all", conditions: [] },
      { kind: "time", minutes: 90, logic: "all", conditions: [] },
      { kind: "other", name: "Gift box", cents: 1250, logic: "all", conditions: [] },
    ]);
  });

  it("an empty batch size means one, nothing is not a batch", () => {
    const line = [row("time", { time: "5" })];
    expect(ok(line, "").makesMilli).toBe(1000);
    expect(fail(line, "0").makes).toBeDefined();
    expect(fail(line, "twelve").makes).toBeDefined();
  });

  it("with no lines the batch size is not checked (its box is not on the screen)", () => {
    expect(ok([], "twelve").makesMilli).toBe(1000);
  });

  it("no lines is fine and clears them", () => {
    expect(ok([]).lines).toEqual([]);
  });

  it("says how to fix a material line", () => {
    const e = fail([row("material", { key: "a" })]).rows.a;
    expect(e.materialId).toMatch(/Choose the material/);
    expect(e.amount).toMatch(/how much/i);
    expect(e.unit).toMatch(/Choose the unit/);
    // a unit of another kind than the material is bought by
    expect(fail([row("material", { key: "b", materialId: "flour", amount: "1", unit: "l" })]).rows.b.unit).toMatch(/measures something else/);
    // a material that is gone
    expect(fail([row("material", { key: "c", materialId: "ghost", amount: "1", unit: "kg" })]).rows.c.materialId).toMatch(/not in your materials/);
    expect(fail([row("material", { key: "d", materialId: "flour", amount: "0", unit: "kg" })]).rows.d.amount).toBeDefined();
  });

  it("time is whole minutes, hours may be fractions that come to whole minutes", () => {
    expect(ok([row("time", { time: "45", timeUnit: "minutes" })]).lines[0]).toMatchObject({ minutes: 45 });
    expect(ok([row("time", { time: "0,25", timeUnit: "hours" })]).lines[0]).toMatchObject({ minutes: 15 });
    expect(fail([row("time", { key: "a", time: "0,5", timeUnit: "minutes" })]).rows.a.time).toMatch(/whole minutes/);
    expect(fail([row("time", { key: "b", time: "", timeUnit: "minutes" })]).rows.b.time).toMatch(/how long/i);
    expect(fail([row("time", { key: "c", time: "2000", timeUnit: "hours" })]).rows.c.time).toMatch(/too long/);
  });

  it("another cost needs a name and an amount (zero is allowed)", () => {
    expect(ok([row("other", { name: "Free sample", cost: "0" })]).lines[0]).toMatchObject({ cents: 0 });
    const e = fail([row("other", { key: "a" })]).rows.a;
    expect(e.name).toBeDefined();
    expect(e.cost).toMatch(/Use 0/);
  });

  it("conditions point at choices by position, and a removed choice is a problem", () => {
    const costs = ok([
      row("other", {
        name: "Box",
        cost: "5",
        logic: "any",
        conditions: [
          { key: "c1", kind: "chosen", negate: false, ref: "variation:v-large", quantity: "" },
          { key: "c2", kind: "chosen", negate: true, ref: "value:g/blue", quantity: "" },
          { key: "c3", kind: "chosen", negate: false, ref: "extra:wrap", quantity: "" },
          { key: "c4", kind: "quantity", negate: false, ref: "", quantity: "12" },
        ],
      }),
    ]);
    expect(costs.lines[0].conditions).toEqual([
      { kind: "chosen", negate: false, ref: { type: "variation", index: 1 } },
      { kind: "chosen", negate: true, ref: { type: "option_value", group: 0, index: 1 } },
      { kind: "chosen", negate: false, ref: { type: "extra", index: 0 } },
      { kind: "quantity", negate: false, quantityMilli: 12_000 },
    ]);
    const gone = fail([row("time", { key: "x", time: "5", conditions: [{ key: "c", kind: "chosen", negate: false, ref: "variation:v-huge", quantity: "" }] })]);
    expect(gone.rows.x.conditions?.c.ref).toMatch(/removed/);
    const empty = fail([row("time", { key: "y", time: "5", conditions: [{ key: "c", kind: "chosen", negate: false, ref: "", quantity: "" }] })]);
    expect(empty.rows.y.conditions?.c.ref).toMatch(/Choose what this cost depends on/);
  });

  it("refuses too many lines, and rows it cannot read", () => {
    expect(parseCosts(Array.from({ length: 41 }, () => row("time", { time: "1" })), "1", choices, materials)).toMatchObject({ ok: false });
    expect(parseCosts("nope", "1")).toMatchObject({ ok: false, errors: { list: expect.stringMatching(/could not be read/) } });
    expect(parseCosts([{ key: "a" }], "1")).toMatchObject({ ok: false });
  });
});

describe("costsPayload", () => {
  it("is what save_product_costs takes", () => {
    const costs = ok([row("material", { materialId: "flour", amount: "0,5", unit: "kg" }), row("time", { time: "30" })], "4");
    expect(costsPayload(costs)).toEqual({
      makes_milli: 4000,
      lines: [
        { kind: "material", material_id: "flour", amount_milli: 500, unit: "kg", logic: "all", conditions: [] },
        { kind: "time", minutes: 30, logic: "all", conditions: [] },
      ],
    });
  });
});

describe("costLinesOf", () => {
  it("turns saved lines into what the cost function reads, a condition by the id of its one choice", () => {
    const lines = costLinesOf([
      {
        id: "l1",
        kind: "other",
        name: "Box",
        cents: 500,
        logic: "all",
        conditions: [
          { kind: "chosen", negate: false, variationId: "v", optionValueId: null, extraId: null },
          { kind: "chosen", negate: true, variationId: null, optionValueId: "o", extraId: null },
          { kind: "chosen", negate: false, variationId: null, optionValueId: null, extraId: "e" },
          { kind: "quantity", negate: false, quantityMilli: 2000 },
          { kind: "chosen", negate: false, variationId: null, optionValueId: null, extraId: null },
        ],
      },
    ]);
    expect(lines[0].conditions).toEqual([
      { kind: "chosen", negate: false, id: "v" },
      { kind: "chosen", negate: true, id: "o" },
      { kind: "chosen", negate: false, id: "e" },
      { kind: "quantity", negate: false, quantityMilli: 2000 },
    ]);
  });
});

describe("an extra's own cost lines", () => {
  const keys = ["wrap", "engraving"];
  const entry = (key: string, changed: boolean, lines: CostFormRow[]) => ({ key, changed, lines });

  it("reads only the extras that were changed, each by its place among the extras", () => {
    const r = parseExtraCosts(
      [
        entry("wrap", false, [row("time", { time: "oops" })]),
        entry("engraving", true, [row("material", { materialId: "flour", amount: "1", unit: "kg" }), row("other", { name: "Plate", cost: "15" })]),
      ],
      keys,
      materials,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extras).toEqual([
        {
          index: 1,
          lines: [
            { kind: "material", materialId: "flour", amountMilli: 1000, unit: "kg", logic: "all", conditions: [] },
            { kind: "other", name: "Plate", cents: 1500, logic: "all", conditions: [] },
          ],
        },
      ]);
      expect(extraCostsPayload(r.extras)).toEqual([
        {
          index: 1,
          lines: [
            { kind: "material", material_id: "flour", amount_milli: 1000, unit: "kg", logic: "all", conditions: [] },
            { kind: "other", name: "Plate", cents: 1500, logic: "all", conditions: [] },
          ],
        },
      ]);
    }
  });

  it("clearing the lines of a changed extra is saved as none", () => {
    const r = parseExtraCosts([entry("wrap", true, [])], keys, materials);
    expect(r).toEqual({ ok: true, extras: [{ index: 0, lines: [] }] });
  });

  it("says how to fix a line of a changed extra, at that extra, and ignores conditions", () => {
    const r = parseExtraCosts([entry("wrap", true, [row("time", { key: "t", time: "0,5" })])], keys, materials);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.byExtra.wrap.rows.t.time).toMatch(/whole minutes/);
    // (a condition sent by a stale form is dropped, not an error)
    const withCondition = row("time", { time: "5", conditions: [{ key: "c", kind: "chosen", negate: false, ref: "variation:x", quantity: "" }] });
    expect(parseExtraCosts([entry("wrap", true, [withCondition])], keys, materials).ok).toBe(true);
  });

  it("refuses too many lines and unreadable input", () => {
    const many = Array.from({ length: 21 }, () => row("time", { time: "1" }));
    const r = parseExtraCosts([entry("wrap", true, many)], keys, materials);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.byExtra.wrap.list).toMatch(/up to 20/);
    expect(parseExtraCosts("nope", keys)).toMatchObject({ ok: false });
    expect(parseExtraCosts([{ key: "wrap" }], keys)).toMatchObject({ ok: false });
  });

  it("an extra that is no longer on the form is skipped", () => {
    expect(parseExtraCosts([entry("gone", true, [row("time", { time: "5" })])], keys, materials)).toEqual({ ok: true, extras: [] });
  });
});
