import type { VatStatus } from "../money";
import { moneyToInput, percentToInput, quantityToInput, type NumberStyle } from "../money";
import type { BalanceDue, DepositKind } from "./deposit";
import type { DiscountKind, Fulfilment, ItemKind, LineFormValues, QuoteFormValues } from "./index";

/** The fields of a stored quote that the builder form needs (see StoredQuote in ./data). */
export type StoredQuoteFields = {
  customerId: string | null;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  deliveryAddress: string | null;
  discountKind: DiscountKind;
  discountValue: number;
  notes: string | null;
  title: string | null;
  description: string | null;
  signOff: string | null;
  terms: string | null;
  paymentInstructions: string | null;
  showBankDetails: boolean;
  showPhotos: boolean;
  depositKind: DepositKind;
  depositValue: number;
  balanceDue: BalanceDue;
  balanceDueDate: string | null;
  policies: { policyId: string | null; title: string; body: string }[];
  lines: {
    id: string;
    sortOrder: number;
    kind: string;
    productId: string | null;
    name: string;
    description: string | null;
    quantityMilli: number;
    unit: string | null;
    unitPriceCents: number;
    discountKind: DiscountKind;
    discountValue: number;
    vatStatus?: VatStatus;
    variationId?: string | null;
    variationLabel?: string | null;
    variationName?: string | null;
  }[];
};

function discountText(kind: DiscountKind, value: number, style: NumberStyle): string {
  if (kind === "none") return "";
  return kind === "percent" ? percentToInput(value, style) : moneyToInput(value, style);
}

/**
 * A stored quote as the text the form holds, written the way people type numbers in the
 * business's locale so that saving it again changes nothing. Delivery and collection come
 * back as the choice and the fee, not as lines.
 */
export function toFormValues(quote: StoredQuoteFields, style: NumberStyle): QuoteFormValues {
  const sorted = [...quote.lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const goods: LineFormValues[] = sorted
    .filter((l) => l.kind !== "delivery" && l.kind !== "collection")
    .map((l) => ({
      key: l.id,
      kind: (l.productId ? l.kind : "custom") as ItemKind,
      productId: l.productId ?? "",
      name: l.name,
      description: l.description ?? "",
      quantity: quantityToInput(l.quantityMilli, style),
      unit: l.unit ?? "",
      unitPrice: moneyToInput(l.unitPriceCents, style),
      discountKind: l.discountKind,
      discountValue: discountText(l.discountKind, l.discountValue, style),
      vatStatus: l.vatStatus ?? "standard",
      variationId: l.variationId ?? "",
      variationLabel: l.variationLabel ?? "",
      variationName: l.variationName ?? "",
    }));
  const fulfilmentLine = sorted.find((l) => l.kind === "delivery" || l.kind === "collection");
  const fulfilment: Fulfilment = fulfilmentLine ? (fulfilmentLine.kind as Fulfilment) : "none";

  return {
    customerId: quote.customerId ?? "",
    issueDate: quote.issueDate,
    validUntil: quote.validUntil,
    neededBy: quote.neededBy ?? "",
    lines: goods,
    fulfilment,
    deliveryAddress: quote.deliveryAddress ?? "",
    deliveryFee:
      fulfilmentLine?.kind === "delivery" ? moneyToInput(fulfilmentLine.unitPriceCents, style) : "",
    discountKind: quote.discountKind,
    discountValue: discountText(quote.discountKind, quote.discountValue, style),
    notes: quote.notes ?? "",
    title: quote.title ?? "",
    description: quote.description ?? "",
    signOff: quote.signOff ?? "",
    terms: quote.terms ?? "",
    paymentInstructions: quote.paymentInstructions ?? "",
    showBankDetails: quote.showBankDetails,
    showPhotos: quote.showPhotos,
    depositKind: quote.depositKind,
    depositValue:
      quote.depositKind === "percent"
        ? percentToInput(quote.depositValue, style)
        : quote.depositKind === "fixed"
          ? moneyToInput(quote.depositValue, style)
          : "",
    balanceDue: quote.balanceDue,
    balanceDueDate: quote.balanceDueDate ?? "",
    policies: quote.policies.map((p, i) => ({
      key: `p-${i}`,
      policyId: p.policyId ?? "",
      title: p.title,
      body: p.body,
    })),
  };
}
