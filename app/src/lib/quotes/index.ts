import {
  calculateDocument,
  MAX_CENTS,
  parseMoney,
  parsePercent,
  parseQuantity,
  type Cents,
  type Discount,
  type DocumentTotals,
  type LineInput,
  type QuantityMilli,
  type VatSettings,
} from "../money";
import { optionalMultiline, optionalText } from "../form-values";
import { isIsoDay } from "./dates";

/**
 * A quote as it is typed (QuoteFormValues: everything is text) and as it is stored
 * (ParsedQuote: exact integers). parseQuote() turns the first into the second, or says what
 * to fix, in plain words, by field. The same totals function is used for the live preview on
 * the screen and for the authoritative figures stored when a draft is saved.
 */

export type DiscountKind = "none" | "percent" | "fixed";
export type Fulfilment = "none" | "collection" | "delivery";
export type LineKind = "product" | "service" | "custom" | "delivery" | "collection";

export const QUOTE_LINE_NAME_MAX = 200;
export const QUOTE_LINE_DESCRIPTION_MAX = 1000;
export const QUOTE_NOTES_MAX = 2000;
export const QUOTE_MAX_LINES = 100;

export type LineFormValues = {
  /** Identifies the line on the screen (and in errors) while it is being edited. */
  key: string;
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountKind: DiscountKind;
  discountValue: string;
};

export type QuoteFormValues = {
  /** "" while no customer is chosen. */
  customerId: string;
  issueDate: string;
  validUntil: string;
  neededBy: string;
  /** The goods and services; delivery and collection are chosen separately. */
  lines: LineFormValues[];
  fulfilment: Fulfilment;
  deliveryFee: string;
  discountKind: DiscountKind;
  discountValue: string;
  notes: string;
};

export type LineErrors = Partial<
  Record<"name" | "description" | "quantity" | "unitPrice" | "discountValue", string>
>;

export type QuoteErrors = {
  fields: Partial<
    Record<
      "customerId" | "issueDate" | "validUntil" | "neededBy" | "deliveryFee" | "discountValue" | "notes" | "lines",
      string
    >
  >;
  /** By line key. */
  lines: Record<string, LineErrors>;
};

export type ParsedLine = {
  key: string;
  kind: LineKind;
  name: string;
  description: string | null;
  quantityMilli: QuantityMilli;
  unitPriceCents: Cents;
  discount?: Discount;
};

export type ParsedQuote = {
  customerId: string | null;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  /** Goods and services in order, then the delivery or collection line if there is one. */
  lines: ParsedLine[];
  quoteDiscount?: Discount;
  notes: string | null;
  totals: DocumentTotals;
};

export type ParseQuoteResult = { ok: true; quote: ParsedQuote } | { ok: false; errors: QuoteErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An empty item row, as a new quote starts with. */
export function blankLine(key: string): LineFormValues {
  return {
    key,
    name: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    discountKind: "none",
    discountValue: "",
  };
}

/** A line with nothing typed in it at all. Left-over blank rows are dropped, not complained about. */
export function isBlankLine(line: LineFormValues): boolean {
  return (
    line.name.trim() === "" &&
    line.description.trim() === "" &&
    line.unitPrice.trim() === "" &&
    (line.quantity.trim() === "" || line.quantity.trim() === "1") &&
    line.discountKind === "none"
  );
}

function discountFrom(
  kind: DiscountKind,
  raw: string,
): { ok: true; value: Discount | undefined } | { ok: false; error: string } {
  if (kind === "none") return { ok: true, value: undefined };
  if (kind === "percent") {
    const r = parsePercent(raw);
    if (!r.ok) return r;
    if (r.value === 0) return { ok: false, error: "Enter a discount above 0, or choose No discount." };
    return { ok: true, value: { kind: "percent", basisPoints: r.value } };
  }
  const r = parseMoney(raw);
  if (!r.ok) return r;
  if (r.value === 0) return { ok: false, error: "Enter a discount above 0, or choose No discount." };
  return { ok: true, value: { kind: "fixed", cents: r.value } };
}

function parseLine(line: LineFormValues): { ok: true; line: ParsedLine } | { ok: false; errors: LineErrors } {
  const errors: LineErrors = {};

  const name = optionalText(line.name, QUOTE_LINE_NAME_MAX, "The item name");
  if (!name.ok) errors.name = name.error;
  else if (name.value === null) errors.name = "Say what this item is, like “Wedding cake”.";

  const description = optionalMultiline(line.description, QUOTE_LINE_DESCRIPTION_MAX, "The description");
  if (!description.ok) errors.description = description.error;

  const quantity = parseQuantity(line.quantity);
  if (!quantity.ok) errors.quantity = quantity.error;

  const price = parseMoney(line.unitPrice);
  if (!price.ok) {
    errors.unitPrice =
      line.unitPrice.trim() === "" ? "Enter a price. Use 0 if it is free." : price.error;
  }

  const discount = discountFrom(line.discountKind, line.discountValue);
  if (!discount.ok) errors.discountValue = discount.error;

  if (Object.keys(errors).length > 0 || !name.ok || !description.ok || !quantity.ok || !price.ok || !discount.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    line: {
      key: line.key,
      kind: "custom",
      name: name.value!,
      description: description.value,
      quantityMilli: quantity.value,
      unitPriceCents: price.value,
      discount: discount.value,
    },
  };
}

function toInputs(lines: readonly ParsedLine[]): LineInput[] {
  return lines.map((l) => ({
    id: l.key,
    quantityMilli: l.quantityMilli,
    unitPriceCents: l.unitPriceCents,
    discount: l.discount,
    vatStatus: "standard" as const,
  }));
}

/** Delivery or collection as a line, from the choice and the fee typed. */
function fulfilmentLine(
  values: QuoteFormValues,
): { ok: true; line: ParsedLine | null } | { ok: false; error: string } {
  if (values.fulfilment === "none") return { ok: true, line: null };
  if (values.fulfilment === "collection") {
    return {
      ok: true,
      line: { key: "fulfilment", kind: "collection", name: "Collection", description: null, quantityMilli: 1000, unitPriceCents: 0 },
    };
  }
  const fee = parseMoney(values.deliveryFee.trim() === "" ? "0" : values.deliveryFee);
  if (!fee.ok) return { ok: false, error: fee.error };
  return {
    ok: true,
    line: { key: "fulfilment", kind: "delivery", name: "Delivery", description: null, quantityMilli: 1000, unitPriceCents: fee.value },
  };
}

/**
 * Checks everything and works out the totals. `vat` is the business's VAT settings (from its
 * profile and country). Blank customer is fine for a draft; the quote cannot be sent without
 * one (checked when sending).
 */
export function parseQuote(values: QuoteFormValues, vat: VatSettings): ParseQuoteResult {
  const errors: QuoteErrors = { fields: {}, lines: {} };

  let customerId: string | null = null;
  if (values.customerId !== "") {
    if (UUID.test(values.customerId)) customerId = values.customerId;
    else errors.fields.customerId = "Choose a customer from the list.";
  }

  if (!isIsoDay(values.issueDate)) errors.fields.issueDate = "Choose the date of the quote.";
  if (!isIsoDay(values.validUntil)) {
    errors.fields.validUntil = "Choose how long the quote is valid for.";
  } else if (isIsoDay(values.issueDate) && values.validUntil < values.issueDate) {
    errors.fields.validUntil = "The quote can't expire before its date.";
  }
  let neededBy: string | null = null;
  if (values.neededBy.trim() !== "") {
    if (isIsoDay(values.neededBy)) neededBy = values.neededBy;
    else errors.fields.neededBy = "Choose a date, or leave it empty.";
  }

  const notes = optionalMultiline(values.notes, QUOTE_NOTES_MAX, "Notes");
  if (!notes.ok) errors.fields.notes = notes.error;

  const kept = values.lines.filter((l) => !isBlankLine(l));
  if (kept.length > QUOTE_MAX_LINES) {
    errors.fields.lines = `A quote can have up to ${QUOTE_MAX_LINES} items.`;
  }
  const lines: ParsedLine[] = [];
  for (const line of kept) {
    const r = parseLine(line);
    if (r.ok) lines.push(r.line);
    else errors.lines[line.key] = r.errors;
  }

  const fulfilment = fulfilmentLine(values);
  if (!fulfilment.ok) errors.fields.deliveryFee = fulfilment.error;

  const quoteDiscount = discountFrom(values.discountKind, values.discountValue);
  if (!quoteDiscount.ok) errors.fields.discountValue = quoteDiscount.error;

  const hasErrors =
    Object.keys(errors.fields).length > 0 || Object.keys(errors.lines).length > 0;
  if (hasErrors || !notes.ok || !fulfilment.ok || !quoteDiscount.ok) return { ok: false, errors };

  const all = fulfilment.line ? [...lines, fulfilment.line] : lines;
  let totals: DocumentTotals;
  try {
    totals = calculateDocument({
      lines: toInputs(all),
      quoteDiscount: quoteDiscount.value,
      vat,
    });
  } catch {
    errors.fields.lines = "This quote is too large to add up. Check the quantities and prices.";
    return { ok: false, errors };
  }
  if (totals.grossCents > MAX_CENTS) {
    errors.fields.lines = "This quote is too large to add up. Check the quantities and prices.";
    return { ok: false, errors };
  }

  // A fixed discount can't be more than what it comes off.
  for (const line of lines) {
    const result = totals.lines.find((l) => l.id === line.key);
    if (line.discount?.kind === "fixed" && result && line.discount.cents > result.lineDiscountCents) {
      errors.lines[line.key] = { discountValue: "The discount can't be more than the item's price." };
    }
  }
  if (quoteDiscount.value?.kind === "fixed" && quoteDiscount.value.cents > totals.quoteDiscountCents) {
    errors.fields.discountValue = "The discount can't be more than the quote total.";
  }
  if (Object.keys(errors.fields).length > 0 || Object.keys(errors.lines).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    quote: {
      customerId,
      issueDate: values.issueDate,
      validUntil: values.validUntil,
      neededBy,
      lines: all,
      quoteDiscount: quoteDiscount.value,
      notes: notes.value,
      totals,
    },
  };
}

/**
 * Totals for the screen while the person is still typing: lines that are not valid yet are
 * left out, nothing is reported as an error. The saved figures come from parseQuote on the
 * server, which is strict.
 */
export function previewTotals(values: QuoteFormValues, vat: VatSettings): DocumentTotals | null {
  const lines: ParsedLine[] = [];
  for (const line of values.lines) {
    if (isBlankLine(line)) continue;
    const quantity = parseQuantity(line.quantity);
    const price = parseMoney(line.unitPrice);
    if (!quantity.ok || !price.ok) continue;
    const discount = discountFrom(line.discountKind, line.discountValue);
    lines.push({
      key: line.key,
      kind: "custom",
      name: line.name,
      description: null,
      quantityMilli: quantity.value,
      unitPriceCents: price.value,
      discount: discount.ok ? discount.value : undefined,
    });
  }
  const fulfilment = fulfilmentLine(values);
  const all = fulfilment.ok && fulfilment.line ? [...lines, fulfilment.line] : lines;
  const quoteDiscount = discountFrom(values.discountKind, values.discountValue);
  try {
    const totals = calculateDocument({
      lines: toInputs(all),
      quoteDiscount: quoteDiscount.ok ? quoteDiscount.value : undefined,
      vat,
    });
    return totals.grossCents > MAX_CENTS ? null : totals;
  } catch {
    return null;
  }
}

/** The payload save_quote_draft() expects (see migration 20261002130000_quotes.sql). */
export function toDatabasePayload(
  quote: ParsedQuote,
  context: { countryCode: string; currencyCode: string },
) {
  const d = quote.quoteDiscount;
  return {
    quote: {
      customer_id: quote.customerId,
      issue_date: quote.issueDate,
      valid_until: quote.validUntil,
      needed_by: quote.neededBy,
      quote_discount_kind: d ? d.kind : "none",
      quote_discount_value: d ? (d.kind === "percent" ? d.basisPoints : d.cents) : 0,
      notes: quote.notes,
      country_code: context.countryCode,
      currency_code: context.currencyCode,
      net_cents: quote.totals.netCents,
      vat_cents: quote.totals.vatCents,
      gross_cents: quote.totals.grossCents,
    },
    lines: quote.lines.map((l, i) => ({
      sort_order: i,
      kind: l.kind,
      name: l.name,
      description: l.description,
      quantity_milli: l.quantityMilli,
      unit_price_cents: l.unitPriceCents,
      discount_kind: l.discount ? l.discount.kind : "none",
      discount_value: l.discount
        ? l.discount.kind === "percent"
          ? l.discount.basisPoints
          : l.discount.cents
        : 0,
      vat_status: "standard",
    })),
  };
}
