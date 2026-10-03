import { describe, expect, it } from "vitest";
import { formatDocumentNumber, parseNumbering } from "../numbering";

describe("quote numbers", () => {
  it("pads short numbers and never cuts long ones, like the database", () => {
    expect(formatDocumentNumber("QT-", 1)).toBe("QT-0001");
    expect(formatDocumentNumber("QT-", 42)).toBe("QT-0042");
    expect(formatDocumentNumber("QT-", 12345)).toBe("QT-12345");
    expect(formatDocumentNumber("Q/", 7, 3)).toBe("Q/007");
    expect(formatDocumentNumber("", 5)).toBe("0005");
  });

  it("accepts a prefix and a next number that continue from another system", () => {
    expect(parseNumbering({ prefix: " Q/ ", nextNumber: "1200" }, null)).toEqual({ ok: true, prefix: "Q/", nextNumber: 1200 });
    expect(parseNumbering({ prefix: "", nextNumber: "1" }, null)).toEqual({ ok: true, prefix: "", nextNumber: 1 });
  });

  it("says how to fix a bad prefix or number", () => {
    const bad = parseNumbering({ prefix: "bad prefix!", nextNumber: "abc" }, null);
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.prefix).toMatch(/letters, numbers/);
      expect(bad.errors.nextNumber).toMatch(/whole number/);
    }
    const zero = parseNumbering({ prefix: "QT-", nextNumber: "0" }, null);
    expect(!zero.ok && zero.errors.nextNumber).toMatch(/1 or more/);
    const big = parseNumbering({ prefix: "QT-", nextNumber: "1000000000" }, null);
    expect(big.ok).toBe(false);
    const long = parseNumbering({ prefix: "ABCDEFGHIJKLM", nextNumber: "1" }, null);
    expect(long.ok).toBe(false);
  });

  it("never lets the counter go back to a number already used", () => {
    const back = parseNumbering({ prefix: "QT-", nextNumber: "5" }, 5);
    expect(!back.ok && back.errors.nextNumber).toMatch(/Number 5 has already been used. Choose 6 or higher/);
    expect(parseNumbering({ prefix: "QT-", nextNumber: "6" }, 5).ok).toBe(true);
  });
});
