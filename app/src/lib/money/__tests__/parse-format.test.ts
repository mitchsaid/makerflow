import { describe, expect, it } from "vitest";
import { formatMoney, formatPercent, formatQuantity } from "../format";
import { parseMoney, parsePercent, parseQuantity } from "../parse";

const money = (s: string) => {
  const r = parseMoney(s);
  return r.ok ? r.value : `ERR:${r.error}`;
};

describe("parseMoney", () => {
  it("reads South African and English habits into exact cents", () => {
    expect(money("1250")).toBe(125000);
    expect(money("1 250")).toBe(125000);
    expect(money("1 250,50")).toBe(125050);
    expect(money("R1250.5")).toBe(125050);
    expect(money("49,95")).toBe(4995);
    expect(money("49.95")).toBe(4995);
    expect(money("0,05")).toBe(5);
    expect(money(".5")).toBe(50);
    expect(money("0")).toBe(0);
    expect(money("1,234.50")).toBe(123450);
    expect(money("1.234,50")).toBe(123450);
    expect(money("12,345,678.90")).toBe(1234567890);
  });

  it("treats 1,500 and 10.999 as thousands (nobody types three decimals), but 0,125 as an error", () => {
    expect(money("10.999")).toBe(1_099_900);
    expect(money("1,500")).toBe(150000);
    expect(money("1.500")).toBe(150000);
    expect(money("0,125")).toMatch(/^ERR:.*2 decimals/);
  });

  it("rejects what is not an amount, in plain words", () => {
    expect(money("")).toMatch(/^ERR:Enter an amount/);
    expect(money("   ")).toMatch(/^ERR:Enter an amount/);
    expect(money("abc")).toMatch(/^ERR:.*numbers only/);
    expect(money("-5")).toMatch(/^ERR:.*numbers only/);
    expect(money("12,50,5")).toMatch(/^ERR:/);
    expect(money("10.9999")).toMatch(/^ERR:.*2 decimals/);
    expect(money("1000000000")).toMatch(/^ERR:That amount is too large/);
    expect(parseMoney(undefined).ok).toBe(false);
  });
});

describe("parseQuantity", () => {
  it("accepts up to three decimals and returns thousandths", () => {
    const q = (s: string) => {
      const r = parseQuantity(s);
      return r.ok ? r.value : `ERR:${r.error}`;
    };
    expect(q("1")).toBe(1000);
    expect(q("0,5")).toBe(500);
    expect(q("2.25")).toBe(2250);
    expect(q("0,001")).toBe(1);
    expect(q("12 000")).toBe(12_000_000);
    expect(q("0")).toMatch(/^ERR:.*more than zero/);
    expect(q("1,2345")).toMatch(/^ERR:.*3 decimals/);
    expect(q("x")).toMatch(/^ERR:/);
    expect(q("")).toMatch(/^ERR:Enter a quantity/);
  });
});

describe("parsePercent", () => {
  it("returns basis points, up to two decimals and at most 100", () => {
    const p = (s: string) => {
      const r = parsePercent(s);
      return r.ok ? r.value : `ERR:${r.error}`;
    };
    expect(p("15")).toBe(1500);
    expect(p("15%")).toBe(1500);
    expect(p("12,5")).toBe(1250);
    expect(p("7.25 %")).toBe(725);
    expect(p("0")).toBe(0);
    expect(p("100")).toBe(10000);
    expect(p("100,01")).toMatch(/^ERR:.*more than 100/);
    expect(p("1,234")).toMatch(/^ERR:.*more than 100/); // reads as 1234
    expect(p("5,555")).toMatch(/^ERR:/);
    expect(p("")).toMatch(/^ERR:Enter a percentage/);
  });
});

describe("formatting", () => {
  it("formats in the South African style", () => {
    expect(formatMoney(125050).replace(/\s/g, " ")).toBe("R 1 250,50");
    expect(formatMoney(5).replace(/\s/g, " ")).toBe("R 0,05");
    expect(formatQuantity(500)).toBe("0,5");
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(1250)).toBe("1,25");
    expect(formatPercent(1500)).toBe("15%");
    expect(formatPercent(1250)).toBe("12,5%");
  });
});
