import type { BasisPoints, Cents } from "../money/primitives";
import type { NumberStyle } from "../money/format";
import type { ValidationResult } from "../validation";

/**
 * A locale pack holds EVERYTHING that depends on the country a business trades in: tax rules,
 * document wording, address shape, what is required before a document can be issued, number
 * and money formatting. The business's country (business_profiles.country_code) selects the
 * pack. Nothing country-specific lives anywhere else in the code; screens, the money module
 * and the database stay generic. See docs/adr/0004-locale-packs.md and docs/locales/README.md.
 */

/** The business facts a country's document rules look at. */
export type ContactFacts = {
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
};

export type ProfileField = "phone" | "email" | "addressLine1" | "city";

export type LocalePack = {
  /** ISO 3166-1 alpha-2, as stored in business_profiles.country_code */
  countryCode: string;
  countryName: string;
  /** Default currency (ISO 4217) for new businesses */
  currencyCode: string;
  /** BCP 47 tag for formatting DATES (month names). Numbers and money use numberStyle. */
  formatLocale: string;
  /** How numbers, money and percentages are written. Never uses the runtime's own locale data. */
  numberStyle: NumberStyle;
  /** IANA time zone, for "today" on a new document (a document date is a calendar day) */
  timeZone: string;
  address: {
    /** "Province", "State", "County" ... */
    regionLabel: string;
    regions: readonly string[];
    validatePostalCode(input: unknown): ValidationResult<string>;
  };
  tax: {
    /** "VAT", "GST", "Sales tax" ... */
    name: string;
    /** "VAT number" */
    registrationNumberLabel: string;
    validateRegistrationNumber(input: unknown): ValidationResult<string>;
    standardRateBp: BasisPoints;
    /** At or above this consideration a tax invoice must be a full tax invoice. */
    fullInvoiceThresholdCents: Cents;
    /** What a document must say when prices include the tax. */
    inclusiveStatement(rateBp: BasisPoints): string;
  };
  documents: {
    quoteTitle: string;
    quoteNotATaxInvoice: string;
    /** What the business must still provide before it can send a quote. */
    missingForQuote(facts: ContactFacts): ProfileField[];
    /** What the business must still provide before it can issue an invoice. */
    missingForInvoice(facts: ContactFacts): ProfileField[];
  };
};
