import { formatPercent } from "../money/format";
import type { BasisPoints } from "../money/primitives";
import type { ValidationResult } from "../validation";

/**
 * South African rules. Everything jurisdiction-specific lives under src/lib/locale/
 * so other countries can be added as sibling "locale packs" later.
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

/**
 * South African VAT, from SARS's VAT 404 Guide for Vendors and the VAT Act (see
 * docs/research/sars-vat-documents.md). Rates are basis points: 15% = 1500.
 */
export const ZA_VAT = {
  standardRateBp: 1500 as BasisPoints,
  /** A tax invoice for R5 000 or more must be a full tax invoice (recipient details, quantity). */
  fullTaxInvoiceThresholdCents: 500_000,
} as const;

/** Section 65 of the VAT Act: a quoted price must say it includes VAT (or show both prices). */
export function vatInclusiveStatement(rateBp: BasisPoints = ZA_VAT.standardRateBp): string {
  return `All prices include VAT at ${formatPercent(rateBp)}.`;
}

/** Wording on a quotation. A quotation is not a tax invoice (guide 13.2). */
export const ZA_QUOTE_WORDING = {
  title: "Quotation",
  notATaxInvoice: "This quotation is not a tax invoice.",
} as const;
