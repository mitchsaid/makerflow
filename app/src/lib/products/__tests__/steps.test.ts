import { describe, expect, it } from "vitest";
import { parseProductForm } from "../index";
import { moveStep, parseSteps, STEPS_MAX, type StepFormRow } from "../steps";

const row = (name: string, key = name): StepFormRow => ({ key, name });

describe("parseSteps", () => {
  it("keeps the order the maker put them in, trimmed and with single spaces", () => {
    expect(parseSteps([row("  Bake "), row("Ice   the  cake", "b"), row("Box", "c")])).toEqual({ ok: true, steps: ["Bake", "Ice the cake", "Box"] });
  });

  it("no steps is fine; the same name twice is fine (a step can be done twice)", () => {
    expect(parseSteps([])).toEqual({ ok: true, steps: [] });
    expect(parseSteps([row("Sand", "a"), row("Sand", "b")])).toEqual({ ok: true, steps: ["Sand", "Sand"] });
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
    expect(withRows.ok && withRows.value.steps).toEqual(["Bake", "Ice"]);
    const without = parseProductForm(form());
    expect(without.ok && "steps" in without.value).toBe(false);
  });

  it("an empty list clears them", () => {
    const cleared = parseProductForm(form([]));
    expect(cleared.ok && cleared.value.steps).toEqual([]);
  });

  it("reports a blank step at that row", () => {
    const r = parseProductForm(form([row("", "k9")]));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.steps?.rows.k9.name).toBeTruthy();
  });
});
