import type { BasisPoints, Cents } from "../money/primitives";
import type { NumberStyle } from "../money/format";
import type { PolicyPackContent } from "../policies/kinds";
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

/** The parts of an address as stored. Empty ones are null. */
export type AddressParts = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
};

export type ProfileField = "phone" | "email" | "addressLine1" | "city";

/** One item of a business's bank details as its country writes them (see LocalePack.payment). */
export type BankField = {
  /** Stored as this key in business_bank_details.details. Never changes once data exists. */
  key: string;
  /** "Account number" */
  label: string;
  /** Plain help under the field, or null. */
  hint: string | null;
  required: boolean;
  /** A fixed list to choose from, or null for typed text. */
  options: readonly string[] | null;
  /** The phone keyboard to offer: digits only for account numbers. */
  inputMode: "text" | "numeric";
  maxLength: number;
  /** Checks what was typed (an empty required field has already been caught). Returns the value to store. */
  validate(input: unknown): ValidationResult<string>;
};

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
    /** The lines of a postal address as this country writes them on a document. */
    formatLines(parts: AddressParts): string[];
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
  /** How this country's businesses are paid by bank transfer. */
  payment: {
    /** The items of the bank details, in the order a document shows them. */
    bankFields: readonly BankField[];
    /** Help under the free text for other ways to pay, naming this country's methods. */
    otherWaysHint: string;
    /** What the payment reference line is called on a document: "Reference". */
    referenceLabel: string;
    /** A short line saying which account this is, for a screen (never the whole account number). */
    bankSummary(details: Record<string, string>): string;
  };
  /** Starter wording and plain "good to know" notes for each policy heading, from the country's consumer rules. */
  policies: PolicyPackContent;
  documents: {
    quoteTitle: string;
    quoteNotATaxInvoice: string;
    /** What the business must still provide before it can send a quote. */
    missingForQuote(facts: ContactFacts): ProfileField[];
    /** What the business must still provide before it can issue an invoice. */
    missingForInvoice(facts: ContactFacts): ProfileField[];
  };
};
