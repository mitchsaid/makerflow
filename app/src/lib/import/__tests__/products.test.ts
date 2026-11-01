import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { guessMapping, IMPORT_MAX_ROWS, nameKey, parseDelimited, parsePriceCell, readRows, suggestGroups, type ImportRow } from "../products";

const currency = { symbol: "R", code: "ZAR" };
const fixture = (name: string) => readFileSync(join(__dirname, "../__fixtures__", name), "utf8");

function read(name: string, existing: string[] = [], kind: "product" | "service" = "product"): ImportRow[] {
  const table = parseDelimited(fixture(name));
  const { hasHeader, mapping } = guessMapping(table);
  return readRows(table, hasHeader, mapping, { kind, currency, existingNames: new Set(existing.map(nameKey)) });
}

describe("parseDelimited", () => {
  it("reads commas, quotes, doubled quotes and a line break inside quotes", () => {
    expect(parseDelimited('Name,Note\r\n"Belt, 34mm","He said ""hi"""\r\n"Two\nlines",x')).toEqual([
      ["Name", "Note"],
      ["Belt, 34mm", 'He said "hi"'],
      ["Two\nlines", "x"],
    ]);
  });

  it("prefers tabs (a paste from a spreadsheet), then semicolons, then commas", () => {
    expect(parseDelimited("a\tb,c\n1\t2,3")).toEqual([["a", "b,c"], ["1", "2,3"]]);
    expect(parseDelimited("a;b,c\n1;2,3")).toEqual([["a", "b,c"], ["1", "2,3"]]);
  });

  it("drops a byte-order mark and blank lines, and trims cells", () => {
    expect(parseDelimited("﻿Name, Price \n\n  Cake , 450 \n,\n")).toEqual([["Name", "Price"], ["Cake", "450"]]);
  });

  it("gives nothing for nothing", () => {
    expect(parseDelimited("")).toEqual([]);
    expect(parseDelimited("  \n \n")).toEqual([]);
  });
});

describe("parsePriceCell", () => {
  const cents = (raw: string) => {
    const r = parsePriceCell(raw, currency);
    return r.ok ? r.cents : r.error;
  };

  it("reads the ways a price is written", () => {
    expect(cents("450")).toBe(45000);
    expect(cents("R450")).toBe(45000);
    expect(cents("R 1 450")).toBe(145000);
    expect(cents("R1 450,50")).toBe(145050);
    expect(cents("1,450.50")).toBe(145050);
    expect(cents("ZAR 99")).toBe(9900);
    expect(cents("35,00")).toBe(3500);
    expect(cents("R1 450")).toBe(145000);
    expect(cents("0")).toBe(0);
  });

  it("drops each and a trailing VAT word, and keeps /hour as the unit", () => {
    expect(parsePriceCell("R450 each", currency)).toEqual({ ok: true, cents: 45000 });
    expect(parsePriceCell("R250/hour", currency)).toEqual({ ok: true, cents: 25000, unit: "hour" });
    expect(parsePriceCell("R250 per hour", currency)).toEqual({ ok: true, cents: 25000, unit: "hour" });
    expect(parsePriceCell("R100 excl VAT", currency)).toEqual({ ok: true, cents: 10000 });
  });

  it("keeps a from price with a note", () => {
    const r = parsePriceCell("from R3 500", currency);
    expect(r).toMatchObject({ ok: true, cents: 350000 });
    expect(r.ok && r.note).toMatch(/from/);
  });

  it("refuses a range, a blank and words, saying how to fix them", () => {
    expect(cents("R2 800–R4 500")).toMatch(/range/);
    expect(cents("2800 - 4500")).toMatch(/range/);
    expect(cents("")).toMatch(/No price/);
    expect(cents("ask me")).toMatch(/isn't a price/);
    expect(cents("-50")).toMatch(/range|isn't a price/);
  });

  it("never turns a price into a float: the cents are whole numbers", () => {
    expect(cents("19.99")).toBe(1999);
    expect(cents("0,07")).toBe(7);
  });
});

describe("guessMapping", () => {
  it("finds Xero's, QuickBooks's and plain headings", () => {
    expect(guessMapping(parseDelimited(fixture("xero.csv")))).toEqual({
      hasHeader: true,
      mapping: { name: 1, description: 4, price: 5 },
    });
    expect(guessMapping(parseDelimited(fixture("quickbooks.csv")))).toEqual({
      hasHeader: true,
      mapping: { name: 0, description: 2, price: 3, type: 4 },
    });
    expect(guessMapping(parseDelimited(fixture("baker.csv")))).toEqual({ hasHeader: true, mapping: { name: 0, price: 1 } });
  });

  it("with no headings, the first column is the name and the second the price", () => {
    expect(guessMapping(parseDelimited("Cake\t450\nTart\t300"))).toEqual({ hasHeader: false, mapping: { name: 0, price: 1 } });
  });

  it("a first row of words with no heading words is taken as headings, filled in by position", () => {
    expect(guessMapping(parseDelimited("What,How much\nCake,450"))).toEqual({ hasHeader: true, mapping: { name: 0, price: 1 } });
  });

  it("a single column is just names", () => {
    expect(guessMapping(parseDelimited("Cake\nTart"))).toEqual({ hasHeader: false, mapping: { name: 0 } });
  });
});

describe("the made-up catalogues", () => {
  it("baker: every row is a product with its price", () => {
    const rows = read("baker.csv");
    expect(rows.map((r) => [r.name, r.priceCents, r.problem])).toEqual([
      ["Chocolate cake - 20cm", 45000, undefined],
      ["Chocolate cake - 25cm", 65000, undefined],
      ["Chocolate cake - 30cm", 85000, undefined],
      ["Fondant topper +R120", 12000, undefined],
      ["Cupcakes (dozen)", 18000, undefined],
    ]);
  });

  it("candles: Name and Price found, the repeated name says so rather than being added twice", () => {
    const rows = read("candles.tsv");
    expect(rows.map((r) => r.problem)).toEqual([undefined, "Same name as row 1, so it is left out.", "Same name as row 1, so it is left out.", "Same name as row 1, so it is left out.", undefined]);
    expect(rows[4]).toMatchObject({ name: "Gift wrap", priceCents: 3500 });
  });

  it("leather: a quoted comma stays in the name", () => {
    const rows = read("leather.csv");
    expect(rows.map((r) => r.name)).toEqual(["Card holder - black", "Card holder - tan", "Belt, 34mm", "Engraving"]);
    expect(rows.every((r) => !r.problem)).toBe(true);
  });

  it("stationery: semicolons, and R1 450 is one thousand four hundred and fifty rand", () => {
    const rows = read("stationery.csv");
    expect(rows.map((r) => r.priceCents)).toEqual([145000, 220000, 69050]);
  });

  it("seamstress: /hour is the unit, and each is dropped", () => {
    const rows = read("seamstress.csv", [], "service");
    expect(rows.map((r) => [r.name, r.priceCents, r.unit, r.kind])).toEqual([
      ["Hem trousers", 9000, null, "service"],
      ["Replace zip", 12000, null, "service"],
      ["Hourly rate", 25000, "hour", "service"],
      ["Suit alteration", 45000, null, "service"],
    ]);
  });

  it("woodworker: a from price keeps a note, a range and a blank are problems", () => {
    const rows = read("woodworker.csv");
    expect(rows[0]).toMatchObject({ name: "Coffee table", priceCents: 350000 });
    expect(rows[0]!.note).toMatch(/from/);
    expect(rows[0]!.problem).toBeUndefined();
    expect(rows[1]!.problem).toMatch(/range/);
    expect(rows[2]).toMatchObject({ name: "Stool", priceCents: 75000 });
    expect(rows[3]!.problem).toMatch(/No price/);
  });

  it("xero: name, sales description and sales price; a blank price is flagged", () => {
    const rows = read("xero.csv");
    expect(rows[0]).toMatchObject({ name: "Chocolate cake 20cm", priceCents: 45000, description: "Rich chocolate cake" });
    expect(rows[1]).toMatchObject({ name: "Vanilla cake 20cm", priceCents: 43000, description: "Vanilla, with buttercream" });
    expect(rows[2]!.problem).toMatch(/No price/);
  });

  it("quickbooks: Type of Service makes a service, Inventory a product", () => {
    const rows = read("quickbooks.csv");
    expect(rows.map((r) => [r.name, r.kind, r.priceCents])).toEqual([
      ["Wedding cake", "service", 320000],
      ["Cupcake", "product", 1500],
      ["Decorating time", "service", 25000],
    ]);
  });
});

describe("readRows", () => {
  const opts = { kind: "product" as const, currency, existingNames: new Set<string>() };

  it("leaves out a row with no name, with a long name, and one whose name the business already has", () => {
    const table = parseDelimited(`Name,Price\n,10\n${"x".repeat(201)},10\nCake,10\n  cake  ,20`);
    const rows = readRows(table, true, { name: 0, price: 1 }, { ...opts, existingNames: new Set(["cake"]) });
    expect(rows.map((r) => r.problem)).toEqual([
      expect.stringMatching(/No name/),
      expect.stringMatching(/longer than 200/),
      expect.stringMatching(/already have/),
      expect.stringMatching(/already have/),
    ]);
  });

  it("a long description is cut with a note, a long unit is left out with a note", () => {
    const table = parseDelimited(`Name,Price,Description,Unit\nCake,10,${"d".repeat(1200)},${"u".repeat(30)}`);
    const [row] = readRows(table, true, { name: 0, price: 1, description: 2, unit: 3 }, opts);
    expect(row!.description).toHaveLength(1000);
    expect(row!.unit).toBeNull();
    expect(row!.note).toMatch(/description was cut/);
    expect(row!.note).toMatch(/unit/);
    expect(row!.problem).toBeUndefined();
  });

  it("a price column that does not exist is a problem on every row, not a crash", () => {
    const rows = readRows(parseDelimited("Cake\nTart"), false, { name: 0 }, opts);
    expect(rows.map((r) => r.problem)).toEqual([expect.stringMatching(/No price/), expect.stringMatching(/No price/)]);
  });

  it("the most it takes at once is 200", () => {
    expect(IMPORT_MAX_ROWS).toBe(200);
  });
});


describe("suggestGroups: rows that look like one product with choices", () => {
  it("candles: the same name told apart by Scent and Size becomes one product with four choices", () => {
    const [group, ...rest] = suggestGroups(read("candles.tsv"));
    expect(rest).toEqual([]);
    expect(group).toMatchObject({ name: "Soy candle", basis: "extras", variationLabel: "Scent and Size" });
    expect(group!.variations.map((v) => [v.name, v.priceCents])).toEqual([
      ["Lavender, 200ml", 14900],
      ["Vanilla, 200ml", 14900],
      ["Lavender, 400ml", 24900],
      ["Vanilla, 400ml", 24900],
    ]);
  });

  it("baker: names that end after a dash become one cake with its sizes; the rest stay on their own", () => {
    const groups = suggestGroups(read("baker.csv"));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Chocolate cake", basis: "name", variationLabel: "Option" });
    expect(groups[0]!.variations.map((v) => [v.name, v.priceCents])).toEqual([["20cm", 45000], ["25cm", 65000], ["30cm", 85000]]);
  });

  it("leather: colours become choices of one card holder", () => {
    const groups = suggestGroups(read("leather.csv"));
    expect(groups.map((g) => [g.name, g.variations.map((v) => v.name)])).toEqual([["Card holder", ["black", "tan"]]]);
  });

  it("lists with nothing to group, and rows that cannot be told apart, give no suggestion", () => {
    expect(suggestGroups(read("seamstress.csv"))).toEqual([]);
    expect(suggestGroups(read("stationery.csv"))).toEqual([]);
    // The same name twice with nothing to tell them apart: not a group (they stay as a repeated name).
    const rows = readRows(parseDelimited("Name,Price\nCake,10\nCake,20"), true, { name: 0, price: 1 }, { kind: "product", currency, existingNames: new Set() });
    expect(suggestGroups(rows)).toEqual([]);
  });

  it("a name the business already has is left alone, and a row with no price is not part of a group", () => {
    const rows = read("baker.csv", ["Chocolate cake - 20cm"]);
    // One of the three is already a product: the other two still make a group of two.
    expect(suggestGroups(rows)[0]!.variations.map((v) => v.name)).toEqual(["25cm", "30cm"]);
    const noPrice = readRows(parseDelimited("Name,Price\nTee - S,\nTee - M,10\nTee - L,12"), true, { name: 0, price: 1 }, { kind: "product", currency, existingNames: new Set() });
    expect(suggestGroups(noPrice)[0]!.variations.map((v) => v.name)).toEqual(["M", "L"]);
  });

  it("the product's choices are at most 50, and a group is offered only when it has two or more", () => {
    const many = Array.from({ length: 51 }, (_, i) => `Tee - size ${i}\t10`).join("\n");
    const rows = readRows(parseDelimited(many), false, { name: 0, price: 1 }, { kind: "product", currency, existingNames: new Set() });
    expect(suggestGroups(rows)).toEqual([]);
    const one = readRows(parseDelimited("Tee - S\t10\nHat\t5"), false, { name: 0, price: 1 }, { kind: "product", currency, existingNames: new Set() });
    expect(suggestGroups(one)).toEqual([]);
  });
});
