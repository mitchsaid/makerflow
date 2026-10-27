import type { BasisPoints, Cents } from "../money/primitives";
import type { VatStatus } from "../money/document";
import type { NumberStyle } from "../money/format";
import type { PolicyPackContent } from "../policies/examples";
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

/** One kind of way to pay other than the bank account, as its country offers it (see LocalePack.payment.waysToPay). */
export type WayToPayKind = {
  /** Stored as payment_methods.kind. Never changes once data exists. */
  kind: string;
  /** In the list of kinds when adding one: "Payment link". */
  label: string;
  /** One line saying what it is, under the label. */
  description: string;
  /** What a new one is called until the maker names it: "Pay online". */
  defaultName: string;
  /** False for a kind that is planned but not built (shown as coming soon, never saved). */
  available: boolean;
  /** The kind is a picture the customer scans (a QR code): the way needs one. */
  picture: boolean;
  /** The details to ask for, in the order a document prints them. */
  fields: readonly BankField[];
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
    /**
     * The treatments a line can have, in this country's words. `label` is printed on a document that mixes
     * treatments; `hint` helps the maker choose.
     */
    statuses: Record<VatStatus, { label: string; hint: string }>;
    /**
     * What a document must say when prices include the tax and some items are not standard-rated (the
     * `present` treatments are those the document has, at least one is not standard).
     */
    mixedInclusiveStatement(rateBp: BasisPoints, present: readonly VatStatus[]): string;
  };
  /** How this country's businesses are paid by bank transfer. */
  payment: {
    /** The items of the bank details, in the order a document shows them. */
    bankFields: readonly BankField[];
    /** What a bank transfer is called here, on screens and documents: "EFT". */
    bankTransferName: string;
    /** The ways to pay other than the bank account, in the order the add list shows them. */
    waysToPay: readonly WayToPayKind[];
    /** Help under the payment notes box (a line for this quote only), naming this country's habits. */
    paymentNotesHint: string;
    /** What the payment reference line is called on a document: "Reference". */
    referenceLabel: string;
    /** The ways a customer pays, in this country's words, for recording a payment. The keys are fixed (the database knows them). */
    methods: Record<"eft" | "cash" | "card" | "other", string>;
    /** A short line saying which account this is, for a screen (never the whole account number). */
    bankSummary(details: Record<string, string>): string;
  };
  /** Examples a maker can start a policy from, from the country's consumer rules. */
  policies: PolicyPackContent;
  documents: {
    quoteTitle: string;
    /** The deposit on a quote, in plain words ("Deposit to start work"). */
    deposit: {
      label: string;
      balanceLabel: string;
      /** When the rest is due when it is paid on handover: "due on collection". */
      dueOnHandover(handover: "collection" | "delivery" | "either"): string;
      /** "due by 14 Nov 2026", given the date already written. */
      dueOnDate(dateText: string): string;
      /** The maker's own words for when the rest is due ("within 14 days of delivery"): "due within 14 days of delivery". */
      dueOther(text: string): string;
    };
    quoteNotATaxInvoice: string;
    /** A customer's statement of account (a view of their invoices, payments and credit notes). */
    statement: {
      title: string;
      broughtForward: string;
      invoiced: string;
      credited: string;
      paid: string;
      balance: string;
      creditOnAccount: string;
      ageingTitle: string;
      ageingBuckets: readonly [string, string, string, string, string];
      howToPay: string;
    };
    /** A credit note: how an issued invoice is corrected (an invoice itself never changes). */
    creditNote: {
      /** "Tax credit note" for a registered business, else "Credit note". */
      title(taxRegistered: boolean): string;
      issuedToLabel: string;
      /** Over the invoice the note corrects ("Invoice"), with its number and day. */
      invoiceLabel: string;
      reasonLabel: string;
      /** The reasons a credit note can give, in this country's words. The keys are fixed (the database knows them). */
      reasons: Record<"returned" | "cancelled" | "price" | "discount" | "damaged" | "other", string>;
      /** Over the total ("Total credited"). */
      totalLabel: string;
    };
    /** An invoice's own words. A tax invoice is only for a business registered for the tax. */
    invoice: {
      /** "Tax invoice" for a registered business, else "Invoice": never "tax invoice" for one that is not. */
      title(taxRegistered: boolean): string;
      billedToLabel: string;
      dueLabel: string;
      /** Over the number of the quote the invoice was made from. */
      quoteLabel: string;
      /** Under the totals once something has been paid. */
      paidLabel: string;
      amountDueLabel: string;
      /** The note on a payment recorded from the quote's deposit. */
      depositNote: string;
      /** The usual days between the invoice and its due day. */
      dueDays: number;
      /** Whether this invoice must carry the customer's address (a full tax invoice, not an abridged one). */
      needsCustomerAddress(grossCents: Cents, taxRegistered: boolean): boolean;
    };
    /**
     * What a new quote's description and sign-off start with when the business has not saved its own usual: a
     * suggestion that shows how the box is used. The maker changes or clears it freely.
     */
    quoteStart: { description: string; signOff: string };
    /** The heading over a document's terms ("Terms"). */
    termsHeading: string;
    /** What the business must still provide before it can send a quote. */
    missingForQuote(facts: ContactFacts): ProfileField[];
    /** What the business must still provide before it can issue an invoice. */
    missingForInvoice(facts: ContactFacts): ProfileField[];
  };
};
