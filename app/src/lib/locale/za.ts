import type { PolicyPackContent } from "../policies/examples";
import { formatPercent, type NumberStyle } from "../money/format";
import type { BasisPoints } from "../money/primitives";
import type { ValidationResult } from "../validation";
import type { AddressParts, BankField, ContactFacts, LocalePack, ProfileField, WayToPayKind } from "./types";

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

/** A web address a customer can open to pay: https only, as typed from the provider's page. */
export function validatePaymentLink(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.trim() : "";
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  if (!url || url.protocol !== "https:" || !url.hostname.includes(".") || /\s/.test(value)) {
    return { ok: false, error: "Enter the whole web address, starting with https://. Copy it from your payment provider." };
  }
  return { ok: true, value };
}

/**
 * The ways to pay a South African maker offers besides an EFT. The list is a proposal from the founder's brief (SnapScan,
 * Zapper and similar apps give a QR; payment links come from card providers; PayShap is the bank-to-bank instant payment
 * by number or ID): the names and rules of each provider have not been checked against a source, so the fields stay
 * plain text and nothing is validated beyond the web address being https.
 */
const ZA_WAYS_TO_PAY: readonly WayToPayKind[] = [
  {
    kind: "qr",
    label: "QR code",
    description: "A code from your payment app (SnapScan, Zapper) that a customer scans.",
    defaultName: "Scan to pay",
    available: true,
    picture: true,
    fields: [
      {
        key: "words",
        label: "What to tell the customer",
        hint: "Like “Scan with your banking app”.",
        required: false,
        options: null,
        inputMode: "text",
        maxLength: 200,
        validate: requiredText("The words", 200),
      },
    ],
  },
  {
    kind: "link",
    label: "Payment link",
    description: "A web page where a customer pays by card or wallet.",
    defaultName: "Pay online",
    available: true,
    picture: false,
    fields: [
      {
        key: "url",
        label: "Web address",
        hint: "Starts with https://. Copy it from your payment provider.",
        required: true,
        options: null,
        inputMode: "text",
        maxLength: 300,
        validate: validatePaymentLink,
      },
    ],
  },
  {
    kind: "mobile-id",
    label: "PayShap or mobile payment ID",
    description: "A number or ID a customer pays to from their banking app.",
    defaultName: "PayShap",
    available: true,
    picture: false,
    fields: [
      {
        key: "id",
        label: "PayShap ID or number",
        hint: null,
        required: true,
        options: null,
        inputMode: "text",
        maxLength: 60,
        validate: requiredText("The PayShap ID or number", 60),
      },
    ],
  },
  {
    kind: "collection",
    label: "Pay on collection",
    description: "The customer pays you in person, by cash or card.",
    defaultName: "Pay on collection",
    available: true,
    picture: false,
    fields: [
      {
        key: "words",
        label: "What to tell the customer",
        hint: null,
        required: false,
        options: null,
        inputMode: "text",
        maxLength: 200,
        validate: requiredText("The words", 200),
      },
    ],
  },
  {
    kind: "other",
    label: "Something else",
    description: "Any other way, in your own words.",
    defaultName: "",
    available: true,
    picture: false,
    fields: [
      {
        key: "words",
        label: "Details",
        hint: "What the customer should do.",
        required: true,
        options: null,
        inputMode: "text",
        maxLength: 200,
        validate: requiredText("The details", 200),
      },
    ],
  },
];

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

/** At or above this a tax invoice must be a full one (VAT 404 guide, 13.3). */
const FULL_INVOICE_THRESHOLD_CENTS = 500_000;

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
    },
    {
      key: "made-to-order",
      types: ['food', 'jewellery', 'clothing', 'flowers', 'home_body', 'craft', 'art'],
      suggestsStages: true,
      title: "If you cancel: made to order",
      text: "This is made to order for you. If you cancel after saying yes, you pay what we have already spent on materials for your order and the work we have already done. Your deposit of [amount or %] counts towards that; if it is more than what we have spent, we refund the difference. We will show you how we worked it out.",
    },
    {
      key: "bookings",
      types: ['workshops', 'art'],
      suggestsStages: true,
      title: "If you cancel: bookings and services",
      text: "If you cancel [7] or more days before [the date], we refund your deposit. If you cancel later, we keep [amount or %], because it is hard to fill the date again. We do not charge a cancellation fee if you cannot keep the booking because you or the person it is for are in hospital, or the person it is for has died.",
    },
    {
      key: "handmade",
      types: ['jewellery', 'clothing', 'flowers', 'home_body', 'craft'],
      title: "Handmade and natural variations",
      text: "Handmade items and natural materials, like stones, dyes and fresh flowers, vary a little in colour, size and finish. Photos show the style, not an exact copy. Tell us before you say yes if a particular detail matters to you.",
    },
    {
      key: "allergies-handling",
      types: ['food', 'home_body'],
      title: "Allergies and handling",
      text: "Please tell us about any allergies or dietary needs when you order. After handover, [keep it cool and upright] and move it carefully. We will tell you how to look after it.",
    },
    {
      key: "fittings-dates",
      types: ['clothing', 'jewellery'],
      title: "Fittings and dates",
      text: "You need to be available for [fittings on the dates we agree] and to collect or receive your order on the agreed day. If you cannot, tell us as early as you can so we can agree a new date.",
    },
    {
      key: "aftercare",
      types: ['jewellery', 'clothing', 'craft'],
      title: "Repairs, resizing and cleaning",
      text: "If something is wrong with your order, tell us within 6 months of getting it and, at your choice, we will repair it, replace it or refund you. If a repair does not hold within 3 months, we will replace it or refund you. On top of that, we also offer [free resizing within 30 days / cleaning once a year]. This does not affect your legal rights.",
    },
    {
      key: "food-storage",
      types: ["food"],
      title: "Storage and serving",
      text: "Please follow our storage and serving instructions: [keep it refrigerated and eat it within 3 days]. We will tell you what is in it, so please ask about any ingredient you are unsure of.",
    },
    {
      key: "food-collection",
      types: ["food"],
      title: "Collection and delivery",
      text: "We hand your order over at [the agreed time] on [the agreed date]. If you would like it delivered, tell us [the address and a time window] when you say yes. Once it is handed to you or your courier, please [keep it cool] and handle it carefully.",
    },
    {
      key: "engraving",
      types: ["jewellery", "craft", "art"],
      title: "Engraving and personalising",
      text: "Engraved or personalised items are made just for you. Please check the spelling and details on your proof carefully before you approve it, because we start making it once you do. If we make a mistake, we will put it right. This does not affect your legal rights.",
    },
    {
      key: "measurements",
      types: ["clothing"],
      title: "Measurements and alterations",
      text: "We make your item to the measurements you give us or that we take at your fitting, so please tell us if anything changes. If it does not fit as we agreed, tell us and we will [alter it] at no cost. This is on top of your legal rights.",
    },
    {
      key: "flowers-substitutions",
      types: ["flowers"],
      title: "Seasonal substitutions",
      text: "Flowers are fresh and seasonal. If a flower on your order is not available, we replace it with one of a similar colour and value, and we tell you before delivery where we can. If you would rather not have a substitute, tell us and we will agree the change with you.",
    },
    {
      key: "safe-use",
      types: ["home_body"],
      title: "Safe use and sensitive skin",
      text: "Please read the label and follow the instructions, like [never leaving a burning candle unattended]. Tell us about any allergies or sensitive skin when you order, and keep it [away from children and pets].",
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
    fullInvoiceThresholdCents: FULL_INVOICE_THRESHOLD_CENTS,
    // VAT Act section 65: a quoted price must say it includes VAT (or show both prices).
    inclusiveStatement: (rateBp) => `All prices include VAT at ${formatPercent(rateBp, ZA_NUMBER_STYLE)}.`,
    // VAT 404 guide, 13.6: a document that mixes standard-rated, zero-rated and exempt supplies must
    // distinguish them. Examples are from the guide's lists (docs/locales/za/vat-and-documents.md).
    statuses: {
      standard: { label: "Standard-rated", hint: "VAT at the standard rate: right for most items." },
      zero: {
        label: "Zero-rated",
        hint: "VAT at 0%, like basic foods and exports.",
      },
      exempt: {
        label: "Exempt",
        hint: "No VAT, like residential rent and some education.",
      },
    },
    mixedInclusiveStatement: (rateBp, present) => {
      const rate = formatPercent(rateBp, ZA_NUMBER_STYLE);
      const zero = present.includes("zero");
      const exempt = present.includes("exempt");
      const others = zero && exempt ? "Zero-rated and exempt items" : zero ? "Zero-rated items" : "Exempt items";
      if (!present.includes("standard")) {
        return zero && exempt
          ? "No VAT is charged: the items are zero-rated or exempt."
          : zero
            ? "No VAT is charged: all items are zero-rated."
            : "No VAT is charged: all items are exempt.";
      }
      return `Prices include VAT at ${rate} on standard-rated items. ${others} carry no VAT.`;
    },
  },
  payment: {
    bankFields: ZA_BANK_FIELDS,
    bankTransferName: "EFT",
    waysToPay: ZA_WAYS_TO_PAY,
    paymentNotesHint: "Only for this quote, like “Please pay within 7 days”.",
    referenceLabel: "Reference",
    methods: { eft: "EFT or bank transfer", cash: "Cash", card: "Card", other: "Something else" },
    bankSummary,
  },
  policies: ZA_POLICIES,
  documents: {
    quoteTitle: "Quotation",
    deposit: {
      label: "Deposit to start work",
      balanceLabel: "Balance",
      dueOnHandover: (handover) =>
        handover === "collection" ? "due on collection" : handover === "delivery" ? "due on delivery" : "due on collection or delivery",
      dueOnDate: (dateText) => `due by ${dateText}`,
      dueOther: (text) => `due ${text}`,
    },
    // A quotation is not a tax invoice (VAT 404 guide, 13.2).
    quoteNotATaxInvoice: "This quotation is not a tax invoice.",
    statement: {
      title: "Statement of account",
      broughtForward: "Brought forward",
      invoiced: "Invoiced",
      credited: "Credited",
      paid: "Paid",
      balance: "Balance",
      creditOnAccount: "Credit on account",
      ageingTitle: "What is owing, by age",
      ageingBuckets: ["Not yet due", "1 to 30 days overdue", "31 to 60 days overdue", "61 to 90 days overdue", "Over 90 days overdue"],
      howToPay: "How to pay",
    },
    // A credit note carries "credit note", the supplier's and recipient's details, the day, the amount and VAT by which
    // the invoice changes, a brief explanation, and the invoice's number and day (VAT 404 guide, 13.8.3).
    creditNote: {
      title: (taxRegistered) => (taxRegistered ? "Tax credit note" : "Credit note"),
      issuedToLabel: "Credit issued to",
      invoiceLabel: "Invoice",
      reasonLabel: "Reason",
      reasons: {
        returned: "Goods returned or defective",
        cancelled: "Order cancelled or reduced",
        price: "Price or billing correction",
        discount: "Discount or rebate allowed",
        damaged: "Damaged or short delivered",
        other: "Something else",
      },
      totalLabel: "Total credited",
    },
    // A full tax invoice (R5 000 and above) carries the recipient's name and address; below that it may be abridged
    // (docs/locales/za/vat-and-documents.md, answer 7). Only a registered vendor issues a tax invoice at all.
    invoice: {
      title: (taxRegistered) => (taxRegistered ? "Tax invoice" : "Invoice"),
      billedToLabel: "Billed to",
      dueLabel: "Due date",
      quoteLabel: "Quote",
      paidLabel: "Paid so far",
      amountDueLabel: "Amount due",
      depositNote: "Deposit",
      draftNumber: "Not yet numbered",
      draftNotice: "Draft copy: not sent yet, so it has no invoice number and is not a final invoice.",
      dueDays: 14,
      needsCustomerAddress: (grossCents, taxRegistered) => taxRegistered && grossCents >= FULL_INVOICE_THRESHOLD_CENTS,
    },
    quoteStart: {
      description: "Thank you for your interest. Below is what I would prepare for you.",
      signOff: "Thank you for the opportunity to quote. Please get in touch with any questions.",
    },
    termsHeading: "Terms",
    missingForQuote,
    missingForInvoice,
  },
};
