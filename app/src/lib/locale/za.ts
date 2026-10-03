import { formatPercent, type NumberStyle } from "../money/format";
import type { BasisPoints } from "../money/primitives";
import type { ValidationResult } from "../validation";
import type { AddressParts, ContactFacts, LocalePack, ProfileField } from "./types";

/**
 * The South African locale pack (country code ZA). Applies ONLY to businesses whose
 * business_profiles.country_code is "ZA". The sources behind each rule are in
 * docs/locales/za/vat-and-documents.md. Other countries are sibling files with the same shape.
 */

export const ZA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

/** "R 1 250,50": space between thousands, comma for decimals, symbol first. */
export const ZA_NUMBER_STYLE: NumberStyle = {
  decimalMark: ",",
  groupSeparator: "\u00a0",
  currencySymbols: { ZAR: "R" },
  symbolSpace: "\u00a0",
};

/** SARS VAT registration numbers are 10 digits and start with 4. Spaces and hyphens are ignored. */
export function validateVatNumber(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.replace(/[\s-]/g, "") : "";
  if (!/^4\d{9}$/.test(value)) {
    return {
      ok: false,
      error: "South African VAT numbers have 10 digits and start with 4.",
    };
  }
  return { ok: true, value };
}

/** South African postal codes are 4 digits. */
export function validatePostalCode(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.trim() : "";
  if (!/^\d{4}$/.test(value)) {
    return { ok: false, error: "Postal codes have 4 digits." };
  }
  return { ok: true, value };
}

/** Street, suburb or building, town, then province and postal code: "Gauteng 2196". */
function formatAddressLines(parts: AddressParts): string[] {
  const last = [parts.region, parts.postalCode].filter(Boolean).join(" ");
  return [parts.line1, parts.line2, parts.city, last].filter((line): line is string => !!line);
}

const STANDARD_RATE_BP: BasisPoints = 1500;

/** A way to contact the maker is all a quote needs (docs/locales/za/vat-and-documents.md, answer 5). */
function missingForQuote(facts: ContactFacts): ProfileField[] {
  return facts.phone || facts.email ? [] : ["phone"];
}

/**
 * An invoice also needs the address of the premises (SARS tax invoice particulars; Consumer
 * Protection Act section 26). A VAT-registered business always has its VAT number, because
 * the database does not allow registration without one.
 */
function missingForInvoice(facts: ContactFacts): ProfileField[] {
  const missing: ProfileField[] = [];
  if (!facts.addressLine1) missing.push("addressLine1");
  if (!facts.city) missing.push("city");
  return [...missingForQuote(facts), ...missing];
}

export const ZA_LOCALE: LocalePack = {
  countryCode: "ZA",
  countryName: "South Africa",
  currencyCode: "ZAR",
  formatLocale: "en-ZA",
  numberStyle: ZA_NUMBER_STYLE,
  timeZone: "Africa/Johannesburg",
  address: {
    regionLabel: "Province",
    regions: ZA_PROVINCES,
    validatePostalCode,
    formatLines: formatAddressLines,
  },
  tax: {
    name: "VAT",
    registrationNumberLabel: "VAT number",
    validateRegistrationNumber: validateVatNumber,
    standardRateBp: STANDARD_RATE_BP,
    // A tax invoice for R5 000 or more must be a full tax invoice (VAT 404 guide, 13.3).
    fullInvoiceThresholdCents: 500_000,
    // VAT Act section 65: a quoted price must say it includes VAT (or show both prices).
    inclusiveStatement: (rateBp) => `All prices include VAT at ${formatPercent(rateBp, ZA_NUMBER_STYLE)}.`,
  },
  documents: {
    quoteTitle: "Quotation",
    // A quotation is not a tax invoice (VAT 404 guide, 13.2).
    quoteNotATaxInvoice: "This quotation is not a tax invoice.",
    missingForQuote,
    missingForInvoice,
  },
};
