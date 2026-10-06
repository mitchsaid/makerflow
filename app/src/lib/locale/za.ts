import type { PolicyPackContent } from "../policies/examples";
import { formatPercent, type NumberStyle } from "../money/format";
import type { BasisPoints } from "../money/primitives";
import type { ValidationResult } from "../validation";
import type { AddressParts, BankField, ContactFacts, LocalePack, ProfileField } from "./types";

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

export const ZA_ACCOUNT_TYPES = ["Cheque or current", "Savings", "Transmission"] as const;

function requiredText(label: string, max: number): BankField["validate"] {
  return (input) => {
    const value = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
    if (value.length > max) return { ok: false, error: `${label} can be up to ${max} characters.` };
    return { ok: true, value };
  };
}

/** South African bank account numbers are digits only, usually 9 to 11 of them; 7 to 16 allows every bank. */
export function validateAccountNumber(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.replace(/[\s-]/g, "") : "";
  if (!/^\d{7,16}$/.test(value)) {
    return { ok: false, error: "Account numbers are digits only, 7 to 16 of them. Copy it from your bank app or a statement." };
  }
  return { ok: true, value };
}

/** South African branch codes are 6 digits (universal branch codes included). */
export function validateBranchCode(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.replace(/[\s-]/g, "") : "";
  if (!/^\d{6}$/.test(value)) {
    return { ok: false, error: "Branch codes have 6 digits. Your bank app or statement shows yours." };
  }
  return { ok: true, value };
}

/**
 * Bank details for an EFT in South Africa: who holds the account, at which bank, what kind of
 * account, the account number and the branch code. Branch codes are NOT suggested from the bank's
 * name: a wrong code sends money to the wrong place, and the codes are not checked against a source.
 */
const ZA_BANK_FIELDS: readonly BankField[] = [
  {
    key: "holder",
    label: "Account holder",
    hint: "The name on the account, as your bank has it.",
    required: true,
    options: null,
    inputMode: "text",
    maxLength: 80,
    validate: requiredText("The account holder", 80),
  },
  {
    key: "bank",
    label: "Bank name",
    hint: "Like FNB, Capitec or Standard Bank.",
    required: true,
    options: null,
    inputMode: "text",
    maxLength: 60,
    validate: requiredText("The bank", 60),
  },
  {
    key: "accountType",
    label: "Account type",
    hint: null,
    required: true,
    options: ZA_ACCOUNT_TYPES,
    inputMode: "text",
    maxLength: 30,
    validate: (input) =>
      typeof input === "string" && (ZA_ACCOUNT_TYPES as readonly string[]).includes(input)
        ? { ok: true, value: input }
        : { ok: false, error: "Choose the type of account from the list." },
  },
  {
    key: "accountNumber",
    label: "Account number",
    hint: null,
    required: true,
    options: null,
    inputMode: "numeric",
    maxLength: 24,
    validate: validateAccountNumber,
  },
  {
    key: "branchCode",
    label: "Branch code",
    hint: null,
    required: true,
    options: null,
    inputMode: "numeric",
    maxLength: 12,
    validate: validateBranchCode,
  },
];

function bankSummary(details: Record<string, string>): string {
  const number = details.accountNumber ?? "";
  const ending = number.length >= 4 ? `ending ${number.slice(-4)}` : "";
  return [details.bank, ending].filter(Boolean).join(", ");
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
  examples: [
    {
      key: "re-quote",
      title: "Changes after you say yes",
      text: "Once you have said yes to this quote, any change is quoted again before we start it. We agree the new price and the new date with you first.",
      goodToKnow:
        "If you gave an estimate or quote for a service, you can't charge more than it unless you tell the customer the extra cost and they agree to carry on. A delivery date shouldn't move unless the customer agrees to the new date; if it does, they may be able to cancel without penalty.",
    },
    {
      key: "made-to-order",
      types: ['food', 'jewellery', 'clothing', 'flowers', 'home_body', 'craft', 'art'],
      suggestsStages: true,
      title: "If you cancel: made to order",
      text: "This is made to order for you. If you cancel after saying yes, you pay what we have already spent on materials for your order and the work we have already done. Your deposit of [amount or %] counts towards that; if it is more than what we have spent, we refund the difference. We will show you how we worked it out.",
      goodToKnow:
        "Made-to-order items are usually treated differently from bookings and services. For made-to-order items, keep any charge to your real costs and show how you worked it out.",
    },
    {
      key: "bookings",
      types: ['workshops', 'art'],
      suggestsStages: true,
      title: "If you cancel: bookings and services",
      text: "If you cancel [7] or more days before [the date], we refund your deposit. If you cancel later, we keep [amount or %], because it is hard to fill the date again. We do not charge a cancellation fee if you cannot keep the booking because you or the person it is for are in hospital, or the person it is for has died.",
      goodToKnow:
        "For bookings and services, a cancellation charge has to be fair (it depends on how much notice was given and how easily you can fill the date), and you can't charge one if the person the booking is for is in hospital or has died.",
    },
    {
      key: "handmade",
      types: ['jewellery', 'clothing', 'flowers', 'home_body', 'craft'],
      title: "Handmade and natural variations",
      text: "Handmade items and natural materials, like stones, dyes and fresh flowers, vary a little in colour, size and finish. Photos show the style, not an exact copy. Tell us before you say yes if a particular detail matters to you.",
      goodToKnow:
        "Say this before the customer agrees, and be specific about what will vary. Telling customers up front, and having them accept the quote, is how you can show they knew what to expect. It does not excuse faults.",
    },
    {
      key: "allergies-handling",
      types: ['food', 'home_body'],
      title: "Allergies and handling",
      text: "Please tell us about any allergies or dietary needs when you order. After handover, [keep it cool and upright] and move it carefully. We will tell you how to look after it.",
      goodToKnow:
        "Give real instructions: how to store it, how long it keeps, what is in it. If someone is hurt because something was faulty, or came without proper instructions or warnings, the maker can be responsible even if they weren't careless. Be specific about allergens and care.",
    },
    {
      key: "fittings-dates",
      types: ['clothing', 'jewellery'],
      title: "Fittings and dates",
      text: "You need to be available for [fittings on the dates we agree] and to collect or receive your order on the agreed day. If you cannot, tell us as early as you can so we can agree a new date.",
      goodToKnow:
        "Say what you need from the customer and by when, so a missed fitting or collection has a clear next step. A new date has to be one the customer agrees to.",
    },
    {
      key: "aftercare",
      types: ['jewellery', 'clothing', 'craft'],
      title: "Repairs, resizing and cleaning",
      text: "If something is wrong with your order, tell us within 6 months of getting it and, at your choice, we will repair it, replace it or refund you. If a repair does not hold within 3 months, we will replace it or refund you. On top of that, we also offer [free resizing within 30 days / cleaning once a year]. This does not affect your legal rights.",
      goodToKnow:
        "You can add to your customers' legal rights, like free resizing or cleaning, but you can't take any away. Faulty goods can be returned within six months for a repair, replacement or refund, and you can't limit your responsibility for serious carelessness. If you limit your liability at all, keep it short, in plain words, and where the customer sees it before they agree.",
    },
    {
      key: "food-storage",
      types: ["food"],
      title: "Storage and serving",
      text: "Please follow our storage and serving instructions: [keep it refrigerated and eat it within 3 days]. We will tell you what is in it, so please ask about any ingredient you are unsure of.",
      goodToKnow:
        "Be specific about how to store it, how long it keeps and what is in it. Instructions and warnings are part of what you owe your customer: if someone is hurt because something came without proper instructions or warnings, the maker can be responsible.",
    },
    {
      key: "food-collection",
      types: ["food"],
      title: "Collection and delivery",
      text: "We hand your order over at [the agreed time] on [the agreed date]. If you would like it delivered, tell us [the address and a time window] when you say yes. Once it is handed to you or your courier, please [keep it cool] and handle it carefully.",
      goodToKnow:
        "Agree the date and time with the customer. A date shouldn't move unless they agree to the new one. We have not researched who carries the risk once a courier has the order, so have your adviser check what you say about that.",
    },
    {
      key: "engraving",
      types: ["jewellery", "craft", "art"],
      title: "Engraving and personalising",
      text: "Engraved or personalised items are made just for you. Please check the spelling and details on your proof carefully before you approve it, because we start making it once you do. If we make a mistake, we will put it right. This does not affect your legal rights.",
      goodToKnow:
        "Made-for-you goods are treated differently from standard goods, but you can't take away your customer's right to have faults put right. A proof gives the customer a chance to check the details before you start; it does not replace that right.",
    },
    {
      key: "measurements",
      types: ["clothing"],
      title: "Measurements and alterations",
      text: "We make your item to the measurements you give us or that we take at your fitting, so please tell us if anything changes. If it does not fit as we agreed, tell us and we will [alter it] at no cost. This is on top of your legal rights.",
      goodToKnow:
        "Made to measure is made for one person. Offering alterations adds to your customer's rights; it can't replace them: faulty goods can still be returned within six months.",
    },
    {
      key: "flowers-substitutions",
      types: ["flowers"],
      title: "Seasonal substitutions",
      text: "Flowers are fresh and seasonal. If a flower on your order is not available, we replace it with one of a similar colour and value, and we tell you before delivery where we can. If you would rather not have a substitute, tell us and we will agree the change with you.",
      goodToKnow:
        "Say this before the customer agrees, and be specific about what may change (colour and value, not the whole order). Offering to agree a change with them keeps the customer in charge of what they are paying for. It does not excuse flowers that arrive in poor condition.",
    },
    {
      key: "safe-use",
      types: ["home_body"],
      title: "Safe use and sensitive skin",
      text: "Please read the label and follow the instructions, like [never leaving a burning candle unattended]. Tell us about any allergies or sensitive skin when you order, and keep it [away from children and pets].",
      goodToKnow:
        "Give real instructions and warnings on the product itself, not only on the quote. If someone is hurt because something was faulty, or came without proper instructions or warnings, the maker can be responsible even if they weren't careless.",
    },
  ],
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
  payment: {
    bankFields: ZA_BANK_FIELDS,
    otherWaysHint: "SnapScan, PayShap, or “pay on collection”.",
    referenceLabel: "Reference",
    bankSummary,
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
