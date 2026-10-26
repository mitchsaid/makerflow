import type { LocalePack } from "../locale";
import type { BankDetails } from "../bank";
import { bankLines } from "../bank";
import { invoicePaymentWays, type PaymentMethod } from "../payments";
import type { Customer } from "../customers";
import { businessParty, customerParty, type BusinessFacts, type QuoteSnapshot, type SnapshotParty } from "../quotes/snapshot";

/**
 * The document of an invoice, built from the accepted quote version's frozen snapshot. The lines and the totals are
 * copied untouched (nothing is recomputed, and the database checks they are exactly the version's); what is current is
 * who the business and the customer are on the day it is issued, the dates, the bank details, and the invoice's own
 * words. The number is empty here: the database gives it inside the issuing transaction and writes it in (and into the
 * payment reference line).
 */
export function buildInvoiceSnapshot(input: {
  version: QuoteSnapshot;
  issueDate: string;
  dueDate: string;
  note: string | null;
  locale: LocalePack;
  /** The business as it is today (name, contact, address, VAT number, logo). */
  business: BusinessFacts;
  /** The customer as it is today; the version's own copy is used when there is none (a deleted customer). */
  customer: Customer | null;
  /** The business's saved bank details. Printed only when the quote had them on. */
  bank: BankDetails | null;
  /** The business's saved ways to pay besides the bank account. Printed only the ones the quote showed. */
  paymentMethods?: readonly PaymentMethod[];
  /** The quote's number on the invoice; null for an invoice made without a quote. Defaults to the version's own number. */
  quoteNumber?: string | null;
}): { snapshot: QuoteSnapshot; referenceLabel: string | null } {
  const { version, locale } = input;
  const words = locale.documents.invoice;
  const showBank = (version.bankDetails ?? []).length > 0;
  const lines = showBank ? bankLines(input.bank, null, locale) : [];
  const customer: SnapshotParty | null = input.customer ? customerParty(input.customer, locale) : version.customer;
  const asksForReference = lines.length > 0 && input.bank?.useReference === true;
  return {
    snapshot: {
      ...version,
      number: "",
      issueDate: input.issueDate,
      // Quote-only facts.
      // Not used by an invoice (its due day is in `invoice`); kept so the document has the same shape.
      validUntil: input.dueDate,
      neededBy: null,
      business: businessParty(input.business, locale),
      logoImageId: input.business.logoImageId ?? null,
      customer,
      // The quote's pitch and sign-off belong to the quote; the maker's note replaces its notes.
      description: null,
      signOff: null,
      notes: input.note ?? version.notes,
      // The deposit shows as a payment from the next slice; until then the invoice is for the whole.
      deposit: null,
      bankDetails: lines,
      paymentMethods: invoicePaymentWays(version.paymentMethods ?? [], input.paymentMethods ?? [], locale),
      invoice: {
        dueDate: input.dueDate,
        quoteNumber: input.quoteNumber === undefined ? version.number : input.quoteNumber,
        billedToLabel: words.billedToLabel,
        dueLabel: words.dueLabel,
        quoteLabel: words.quoteLabel,
      },
      wording: {
        ...version.wording,
        title: words.title(version.vat.registered),
        notATaxInvoice: "",
      },
    },
    referenceLabel: asksForReference ? locale.payment.referenceLabel : null,
  };
}
