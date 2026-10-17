import { describe, expect, it } from "vitest";
import {
  DEFAULT_COUNTRY_CODE,
  getLocalePack,
  supportedCountryCodes,
  UnsupportedCountryError,
  vatSettingsFor,
} from "..";
import { ZA_LOCALE } from "../za";

describe("the locale registry", () => {
  it("finds the pack for a business's country code", () => {
    expect(getLocalePack("ZA")).toBe(ZA_LOCALE);
    expect(supportedCountryCodes()).toEqual(["ZA"]);
    expect(DEFAULT_COUNTRY_CODE).toBe("ZA");
  });

  it("refuses a country we have no rules for, instead of guessing", () => {
    expect(() => getLocalePack("GB")).toThrow(UnsupportedCountryError);
    expect(() => getLocalePack("")).toThrow(UnsupportedCountryError);
  });

  it("every pack's code matches the key it is registered under", () => {
    for (const code of supportedCountryCodes()) {
      expect(getLocalePack(code).countryCode).toBe(code);
    }
  });
});

describe("the South African pack", () => {
  const za = getLocalePack("ZA");

  it("carries South African money, address and tax facts", () => {
    expect(za.currencyCode).toBe("ZAR");
    expect(za.formatLocale).toBe("en-ZA");
    expect(za.address.regions).toHaveLength(9);
    expect(za.address.regionLabel).toBe("Province");
    expect(za.tax.name).toBe("VAT");
    expect(za.tax.standardRateBp).toBe(1500);
    expect(za.tax.fullInvoiceThresholdCents).toBe(500_000);
  });

  it("validates VAT numbers and postal codes the South African way", () => {
    expect(za.tax.validateRegistrationNumber("412 345 6789")).toEqual({ ok: true, value: "4123456789" });
    expect(za.tax.validateRegistrationNumber("5123456789").ok).toBe(false);
    expect(za.address.validatePostalCode("8001").ok).toBe(true);
    expect(za.address.validatePostalCode("80010").ok).toBe(false);
  });

  it("words quotes as South African law expects", () => {
    expect(za.tax.inclusiveStatement(1500)).toBe("All prices include VAT at 15%.");
    expect(za.documents.quoteTitle).toBe("Quotation");
    // A new quote's description and sign-off start from words that fit a quote, within what the fields hold.
    expect(za.documents.quoteStart.description.length).toBeGreaterThan(10);
    expect(za.documents.quoteStart.description.length).toBeLessThanOrEqual(2000);
    expect(za.documents.quoteStart.signOff.length).toBeLessThanOrEqual(200);
    expect(za.documents.quoteNotATaxInvoice).toBe("This quotation is not a tax invoice.");
  });

  it("a quote needs a way to be contacted; an invoice also needs the premises address", () => {
    const none = { phone: null, email: null, addressLine1: null, city: null };
    expect(za.documents.missingForQuote(none)).toEqual(["phone"]);
    expect(za.documents.missingForQuote({ ...none, email: "a@b.co" })).toEqual([]);
    expect(za.documents.missingForInvoice(none)).toEqual(["phone", "addressLine1", "city"]);
    expect(
      za.documents.missingForInvoice({ phone: "0211234567", email: null, addressLine1: "1 Main", city: "Paarl" }),
    ).toEqual([]);
  });
});

describe("the ZA invoice wording and rules", () => {
  const invoice = ZA_LOCALE.documents.invoice;

  it("is a tax invoice only for a registered business", () => {
    expect(invoice.title(true)).toBe("Tax invoice");
    expect(invoice.title(false)).toBe("Invoice");
  });

  it("uses the threshold in the tax rules for a full tax invoice, and only for a registered business", () => {
    const threshold = ZA_LOCALE.tax.fullInvoiceThresholdCents;
    expect(invoice.needsCustomerAddress(threshold - 1, true)).toBe(false);
    expect(invoice.needsCustomerAddress(threshold, true)).toBe(true);
    expect(invoice.needsCustomerAddress(threshold * 10, false)).toBe(false);
  });

  it("is due in 14 days unless the maker says otherwise", () => {
    expect(invoice.dueDays).toBe(14);
  });
});

describe("vatSettingsFor", () => {
  it("builds the money module's VAT settings from the business and its country's rate", () => {
    expect(vatSettingsFor({ vatRegistered: false, pricesIncludeVat: true }, ZA_LOCALE)).toEqual({
      registered: false,
    });
    expect(vatSettingsFor({ vatRegistered: true, pricesIncludeVat: true }, ZA_LOCALE)).toEqual({
      registered: true,
      entry: "inclusive",
      standardRateBp: 1500,
    });
    expect(vatSettingsFor({ vatRegistered: true, pricesIncludeVat: false }, ZA_LOCALE)).toEqual({
      registered: true,
      entry: "exclusive",
      standardRateBp: 1500,
    });
  });
});
