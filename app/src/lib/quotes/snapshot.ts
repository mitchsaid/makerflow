import { bankLines, type BankDetails, type BankLine } from "../bank";
import { formatPercent } from "../money";
import { depositAmounts } from "./deposit";
import { formatDay } from "./dates";
import type { Customer } from "../customers";
import type { LocalePack } from "../locale";
import type { NumberStyle, VatGroup, VatSettings } from "../money";
import { resolveTheme, starter, type Theme } from "./themes";
import type { ParsedQuote } from "./index";

/**
 * Everything a quote document shows, frozen. When a quote is sent this is stored with its
 * version (quote_versions.snapshot) and the PDF and the on-screen document are drawn from it
 * and from nothing else, so later changes to the business, the customer or the products can
 * never alter a quote that was sent. A draft's preview is built the same way from the live
 * draft, so what you preview is what gets sent.
 *
 * Money is integer cents, quantities are thousandths, percentages are basis points.
 */

export const SNAPSHOT_SCHEMA = 1;

export type SnapshotParty = {
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  /** Postal address as the country writes it, one line per entry. */
  addressLines: string[];
  /** VAT number (or the country's equivalent); the label is in `vat.registrationNumberLabel`. */
  vatNumber: string | null;
  companyRegistrationNumber: string | null;
};

export type SnapshotDiscount =
  | { kind: "percent"; basisPoints: number }
  | { kind: "fixed"; cents: number };

export type SnapshotLine = {
  kind: string;
  name: string;
  description: string | null;
  quantityMilli: number;
  /** "kg", "dozen": absent or null for a plain count (and on versions sent before units existed). */
  unit?: string | null;
  unitPriceCents: number;
  discount: SnapshotDiscount | null;
  /** Quantity x price less the line's own discount (before any discount on the whole quote). */
  lineTotalCents: number;
  /**
   * The product's photo as it was when the version was sent (an id from lib/images; the picture never
   * changes under its id). Absent or null on versions sent before photos existed, for one-off items,
   * and when the quote left photos off.
   */
  photoImageId?: string | null;
};

export type QuoteSnapshot = {
  schema: typeof SNAPSHOT_SCHEMA;
  number: string;
  version: number;
  /** The name of the design a version sent with the very first designs used (see themes.ts). Not written any more; the theme carries its own name. */
  design?: string;
  /**
   * The finished look, worked into plain values and frozen so the document never changes when a theme
   * is edited or deleted. Absent before themes existed (drawn as Classic); versions from the first
   * designs have an older shape that themeFromStored reads.
   */
  theme?: Theme;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  /**
   * Where a delivery goes, as the customer received it. Present only on a delivery quote that has an
   * address; absent on versions sent before delivery addresses existed.
   */
  deliveryAddress?: string | null;
  countryCode: string;
  currencyCode: string;
  /** How the document writes numbers and dates, from the locale pack in force when it was sent. */
  numberStyle: NumberStyle;
  dateLocale: string;
  business: SnapshotParty & { name: string };
  /** The business's logo when the version was sent (an id from lib/images). Absent before logos existed. */
  logoImageId?: string | null;
  /** Null only in a preview of a draft that has no customer yet; a quote cannot be sent without one. */
  customer: SnapshotParty | null;
  vat: {
    registered: boolean;
    entry: "inclusive" | "exclusive" | null;
    rateBp: number | null;
    taxName: string;
    registrationNumberLabel: string;
  };
  lines: SnapshotLine[];
  quoteDiscount: (SnapshotDiscount & { amountCents: number }) | null;
  totals: {
    subtotalCents: number;
    lineDiscountsCents: number;
    quoteDiscountCents: number;
    netCents: number;
    vatCents: number;
    grossCents: number;
    groups: VatGroup[];
  };
  notes: string | null;
  /** The quote's own wording. Absent on versions sent before it existed. */
  title?: string | null;
  description?: string | null;
  signOff?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  /**
   * The bank details printed under "How to pay", frozen with the document: one line per item, then the
   * payment reference when the business asked for it. Absent or empty on versions sent before bank details
   * existed, or when the quote left them off.
   */
  bankDetails?: BankLine[];
  /**
   * The deposit and the balance, frozen with the words used (so a later change to the wording never alters a
   * sent quote). Absent on versions sent before deposits existed, and when the quote asks for none.
   */
  deposit?: {
    label: string;
    depositCents: number;
    /** "50%" when it was a percentage, else null. */
    percentText: string | null;
    balanceLabel: string;
    balanceCents: number;
    /** "due on collection", "due by 14 Nov 2026". */
    dueText: string;
  } | null;
  /** The policies the quote included, each under its own title. Absent on versions sent before policies existed. */
  policies?: { title: string; body: string; /** Sent before policies lost their headings. */ kind?: string }[];
  wording: {
    title: string;
    notATaxInvoice: string;
    /** "All prices include VAT at 15%." when prices include the tax, else null. */
    inclusiveStatement: string | null;
  };
};

type BusinessFacts = {
  name: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  logoImageId?: string | null;
};

export function customerParty(customer: Customer, locale: LocalePack): SnapshotParty {
  return {
    name: customer.name,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    addressLines: locale.address.formatLines({
      line1: customer.addressLine1,
      line2: customer.addressLine2,
      city: customer.city,
      region: customer.region,
      postalCode: customer.postalCode,
    }),
    vatNumber: customer.vatNumber,
    companyRegistrationNumber: customer.companyRegistrationNumber,
  };
}

function depositFor(quote: ParsedQuote, locale: LocalePack): QuoteSnapshot["deposit"] {
  if (!quote.deposit) return null;
  const { depositCents, balanceCents } = depositAmounts(quote.totals.grossCents, quote.deposit);
  const handover = quote.lines.some((l) => l.kind === "delivery")
    ? "delivery"
    : quote.lines.some((l) => l.kind === "collection")
      ? "collection"
      : "either";
  const words = locale.documents.deposit;
  return {
    label: words.label,
    depositCents,
    percentText: quote.deposit.kind === "percent" ? formatPercent(quote.deposit.basisPoints, locale.numberStyle) : null,
    balanceLabel: words.balanceLabel,
    balanceCents,
    dueText:
      quote.deposit.balance.kind === "date"
        ? words.dueOnDate(formatDay(quote.deposit.balance.date, locale.formatLocale))
        : words.dueOnHandover(handover),
  };
}

export function buildQuoteSnapshot(input: {
  quote: ParsedQuote;
  number: string;
  version: number;
  business: BusinessFacts;
  customer: Customer | null;
  countryCode: string;
  currencyCode: string;
  vat: VatSettings;
  locale: LocalePack;
  /** The business's saved bank details, if any. Printed only when the quote has them switched on. */
  bank: BankDetails | null;
  /** Each product's photo (product id to image id), for the lines that come from products. */
  productPhotos?: ReadonlyMap<string, string>;
  /** The theme to draw in, finished (see chooseTheme and resolveTheme). Classic when not given. */
  theme?: Theme;
}): QuoteSnapshot {
  const { quote, business, locale, vat } = input;
  const totals = quote.totals;
  const totalOf = new Map(
    totals.lines.map((l) => [l.id, l.amountBeforeDiscountCents - l.lineDiscountCents]),
  );
  const rateBp = vat.registered ? vat.standardRateBp : null;

  return {
    schema: SNAPSHOT_SCHEMA,
    number: input.number,
    version: input.version,
    theme: input.theme ?? resolveTheme(starter("classic").spec, "Classic"),
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    neededBy: quote.neededBy,
    // Only a delivery quote prints where it goes (a collection quote keeps the text on the draft, unprinted).
    deliveryAddress: quote.lines.some((l) => l.kind === "delivery") ? (quote.deliveryAddress ?? null) : null,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    numberStyle: locale.numberStyle,
    dateLocale: locale.formatLocale,
    business: {
      name: business.name,
      contactPerson: null,
      phone: business.phone,
      email: business.email,
      addressLines: locale.address.formatLines({
        line1: business.addressLine1,
        line2: business.addressLine2,
        city: business.city,
        region: business.region,
        postalCode: business.postalCode,
      }),
      vatNumber: business.vatRegistered ? business.vatNumber : null,
      companyRegistrationNumber: null,
    },
    logoImageId: business.logoImageId ?? null,
    customer: input.customer ? customerParty(input.customer, locale) : null,
    vat: {
      registered: vat.registered,
      entry: vat.registered ? vat.entry : null,
      rateBp,
      taxName: locale.tax.name,
      registrationNumberLabel: locale.tax.registrationNumberLabel,
    },
    lines: quote.lines.map((l) => ({
      kind: l.kind,
      name: l.name,
      description: l.description,
      quantityMilli: l.quantityMilli,
      unit: l.unit,
      unitPriceCents: l.unitPriceCents,
      discount: l.discount
        ? l.discount.kind === "percent"
          ? { kind: "percent", basisPoints: l.discount.basisPoints }
          : { kind: "fixed", cents: l.discount.cents }
        : null,
      lineTotalCents: totalOf.get(l.key) ?? 0,
      // Photos only when the quote shows them, and only for lines that come from a product that has one.
      photoImageId: quote.showPhotos !== false && l.productId ? (input.productPhotos?.get(l.productId) ?? null) : null,
    })),
    quoteDiscount: quote.quoteDiscount
      ? quote.quoteDiscount.kind === "percent"
        ? { kind: "percent", basisPoints: quote.quoteDiscount.basisPoints, amountCents: totals.quoteDiscountCents }
        : { kind: "fixed", cents: quote.quoteDiscount.cents, amountCents: totals.quoteDiscountCents }
      : null,
    totals: {
      subtotalCents: totals.subtotalCents,
      lineDiscountsCents: totals.lineDiscountsCents,
      quoteDiscountCents: totals.quoteDiscountCents,
      netCents: totals.netCents,
      vatCents: totals.vatCents,
      grossCents: totals.grossCents,
      groups: totals.groups,
    },
    notes: quote.notes,
    title: quote.title,
    description: quote.description,
    signOff: quote.signOff,
    terms: quote.terms,
    paymentInstructions: quote.paymentInstructions,
    bankDetails: bankLines(quote.showBankDetails ? input.bank : null, input.number, locale),
    deposit: depositFor(quote, locale),
    policies: quote.policies.map((p) => ({ title: p.title, body: p.body })),
    wording: {
      title: locale.documents.quoteTitle,
      notATaxInvoice: locale.documents.quoteNotATaxInvoice,
      inclusiveStatement:
        vat.registered && vat.entry === "inclusive" ? locale.tax.inclusiveStatement(vat.standardRateBp) : null,
    },
  };
}
