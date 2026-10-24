import { describe, expect, it } from "vitest";
import { withoutEmptyOptionals } from "../optional";

const base = { discountKind: "none", discountValue: "", depositKind: "none", depositValue: "" } as const;

describe("withoutEmptyOptionals", () => {
  it("leaves values alone when nothing was opened or everything opened is filled in", () => {
    expect(withoutEmptyOptionals(base)).toBe(base);
    const filled = { ...base, discountKind: "percent", discountValue: "10", depositKind: "fixed", depositValue: "250" } as const;
    expect(withoutEmptyOptionals(filled)).toBe(filled);
  });

  it("drops a discount that was opened and left blank", () => {
    expect(withoutEmptyOptionals({ ...base, discountKind: "percent", discountValue: "  " })).toEqual(base);
  });

  it("drops a deposit that was opened and left blank, and keeps the discount that has a value", () => {
    const out = withoutEmptyOptionals({ ...base, discountKind: "fixed", discountValue: "50", depositKind: "percent", depositValue: "" });
    expect(out).toEqual({ ...base, discountKind: "fixed", discountValue: "50" });
  });

  it("works for values with no deposit (an invoice)", () => {
    const out = withoutEmptyOptionals({ discountKind: "percent", discountValue: "" });
    expect(out).toEqual({ discountKind: "none", discountValue: "" });
  });
});
