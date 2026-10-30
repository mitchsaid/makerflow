import { describe, expect, it } from "vitest";
import { missingOptions, offeredValues, repriceOptions } from "../option-choices";
import type { OptionGroup } from "@/lib/products/options";
import type { LineOption } from "@/lib/quotes";

const flavour: OptionGroup = {
  id: "g1",
  name: "Flavour",
  kind: "one",
  priceByVariation: false,
  values: [
    { id: "van", name: "Vanilla", priceCents: 0, usual: true, prices: {}, imageId: null },
    { id: "rv", name: "Red velvet", priceCents: 2000, usual: false, prices: {}, imageId: null, notOffered: ["small"] },
  ],
};
const picked = (valueId: string, value: string): LineOption => ({ groupId: "g1", group: "Flavour", kind: "one", valueId, value, text: "", amountCents: 0 });

describe("choices not offered for a variation", () => {
  it("lists only the choices that come in the variation, and all of them before one is chosen", () => {
    expect(offeredValues(flavour, "small").map((v) => v.id)).toEqual(["van"]);
    expect(offeredValues(flavour, "large").map((v) => v.id)).toEqual(["van", "rv"]);
    expect(offeredValues(flavour, "").map((v) => v.id)).toEqual(["van", "rv"]);
  });

  it("swaps a chosen choice the new variation does not come in for the usual one", () => {
    const next = repriceOptions([flavour], [], [picked("rv", "Red velvet")], "small");
    expect(next.map((o) => o.valueId)).toEqual(["van"]);
    expect(repriceOptions([flavour], [], [picked("rv", "Red velvet")], "large").map((o) => o.valueId)).toEqual(["rv"]);
  });

  it("leaves the list without a choice when no usual one comes in, and says so on save", () => {
    const noUsual: OptionGroup = { ...flavour, values: flavour.values.map((v) => ({ ...v, usual: false })) };
    const next = repriceOptions([noUsual], [], [picked("rv", "Red velvet")], "small");
    expect(next).toEqual([]);
    expect(missingOptions([noUsual], [], next, "small")).toEqual({ g1: "Choose a flavour." });
  });

  it("does not count a choice that does not come in the variation as chosen", () => {
    expect(missingOptions([flavour], [], [picked("rv", "Red velvet")], "small")).toEqual({ g1: "Choose a flavour." });
    expect(missingOptions([flavour], [], [picked("rv", "Red velvet")], "large")).toEqual({});
  });
});
