import { describe, expect, it } from "vitest";
import { parseLabourRate } from "../labour-rate";

describe("parseLabourRate", () => {
  it("empty is not set", () => {
    expect(parseLabourRate("")).toEqual({ ok: true, value: null });
    expect(parseLabourRate("   ")).toEqual({ ok: true, value: null });
    expect(parseLabourRate(undefined)).toEqual({ ok: true, value: null });
  });
  it("reads money, and zero is a rate", () => {
    expect(parseLabourRate("150")).toEqual({ ok: true, value: 15_000 });
    expect(parseLabourRate("150,50")).toEqual({ ok: true, value: 15_050 });
    expect(parseLabourRate("0")).toEqual({ ok: true, value: 0 });
  });
  it("says what is wrong", () => {
    expect(parseLabourRate("lots")).toMatchObject({ ok: false });
    expect(parseLabourRate("-5")).toMatchObject({ ok: false });
  });
});
