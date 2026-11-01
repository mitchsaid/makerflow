import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fromShopify, isShopifyExport, plainText } from "../shopify";
import { guessMapping, parseDelimited, readRows, suggestGroups } from "../products";

const table = parseDelimited(readFileSync(join(__dirname, "../__fixtures__/shopify-products.csv"), "utf8"));
const currency = { symbol: "R", code: "ZAR" };

describe("a Shopify product export", () => {
  it("is recognised, and other lists are not", () => {
    expect(isShopifyExport(table)).toBe(true);
    expect(isShopifyExport(parseDelimited("Product\tPrice\nCake\t450"))).toBe(false);
    expect(fromShopify(parseDelimited("Product\tPrice\nCake\t450"))).toBeNull();
  });

  it("puts the Title on every variant row, drops picture rows and archived products", () => {
    expect(fromShopify(table)).toEqual([
      ["Title", "Price", "Description", "Size", "Option", "Option"],
      ["Lavender candle", "R180.00", "Hand-poured soy wax.", "200ml", "", ""],
      ["Lavender candle", "R320.00", "Hand-poured soy wax.", "400ml", "", ""],
      ["Gift card", "R500.00", "", "", "", ""],
    ]);
  });

  it("then reads as one product with choices, and a plain product", () => {
    const plain = fromShopify(table)!;
    const { hasHeader, mapping } = guessMapping(plain);
    const rows = readRows(plain, hasHeader, mapping, { kind: "product", currency, existingNames: new Set() });
    // The repeated title is flagged as a repeat, which is what the grouping suggestion is made from.
    expect(rows.filter((r) => r.problem).map((r) => r.problem)).toEqual(["Same name as row 1, so it is left out."]);
    const groups = suggestGroups(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Lavender candle", variationLabel: "Size", basis: "extras" });
    expect(groups[0]!.variations.map((v) => [v.name, v.priceCents])).toEqual([["200ml", 18000], ["400ml", 32000]]);
  });

  it("keeps the words of an HTML description", () => {
    expect(plainText("<p>Fine &amp; dandy</p><ul><li>One</li><li>Two</li></ul>")).toBe("Fine & dandy One Two");
  });
});
