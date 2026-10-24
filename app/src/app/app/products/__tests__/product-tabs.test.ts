import { describe, expect, it } from "vitest";
import { productTabOf } from "../product-tabs";

const fid = (key: string) => `product-sheet-${key}`;

describe("which tab of the product form a problem is on", () => {
  const costKeys = ["c1", "c2"];
  const tab = (field: string) => productTabOf(fid(field), fid, costKeys);

  it("puts the steps' fields on Production", () => {
    expect(tab("step-s1-name")).toBe("production");
    expect(tab("step-s1-c-k1-ref")).toBe("production");
    expect(tab("step-s1-add-condition")).toBe("production");
    expect(tab("steps-error")).toBe("production");
  });

  it("puts the product's own cost lines on Inputs, with how many a batch makes", () => {
    expect(tab("cost-c1-amount")).toBe("inputs");
    expect(tab("cost-c2-first")).toBe("inputs");
    expect(tab("cost-c1-cond-c-k9-ref")).toBe("inputs");
    expect(tab("makes")).toBe("inputs");
    expect(tab("costs-error")).toBe("inputs");
  });

  it("keeps an extra's cost lines with the extra, on Details", () => {
    expect(tab("cost-x9-amount")).toBe("details");
    expect(tab("extra-e1-costs-error")).toBe("details");
    expect(tab("add-extra")).toBe("details");
  });

  it("puts everything else on Details", () => {
    for (const field of ["name", "unitPrice", "description", "photo", "variation-v1-name", "option-o1-name", "extra-e1-price", "price-break-b1-from", "variations", "extras-error"]) {
      expect(tab(field), field).toBe("details");
    }
  });

  it("does not take a field that only starts like a step or a cost for one", () => {
    expect(tab("steps-errorish")).toBe("details");
    expect(tab("cost-c10-amount")).toBe("details");
  });

  it("follows the id prefix, so a form in a sheet works the same", () => {
    expect(productTabOf("step-s1-name", (k) => k, [])).toBe("production");
    expect(productTabOf("cost-c1-amount", (k) => k, ["c1"])).toBe("inputs");
  });
});
