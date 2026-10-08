import { describe, expect, it } from "vitest";
import { isSetupAnswers, parseSetupAnswers } from "../setup";

describe("the first-quote setup answers", () => {
  it("turns a deposit and a hand-over into what is stored", () => {
    const r = parseSetupAnswers({ deposit: "yes", depositPercent: "40", fulfilment: "delivery" });
    expect(r).toEqual({ ok: true, columns: { default_deposit_kind: "percent", default_deposit_value: 4000, usual_fulfilment: "delivery" } });
  });

  it("no deposit clears the default, and 'it varies' stores nothing", () => {
    const r = parseSetupAnswers({ deposit: "no", depositPercent: "50", fulfilment: "varies" });
    expect(r).toEqual({ ok: true, columns: { default_deposit_kind: "none", default_deposit_value: 0, usual_fulfilment: null } });
  });

  it("says how to fix a deposit that can't be used", () => {
    for (const bad of ["", "abc", "0", "101"]) {
      const r = parseSetupAnswers({ deposit: "yes", depositPercent: bad, fulfilment: "collection" });
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.errors.depositValue, bad).toBeTruthy();
    }
  });

  it("checks the shape of what a hand-built request sends", () => {
    expect(isSetupAnswers({ deposit: "yes", depositPercent: "50", fulfilment: "collection" })).toBe(true);
    expect(isSetupAnswers({ deposit: "maybe", depositPercent: "50", fulfilment: "collection" })).toBe(false);
    expect(isSetupAnswers({ deposit: "no", depositPercent: "50", fulfilment: "courier" })).toBe(false);
    expect(isSetupAnswers({ deposit: "no", fulfilment: "varies" })).toBe(false);
    expect(isSetupAnswers(null)).toBe(false);
  });
});
