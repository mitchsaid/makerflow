import { describe, expect, it } from "vitest";
import { parseProductForm } from "../index";
import { locateChoice, moveStep, parseSteps, STEPS_MAX, stepsPayload, type StepChoices, type StepConditionFormRow, type StepFormRow } from "../steps";

const row = (name: string, key = name, extra: Partial<StepFormRow> = {}): StepFormRow => ({ key, name, logic: "all", conditions: [], ...extra });
const cond = (extra: Partial<StepConditionFormRow> & { key: string }): StepConditionFormRow => ({ kind: "chosen", negate: false, ref: "", quantity: "", ...extra });
const plain = (name: string) => ({ name, logic: "all", conditions: [] });

const CHOICES: StepChoices = {
  variations: ["v-small", "v-large"],
  lists: [
    { key: "g-flavour", values: ["f-vanilla", "f-red"] },
    { key: "g-filling", values: ["fi-jam"] },
  ],
  extras: ["x-wrap", "x-engrave"],
};

describe("parseSteps", () => {
  it("keeps the order the maker put them in, trimmed and with single spaces", () => {
    expect(parseSteps([row("  Bake "), row("Ice   the  cake", "b"), row("Box", "c")])).toEqual({ ok: true, steps: [plain("Bake"), plain("Ice the cake"), plain("Box")] });
  });

  it("no steps is fine; the same name twice is fine (a step can be done twice)", () => {
    expect(parseSteps([])).toEqual({ ok: true, steps: [] });
    expect(parseSteps([row("Sand", "a"), row("Sand", "b")])).toEqual({ ok: true, steps: [plain("Sand"), plain("Sand")] });
  });

  it("says how to fix a blank or long name at its row", () => {
    const r = parseSteps([row("Bake"), row("   ", "blank"), row("x".repeat(121), "long")]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.rows.blank.name).toMatch(/Give the step a name/);
    expect(r.errors.rows.long.name).toMatch(/120/);
    expect(r.errors.rows.Bake).toBeUndefined();
  });

  it("refuses more than the most, and a list it cannot read", () => {
    const many = parseSteps(Array.from({ length: STEPS_MAX + 1 }, (_, i) => row(`S${i}`)));
    expect(!many.ok && many.errors.list).toMatch(/30/);
    const bad = parseSteps({ nope: true });
    expect(!bad.ok && bad.errors.list).toMatch(/could not be read/);
  });
});

describe("a step that depends on a choice", () => {
  it("finds the choice by its place among those sent with the product", () => {
    expect(locateChoice("variation:v-large", CHOICES)).toEqual({ type: "variation", index: 1 });
    expect(locateChoice("value:g-flavour/f-red", CHOICES)).toEqual({ type: "option_value", group: 0, index: 1 });
    expect(locateChoice("value:g-filling/fi-jam", CHOICES)).toEqual({ type: "option_value", group: 1, index: 0 });
    expect(locateChoice("extra:x-engrave", CHOICES)).toEqual({ type: "extra", index: 1 });
  });

  it("does not find a choice that is not there, or a reference it cannot read", () => {
    expect(locateChoice("variation:gone", CHOICES)).toBeNull();
    expect(locateChoice("value:g-flavour/fi-jam", CHOICES)).toBeNull();
    expect(locateChoice("value:g-gone/f-red", CHOICES)).toBeNull();
    expect(locateChoice("value:g-flavour", CHOICES)).toBeNull();
    expect(locateChoice("extra:v-small", CHOICES)).toBeNull();
    expect(locateChoice("mood:x", CHOICES)).toBeNull();
    expect(locateChoice("", CHOICES)).toBeNull();
  });

  it("reads choices, a quantity, 'not' and 'any'", () => {
    const r = parseSteps(
      [
        row("Tier", "a", { conditions: [cond({ key: "c1", ref: "variation:v-large" })] }),
        row("Plain", "b", {
          logic: "any",
          conditions: [cond({ key: "c2", ref: "extra:x-wrap", negate: true }), cond({ key: "c3", kind: "quantity", quantity: "1,5", negate: true })],
        }),
      ],
      CHOICES,
    );
    expect(r).toEqual({
      ok: true,
      steps: [
        { name: "Tier", logic: "all", conditions: [{ kind: "chosen", negate: false, ref: { type: "variation", index: 1 } }] },
        {
          name: "Plain",
          logic: "any",
          conditions: [
            { kind: "chosen", negate: true, ref: { type: "extra", index: 0 } },
            { kind: "quantity", negate: true, quantityMilli: 1500 },
          ],
        },
      ],
    });
  });

  it("says what is wrong at the condition: nothing chosen, a choice that was removed, no quantity, a bad quantity", () => {
    const r = parseSteps(
      [
        row("A", "a", {
          conditions: [
            cond({ key: "empty" }),
            cond({ key: "gone", ref: "variation:removed" }),
            cond({ key: "noq", kind: "quantity" }),
            cond({ key: "badq", kind: "quantity", quantity: "0" }),
            cond({ key: "fine", ref: "variation:v-small" }),
          ],
        }),
      ],
      CHOICES,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const e = r.errors.rows.a.conditions!;
    expect(e.empty.ref).toMatch(/Choose what/);
    expect(e.gone.ref).toMatch(/removed/);
    expect(e.noq.quantity).toMatch(/Enter the quantity/);
    expect(e.badq.quantity).toBeTruthy();
    expect(e.fine).toBeUndefined();
  });

  it("a step may have ten conditions, not eleven", () => {
    const many = (n: number) => row("A", "a", { conditions: Array.from({ length: n }, (_, i) => cond({ key: `c${i}`, kind: "quantity", quantity: String(i + 1) })) });
    expect(parseSteps([many(10)], CHOICES).ok).toBe(true);
    const r = parseSteps([many(11)], CHOICES);
    expect(!r.ok && r.errors.rows.a.list).toMatch(/10/);
  });

  it("a form that does not know about conditions makes steps that are always made; a bad shape is refused", () => {
    expect(parseSteps([{ key: "a", name: "Bake" }])).toEqual({ ok: true, steps: [plain("Bake")] });
    expect(parseSteps([{ key: "a", name: "Bake", logic: "some" }]).ok).toBe(false);
    expect(parseSteps([{ key: "a", name: "Bake", conditions: "all" }]).ok).toBe(false);
    expect(parseSteps([{ key: "a", name: "Bake", conditions: [{ key: "c", kind: "mood", negate: false, ref: "", quantity: "" }] }]).ok).toBe(false);
  });

  it("is sent to the database as names, logic and conditions by place", () => {
    const parsed = parseSteps(
      [row("Tier", "a", { logic: "any", conditions: [cond({ key: "c", ref: "value:g-flavour/f-red" }), cond({ key: "q", kind: "quantity", quantity: "12" })] })],
      CHOICES,
    );
    expect(parsed.ok && stepsPayload(parsed.steps)).toEqual([
      {
        name: "Tier",
        logic: "any",
        conditions: [
          { kind: "chosen", negate: false, ref: { type: "option_value", group: 0, index: 1 } },
          { kind: "quantity", negate: false, quantityMilli: 12000 },
        ],
      },
    ]);
  });
});

describe("moveStep", () => {
  it("swaps a row with its neighbour, and stops at the ends", () => {
    const rows = ["a", "b", "c"];
    expect(moveStep(rows, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveStep(rows, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveStep(rows, 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveStep(rows, 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveStep(rows, 5, 1)).toEqual(["a", "b", "c"]);
    expect(rows).toEqual(["a", "b", "c"]);
  });
});

describe("the product form", () => {
  const form = (rows?: unknown) => {
    const f = new FormData();
    f.set("kind", "product");
    f.set("name", "Cake");
    f.set("unitPrice", "100");
    if (rows !== undefined) f.set("steps", JSON.stringify(rows));
    return f;
  };

  it("carries the steps when the form had them, and leaves them alone when it did not", () => {
    const withRows = parseProductForm(form([row("Bake"), row("Ice")]));
    expect(withRows.ok && withRows.value.steps).toEqual([plain("Bake"), plain("Ice")]);
    const without = parseProductForm(form());
    expect(without.ok && "steps" in without.value).toBe(false);
  });

  it("an empty list clears them", () => {
    const cleared = parseProductForm(form([]));
    expect(cleared.ok && cleared.value.steps).toEqual([]);
  });

  it("reads a step's condition against the variations, lists and extras on the same form", () => {
    const f = form([row("Wrap", "w", { conditions: [cond({ key: "c", ref: "value:g1/v2" })] })]);
    f.set("options", JSON.stringify([{ key: "g1", id: "", name: "Flavour", kind: "one", values: [{ key: "v1", id: "", name: "Vanilla", price: "", usual: false }, { key: "v2", id: "", name: "Red", price: "", usual: false }] }]));
    const r = parseProductForm(f);
    expect(r.ok && r.value.steps).toEqual([{ name: "Wrap", logic: "all", conditions: [{ kind: "chosen", negate: false, ref: { type: "option_value", group: 0, index: 1 } }] }]);
    // The same step with that list gone from the form is a problem at the condition.
    const gone = form([row("Wrap", "w", { conditions: [cond({ key: "c", ref: "value:g1/v2" })] })]);
    gone.set("options", "[]");
    const bad = parseProductForm(gone);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.steps?.rows.w.conditions?.c.ref).toMatch(/removed/);
  });

  it("reports a blank step at that row", () => {
    const r = parseProductForm(form([row("", "k9")]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.steps?.rows.k9.name).toBeTruthy();
  });
});
