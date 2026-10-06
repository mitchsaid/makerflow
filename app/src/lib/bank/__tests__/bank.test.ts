import { describe, expect, it } from "vitest";
import { ZA_LOCALE, validateAccountNumber, validateBranchCode } from "../../locale/za";
import { bankFromRow, bankLines, bankSummary, canEditBankDetails, parseBankForm } from "../index";

const good = {
  holder: "Sweet Co",
  bank: "FNB",
  accountType: "Cheque or current",
  accountNumber: "62 123 456 789",
  branchCode: "250655",
};

describe("South African bank fields", () => {
  it("takes digits only for account numbers, ignoring spaces and hyphens", () => {
    expect(validateAccountNumber("62 123-456 789")).toEqual({ ok: true, value: "62123456789" });
    for (const bad of ["", "12345", "1234567890123456789", "62abc12345", "R 6212345"]) {
      expect(validateAccountNumber(bad).ok).toBe(false);
    }
  });

  it("wants a 6 digit branch code", () => {
    expect(validateBranchCode("250 655")).toEqual({ ok: true, value: "250655" });
    for (const bad of ["", "25065", "2506555", "25O655"]) expect(validateBranchCode(bad).ok).toBe(false);
  });
});

describe("parseBankForm", () => {
  it("accepts a complete form and stores clean values", () => {
    const r = parseBankForm({ fields: good, useReference: true }, ZA_LOCALE);
    expect(r).toEqual({
      ok: true,
      useReference: true,
      details: { ...good, accountNumber: "62123456789" },
    });
  });

  it("says how to fix each field that is empty or wrong, and keeps every message", () => {
    const r = parseBankForm(
      { fields: { holder: "", bank: " ", accountType: "Gold", accountNumber: "abc", branchCode: "12" }, useReference: false },
      ZA_LOCALE,
    );
    if (r.ok) throw new Error("should fail");
    expect(Object.keys(r.errors).sort()).toEqual(["accountNumber", "accountType", "bank", "branchCode", "holder"]);
    expect(r.errors.holder).toMatch(/Enter the account holder/);
    expect(r.errors.accountType).toMatch(/Choose the type of account/);
    expect(r.errors.branchCode).toMatch(/6 digits/);
  });

  it("refuses an account type that is not on the list", () => {
    const r = parseBankForm({ fields: { ...good, accountType: "Lottery" }, useReference: true }, ZA_LOCALE);
    expect(r.ok).toBe(false);
  });

  it("refuses over-long holders and ignores keys the country does not have", () => {
    const long = parseBankForm({ fields: { ...good, holder: "x".repeat(81) }, useReference: true }, ZA_LOCALE);
    expect(long.ok).toBe(false);
    const extra = parseBankForm({ fields: { ...good, iban: "GB00" }, useReference: true }, ZA_LOCALE);
    if (!extra.ok) throw new Error("should parse");
    expect(extra.details).not.toHaveProperty("iban");
  });
});

describe("bankFromRow, bankLines, bankSummary", () => {
  const row = {
    country_code: "ZA",
    details: { ...good, accountNumber: "62123456789", stray: "dropped" },
    use_reference: true,
    updated_at: "2026-10-05T08:00:00Z",
  };

  it("reads a row for this country and drops unknown keys", () => {
    const bank = bankFromRow(row, ZA_LOCALE);
    expect(bank?.details).not.toHaveProperty("stray");
    expect(bank?.useReference).toBe(true);
  });

  it("never uses another country's row", () => {
    expect(bankFromRow({ ...row, country_code: "GB" }, ZA_LOCALE)).toBeNull();
  });

  it("is null for nothing, a non-object or an empty object", () => {
    expect(bankFromRow(null, ZA_LOCALE)).toBeNull();
    expect(bankFromRow({ ...row, details: "x" }, ZA_LOCALE)).toBeNull();
    expect(bankFromRow({ ...row, details: [] }, ZA_LOCALE)).toBeNull();
    expect(bankFromRow({ ...row, details: {} }, ZA_LOCALE)).toBeNull();
  });

  it("lists the fields in the country's order, then the reference when asked", () => {
    const bank = bankFromRow(row, ZA_LOCALE)!;
    expect(bankLines(bank, "QT-0007", ZA_LOCALE).map((l) => l.label)).toEqual([
      "Account holder",
      "Bank name",
      "Account type",
      "Account number",
      "Branch code",
      "Reference",
    ]);
    expect(bankLines({ ...bank, useReference: false }, "QT-0007", ZA_LOCALE).at(-1)?.label).toBe("Branch code");
    expect(bankLines(bank, null, ZA_LOCALE).at(-1)?.label).toBe("Branch code");
    expect(bankLines(null, "QT-0007", ZA_LOCALE)).toEqual([]);
  });

  it("summarises with the bank and the last four digits, never the whole number", () => {
    const bank = bankFromRow(row, ZA_LOCALE)!;
    expect(bankSummary(bank, ZA_LOCALE)).toBe("FNB, ending 6789");
  });
});

describe("who can change bank details", () => {
  it("is the owner only", () => {
    expect(canEditBankDetails("owner")).toBe(true);
    expect(canEditBankDetails("admin")).toBe(false);
    expect(canEditBankDetails("staff")).toBe(false);
    expect(canEditBankDetails(null)).toBe(false);
  });
});
