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

describe("thousands marks", () => {
  const money = (s: string) => {
    const r = parseMoney(s);
    return r.ok ? r.value : `ERR:${r.error}`;
  };
  it("accepts a repeated mark as thousands, in any usual style", () => {
    expect(money("1,234,567")).toBe(123_456_700);
    expect(money("1.234.567")).toBe(123_456_700);
    expect(money("R 1 234 567")).toBe(123_456_700);
    expect(money("12,345,678")).toBe(1_234_567_800);
    expect(money("1,234,567.89")).toBe(123_456_789);
    expect(money("1.234.567,89")).toBe(123_456_789);
    const q = parseQuantity("1,234,567");
    expect(q.ok && q.value).toBe(1_234_567_000);
  });
  it("still rejects misplaced marks with a plain message", () => {
    expect(money("1,23,456")).toMatch(/^ERR:.*numbers only/);
    expect(money("1,2345,678")).toMatch(/^ERR:.*numbers only/);
    expect(money("0,000,001")).toMatch(/^ERR:.*numbers only/);
  });
  it("says 'too large' for huge numbers, not 'too many decimals'", () => {
    expect(money("12345678901234567890")).toMatch(/^ERR:That amount is too large/);
    const q = parseQuantity("12345678901234567890");
    expect(!q.ok && q.error).toMatch(/too large/);
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

  it("asks instead of guessing when one separator and three digits could be a decimal or thousands", () => {
    const err = (s: string) => {
      const r = parseQuantity(s);
      return r.ok ? `OK:${r.value}` : r.error;
    };
    expect(err("1.250")).toBe("Not sure if you mean 1250 or 1,25. Type 1250 with no separator, or 1,25 for the decimal.");
    expect(err("2,500")).toContain("2,5 for the decimal");
    expect(err("10.999")).toContain("10,999 for the decimal");
    // Unambiguous forms still work.
    expect(err("1250")).toBe("OK:1250000");
    expect(err("1 250")).toBe("OK:1250000");
    expect(err("1,25")).toBe("OK:1250");
    expect(err("0,250")).toBe("OK:250");
    expect(err("1,250.5")).toBe("OK:1250500");
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
    expect(formatMoney(125050, "ZAR", "en-ZA").replace(/\s/g, " ")).toBe("R 1 250,50");
    expect(formatMoney(5, "ZAR", "en-ZA").replace(/\s/g, " ")).toBe("R 0,05");
    // the same amounts in another country's style come from that country's locale tag
    expect(formatMoney(125050, "GBP", "en-GB")).toBe("£1,250.50");
    expect(formatQuantity(500, "en-ZA")).toBe("0,5");
    expect(formatQuantity(500, "en-GB")).toBe("0.5");
    expect(formatQuantity(2000, "en-ZA")).toBe("2");
    expect(formatQuantity(1250, "en-ZA")).toBe("1,25");
    expect(formatPercent(1500, "en-ZA")).toBe("15%");
    expect(formatPercent(1250, "en-ZA")).toBe("12,5%");
  });
});
