import type { PolicyPackContent } from "../policies/kinds";
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

/**
 * Starter wording and plain notes for a maker's quote policies, from the Consumer Protection Act
 * (68 of 2008) as read in docs/locales/za/consumer-policies.md. They are prompts, not legal advice:
 * [square brackets] mark what the maker fills in, and a legal adviser should check them.
 */
const ZA_POLICIES: PolicyPackContent = {
  adviceNote:
    "Anything in [square brackets] is for you to fill in. These are prompts, not legal advice: have a South African adviser check your wording.",
  kinds: {
    changes: {
      goodToKnow:
        "If you gave an estimate or quote for a service, you can't charge more than it unless you tell the customer the extra cost and they agree to carry on. A delivery date shouldn't move unless the customer agrees to the new date; if it does, they may be able to cancel without penalty.",
      starters: [
        {
          key: "re-quote",
          label: "Re-quote changes",
          text: "Once you have said yes to this quote, any change is quoted again before we start it. We agree the new price and the new date with you first.",
        },
      ],
    },
    cancellation: {
      goodToKnow:
        "Made-to-order items are usually treated differently from bookings and services. For bookings and services, a cancellation charge has to be fair (it depends on how much notice was given and how easily you can fill the date), and you can't charge one if the person the booking is for is in hospital or has died. For made-to-order items, keep any charge to your real costs and show how you worked it out.",
      starters: [
        {
          key: "made-to-order",
          label: "Made-to-order items",
          text: "This is made to order for you. If you cancel after saying yes, you pay what we have already spent on materials for your order and the work we have already done. Your deposit of [amount or %] counts towards that; if it is more than what we have spent, we refund the difference. We will show you how we worked it out.",
        },
        {
          key: "bookings",
          label: "Bookings and services",
          text: "If you cancel [7] or more days before [the date], we refund your deposit. If you cancel later, we keep [amount or %], because it is hard to fill the date again. We do not charge a cancellation fee if you cannot keep the booking because you or the person it is for are in hospital, or the person it is for has died.",
        },
      ],
    },
    variations: {
      goodToKnow:
        "Say this before the customer agrees, and be specific about what will vary. Telling customers up front, and having them accept the quote, is how you can show they knew what to expect. It does not excuse faults.",
      starters: [
        {
          key: "handmade",
          label: "Handmade and natural",
          text: "Handmade items and natural materials, like stones, dyes and fresh flowers, vary a little in colour, size and finish. Photos show the style, not an exact copy. Tell us before you say yes if a particular detail matters to you.",
        },
      ],
    },
    client_responsibilities: {
      goodToKnow:
        "Give real instructions: how to store it, how long it keeps, what is in it. If someone is hurt because something was faulty, or came without proper instructions or warnings, the maker can be responsible even if they weren't careless. Be specific about allergens and care.",
      starters: [
        {
          key: "allergies-handling",
          label: "Allergies and handling",
          text: "Please tell us about any allergies or dietary needs when you order. After handover, [keep it cool and upright] and move it carefully. We will tell you how to look after it.",
        },
        {
          key: "fittings-dates",
          label: "Fittings and dates",
          text: "You need to be available for [fittings on the dates we agree] and to collect or receive your order on the agreed day. If you cannot, tell us as early as you can so we can agree a new date.",
        },
      ],
    },
    liability_aftercare: {
      goodToKnow:
        "You can add to your customers' legal rights, like free resizing or cleaning, but you can't take any away. Faulty goods can be returned within six months for a repair, replacement or refund, and you can't limit your responsibility for serious carelessness. If you limit your liability at all, keep it short, in plain words, and where the customer sees it before they agree.",
      starters: [
        {
          key: "aftercare",
          label: "Repairs, resizing and cleaning",
          text: "If something is wrong with your order, tell us within 6 months of getting it and, at your choice, we will repair it, replace it or refund you. If a repair does not hold within 3 months, we will replace it or refund you. On top of that, we also offer [free resizing within 30 days / cleaning once a year]. This does not affect your legal rights.",
        },
      ],
    },
  },
};

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
  policies: ZA_POLICIES,
  documents: {
    quoteTitle: "Quotation",
    // A quotation is not a tax invoice (VAT 404 guide, 13.2).
    quoteNotATaxInvoice: "This quotation is not a tax invoice.",
    missingForQuote,
    missingForInvoice,
  },
};
