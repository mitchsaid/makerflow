import type { LocalePack } from "../locale";
import { mulDivRound } from "../money";
import type { QuoteSnapshot, SnapshotLine } from "../quotes/snapshot";
import { creditTotals, type CreditItem, type CreditLine, type CreditReason } from "./index";

/**
 * The document of a credit note, built from the invoice's own document: the same business, customer, theme and VAT
 * settings, so it reads as a correction of that invoice. Its lines are the items credited, with the amount credited as
 * their total; its totals are the credit's own. The number is empty here: the database gives it inside the issuing
 * transaction and writes it in.
 */
export function buildCreditNoteSnapshot(input: {
  invoice: QuoteSnapshot;
  invoiceNumber: string;
  /** The invoice's day, YYYY-MM-DD. */
  invoiceDate: string;
  issueDate: string;
  reason: CreditReason;
  explanation: string;
  items: readonly CreditItem[];
  lines: readonly CreditLine[];
  /** The groups of credit notes already issued on the invoice. */
  priorGroups: Parameters<typeof creditTotals>[0]["priorGroups"];
  locale: LocalePack;
}): { snapshot: QuoteSnapshot; totals: ReturnType<typeof creditTotals> } {
  const { invoice, locale } = input;
  const words = locale.documents.creditNote;
  const vat = invoice.vat.registered && invoice.vat.rateBp !== null && invoice.vat.entry
    ? ({ registered: true, entry: invoice.vat.entry, standardRateBp: invoice.vat.rateBp } as const)
    : ({ registered: false } as const);

  const credited = input.lines.map((credit) => {
    const item = input.items.find((i) => i.index === credit.index);
    if (!item) throw new RangeError(`the invoice has no item ${credit.index}`);
    return { credit, item };
  });
  const totals = creditTotals({
    lines: credited.map(({ credit, item }) => ({ amountCents: credit.amountCents, vatStatus: item.vatStatus })),
    vat,
    invoiceGroups: invoice.totals.groups,
    priorGroups: input.priorGroups,
  });

  const lines: SnapshotLine[] = credited.map(({ credit, item }) => {
    // A price change with no goods back reads as one, for the amount.
    const quantityMilli = credit.quantityMilli > 0 ? credit.quantityMilli : 1000;
    return {
      kind: invoice.lines[credit.index].kind,
      name: item.name,
      description: invoice.lines[credit.index].description ?? null,
      ...(invoice.lines[credit.index].variation ? { variation: invoice.lines[credit.index].variation } : {}),
      quantityMilli,
      unit: credit.quantityMilli > 0 ? item.unit : null,
      unitPriceCents: mulDivRound(credit.amountCents, 1000, quantityMilli),
      discount: null,
      lineTotalCents: credit.amountCents,
      ...(invoice.vat.registered ? { vatStatus: item.vatStatus } : {}),
    };
  });

  const snapshot: QuoteSnapshot = {
    ...invoice,
    number: "",
    issueDate: input.issueDate,
    validUntil: input.issueDate,
    neededBy: null,
    deliveryAddress: null,
    lines,
    quoteDiscount: null,
    totals: {
      subtotalCents: totals.subtotalCents,
      lineDiscountsCents: 0,
      quoteDiscountCents: 0,
      netCents: totals.netCents,
      vatCents: totals.vatCents,
      grossCents: totals.grossCents,
      groups: totals.groups,
    },
    // What a quote or invoice says to the customer does not belong on a credit note: only why it was issued.
    notes: input.explanation,
    title: null,
    description: null,
    signOff: null,
    terms: undefined,
    paymentInstructions: null,
    bankDetails: [],
    paymentMethods: [],
    deposit: null,
    policies: [],
    invoice: undefined,
    creditNote: {
      invoiceNumber: input.invoiceNumber,
      invoiceDate: input.invoiceDate,
      reason: words.reasons[input.reason],
      explanation: input.explanation,
      issuedToLabel: words.issuedToLabel,
      invoiceLabel: words.invoiceLabel,
      reasonLabel: words.reasonLabel,
      totalLabel: words.totalLabel,
    },
    wording: {
      ...invoice.wording,
      title: words.title(invoice.vat.registered),
      notATaxInvoice: "",
      inclusiveStatement: null,
    },
  };
  return { snapshot, totals };
}
