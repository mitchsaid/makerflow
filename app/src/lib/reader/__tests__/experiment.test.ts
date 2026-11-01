import { describe, expect, it } from "vitest";
import { costOf, reportMarkdown, scoreBusiness, scoreItems, summarise, type Run } from "../experiment";
import type { Reading } from "../index";

const found: Reading = {
  businessName: "Sweet Crumbs Bakery",
  business: { phone: "082 555 0101", city: "Cape Town", postalCode: "8001", vatNumber: "4123456789" },
  items: [{ name: "Chocolate cake", priceCents: 45000 }, { name: "Cupcakes (dozen)", priceCents: 18000 }],
};

describe("scoring a reading against what is really on the document", () => {
  it("compares text without case or punctuation, and phone, postal code and VAT numbers by their digits", () => {
    const scores = scoreBusiness(found, { businessName: "sweet crumbs bakery!", business: { phone: "0825550101", city: "cape town", postalCode: "8001", vatNumber: "4123 456 789" } });
    expect(scores.every((s) => s.right)).toBe(true);
  });

  it("marks a wrong or missing field, with what was expected", () => {
    const scores = scoreBusiness(found, { business: { phone: "082 555 9999", email: "a@b.example" } });
    expect(scores).toEqual([
      { field: "phone", expected: "082 555 9999", found: "082 555 0101", right: false },
      { field: "email", expected: "a@b.example", found: null, right: false },
    ]);
  });

  it("scores items by name, and whether the price is right to the cent", () => {
    expect(scoreItems(found.items, [{ name: "chocolate cake", priceCents: 45000 }, { name: "Cupcakes (dozen)", priceCents: 17000 }, { name: "Tart", priceCents: 9000 }])).toEqual({ expected: 3, found: 2, matched: 2, priceRight: 1 });
  });

  it("works out a cost from the tokens, and says nothing for a model it has no price for", () => {
    expect(costOf("claude-sonnet-5-5", { inputTokens: 3000, outputTokens: 500 })).toBeCloseTo(0.011, 6);
    expect(costOf("claude-haiku-5-5", { inputTokens: 3000, outputTokens: 500 })).toBeCloseTo(0.00055, 8);
    expect(costOf("some-other-model", { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
});

describe("the report", () => {
  const run = (model: string, ok: boolean, right: boolean): Run => ({
    file: "a.pdf",
    model,
    seconds: 4,
    ok,
    failure: ok ? undefined : "busy",
    fields: ok ? [{ field: "phone", expected: "1", found: right ? "1" : "2", right }] : [],
    items: ok ? { expected: 2, found: 2, matched: 2, priceRight: right ? 2 : 1 } : null,
    costUsd: ok ? 0.01 : null,
    foundFields: 3,
    foundItems: 2,
  });

  it("puts the models side by side, and lists what was wrong and what could not be read", () => {
    const runs = [run("claude-sonnet-5-5", true, true), run("claude-haiku-5-5", true, false), run("claude-haiku-5-5", false, false)];
    const [sonnet, haiku] = summarise(runs);
    expect(sonnet).toMatchObject({ model: "claude-sonnet-5-5", documents: 1, failed: 0, fieldsRight: 1, fieldsScored: 1, itemRecall: 1, itemPriceRight: 1 });
    expect(haiku).toMatchObject({ model: "claude-haiku-5-5", documents: 2, failed: 1, fieldsRight: 0, fieldsScored: 1, itemPriceRight: 0.5 });
    const md = reportMarkdown(runs);
    expect(md).toContain("| claude-sonnet-5-5 | 1 | 0 |");
    expect(md).toContain("phone: expected “1”, found “2”");
    expect(md).toContain("claude-haiku-5-5, a.pdf: busy");
    expect(md).toContain("check them before relying on a cost");
  });
});
