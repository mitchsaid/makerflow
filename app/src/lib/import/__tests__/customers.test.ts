import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getLocalePack } from "../../locale";
import { guessCustomerMapping, readCustomers } from "../customers";
import { nameKey, parseDelimited } from "../products";

const locale = getLocalePack("ZA");
const fixture = (name: string) => parseDelimited(readFileSync(join(__dirname, "../__fixtures__", name), "utf8"));
const read = (name: string, existing: string[] = []) => {
  const table = fixture(name);
  const { hasHeader, mapping } = guessCustomerMapping(table);
  return readCustomers(table, hasHeader, mapping, { locale, existingNames: new Set(existing.map(nameKey)) });
};

describe("reading a list of customers", () => {
  it("finds Xero's contact columns by their headings", () => {
    expect(guessCustomerMapping(fixture("customers-xero.csv"))).toEqual({ hasHeader: true, mapping: { name: 0, email: 1, address: 2, city: 3, region: 4, postalCode: 5, phone: 6 } });
  });

  it("finds QuickBooks's customer columns, and a customer with only a name and email is fine", () => {
    expect(guessCustomerMapping(fixture("customers-quickbooks.csv")).mapping).toEqual({ name: 0, phone: 1, email: 2, notes: 3 });
    const rows = read("customers-quickbooks.csv");
    expect(rows[0]).toMatchObject({ name: "Fatima Hendricks", phone: "082 555 0113", email: "fatima@example.test", notes: "Halal kitchen only." });
    expect(rows[1]).toMatchObject({ name: "Sipho Mokoena", phone: null, email: "sipho@example.test" });
    expect(rows.every((r) => !r.problem && !r.note)).toBe(true);
  });

  it("leaves a bad email, phone, province or postal code out of that customer with a note, and still adds them", () => {
    const rows = read("customers-xero.csv");
    expect(rows[0]).toMatchObject({ name: "Lindiwe Dlamini", email: "lindiwe@example.test", region: "Western Cape", postalCode: "8001", city: "Cape Town" });
    expect(rows[0]!.problem).toBeUndefined();
    expect(rows[1]).toMatchObject({ name: "Pieter van Wyk", email: null, region: null, postalCode: null, addressLine1: "88 Main Road" });
    expect(rows[1]!.problem).toBeUndefined();
    expect(rows[1]!.note).toMatch(/email address.*province.*postal code/);
    expect(rows[3]).toMatchObject({ name: "Grace Wedding Events", phone: null });
    expect(rows[3]!.note).toMatch(/phone number/);
  });

  it("leaves out a row with no name, and a name the business already has or that repeats", () => {
    const rows = read("customers-xero.csv", ["Grace Wedding Events"]);
    expect(rows[2]!.problem).toMatch(/No name/);
    expect(rows[3]!.problem).toMatch(/already have/);
    expect(rows[4]!.problem).toMatch(/Same name as row 1/);
  });

  it("a plain list of names and emails with no headings", () => {
    const table = parseDelimited("Ann Smith\tann@example.test\nBob Jones\tbob@example.test");
    expect(guessCustomerMapping(table)).toEqual({ hasHeader: false, mapping: { name: 0, email: 1 } });
  });
});
