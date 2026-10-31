import { moneyToInput, percentToInput, quantityToInput, type NumberStyle } from "../money";
import { optionsPerItem, type LineFormValues, type LineOption } from "../quotes";
import type { QuoteSnapshot, SnapshotLine } from "../quotes/snapshot";
import { blankInvoiceForm, type InvoiceDraftForm } from "./draft";

/**
 * Turns an invoice that was sent (its document, as the customer has it) back into an invoice form, for "Duplicate"
 * (docs/plans/duplicate.md): the same customer, items, delivery, discount and note, with today's date and the usual due
 * day. It is a copy to check and send, never a numbered invoice. This is money: the form is worked out again, by the
 * one parser and the one money code, so a duplicate of an invoice must total exactly what the original did (the unit
 * test builds invoices, turns them into forms and back, and compares every total).
 *
 * The document keeps each item's price each WITH what its list choices add, so the base price is that less the choices.
 * What cannot be turned back is refused, with the reason, rather than copied wrong.
 */
export function invoiceFormFromSnapshot(
  snapshot: QuoteSnapshot,
  input: { customerId: string; today: string; dueDays: number; numberStyle: NumberStyle },
): { ok: true; form: InvoiceDraftForm } | { ok: false; reason: string } {
  const form = blankInvoiceForm({ today: input.today, dueDays: input.dueDays, customerId: input.customerId });
  const lines: LineFormValues[] = [];

  for (const [index, l] of snapshot.lines.entries()) {
    // Delivery and collection are chosen on the form, not typed as items.
    if (l.kind === "delivery" || l.kind === "collection") {
      form.fulfilment = l.kind;
      form.deliveryFee = l.kind === "delivery" ? moneyToInput(l.unitPriceCents, input.numberStyle) : "";
      continue;
    }
    const line = lineFrom(l, `copy-${index + 1}`, input.numberStyle);
    if (!line.ok) return { ok: false, reason: line.reason };
    lines.push(line.line);
  }

  form.lines = lines;
  form.deliveryAddress = snapshot.deliveryAddress ?? "";
  if (snapshot.quoteDiscount) {
    form.discountKind = snapshot.quoteDiscount.kind;
    form.discountValue =
      snapshot.quoteDiscount.kind === "percent" ? percentToInput(snapshot.quoteDiscount.basisPoints, input.numberStyle) : moneyToInput(snapshot.quoteDiscount.cents, input.numberStyle);
  }
  form.notes = snapshot.notes ?? "";
  form.paymentInstructions = snapshot.paymentInstructions ?? "";
  if (lines.some((l) => l.listPrice !== undefined)) form.showQuantityPrices = true;
  return { ok: true, form };
}

function lineFrom(l: SnapshotLine, key: string, style: NumberStyle): { ok: true; line: LineFormValues } | { ok: false; reason: string } {
  const options = l.options ?? [];
  // Versions from before options were simplified charged some once for the line: not something to copy.
  if (options.some((o) => o.charge === "line")) return { ok: false, reason: "This invoice is too old to duplicate." };

  const fromProduct = l.productId !== undefined && (l.kind === "product" || l.kind === "service");
  const lineOptions: LineOption[] = fromProduct
    ? options.map((o) => ({
        groupId: "",
        group: o.group,
        kind: o.kind,
        valueId: "",
        value: o.value ?? "",
        text: o.text ?? "",
        amountCents: o.amountCents,
        ...(o.quantityMilli == null ? {} : { quantityMilli: o.quantityMilli }),
      }))
    : [];
  // A one-off item has no choices to put back, so it stays a one-off item at the price each the document shows.
  const perItem = fromProduct ? optionsPerItem(lineOptions) : 0;
  const base = l.unitPriceCents - perItem;
  if (base < 0) return { ok: false, reason: "This invoice's prices could not be copied." };

  const line: LineFormValues = {
    key,
    kind: fromProduct ? (l.kind as "product" | "service") : "custom",
    productId: fromProduct ? (l.productId as string) : "",
    name: l.name,
    description: l.description ?? "",
    quantity: quantityToInput(l.quantityMilli, style),
    unit: l.unit ?? "",
    unitPrice: moneyToInput(base, style),
    discountKind: l.discount ? l.discount.kind : "none",
    discountValue: l.discount ? (l.discount.kind === "percent" ? percentToInput(l.discount.basisPoints, style) : moneyToInput(l.discount.cents, style)) : "",
    ...(l.vatStatus ? { vatStatus: l.vatStatus } : {}),
    ...(fromProduct && l.variation ? { variationId: "", variationLabel: l.variation.label, variationName: l.variation.name } : {}),
    ...(fromProduct && lineOptions.length > 0 ? { options: lineOptions } : {}),
    ...(fromProduct && l.quantityPrice ? { listPrice: moneyToInput(l.quantityPrice.listPriceCents, style), quantityPriceText: l.quantityPrice.text } : {}),
  };
  return { ok: true, line };
}
