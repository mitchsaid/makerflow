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
  type VatStatus,
} from "../money";
import { optionalMultiline, optionalText } from "../form-values";
import { parseQuotePolicies, type QuotePolicyError, type QuotePolicyValues } from "../policies";
import { isIsoDay } from "./dates";
import { VARIATION_LABEL_MAX, VARIATION_NAME_MAX } from "../products/variations";
import { OPTION_NAME_MAX, OPTION_TEXT_MAX, type OptionKind } from "../products/options";
import { depositColumns, isDepositKind, parseDeposit, type DepositFormValues, type ParsedDeposit } from "./deposit";

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
export const QUOTE_UNIT_MAX = 20;
export const QUOTE_TITLE_MAX = 120;
export const QUOTE_DESCRIPTION_MAX = 2000;
export const QUOTE_SIGN_OFF_MAX = 200;
export const QUOTE_DELIVERY_ADDRESS_MAX = 400;
export const QUOTE_PAYMENT_MAX = 1000;
/** A page can only hold so many lines, however few characters they have. */
export const QUOTE_DESCRIPTION_MAX_LINES = 30;
export const QUOTE_NOTES_MAX_LINES = 60;
export const QUOTE_PAYMENT_MAX_LINES = 20;

/** A line from a saved product or service, or a one-off item typed for this quote. */
export type ItemKind = "product" | "service" | "custom";

export type LineFormValues = {
  /** Identifies the line on the screen (and in errors) while it is being edited. */
  key: string;
  kind: ItemKind;
  /** The product it came from, or "" for a one-off item. The line keeps its own copy anyway. */
  productId: string;
  name: string;
  description: string;
  quantity: string;
  /** "kg", "dozen", "hours": optional, "" for a plain count. */
  unit: string;
  unitPrice: string;
  discountKind: DiscountKind;
  discountValue: string;
  /** How VAT treats this item. Only a VAT-registered business sees it; everything else is standard. */
  vatStatus?: VatStatus;
  /**
   * The product's variation chosen for this item ("" for none): its id, and this item's own copy of the
   * product's word for the list ("Size") and the variation's name ("Large"). Absent from an older app.
   */
  variationId?: string;
  variationLabel?: string;
  variationName?: string;
  /** The options and extras chosen, each the item's own copy (see LineOption). Absent from an older app. */
  options?: LineOption[];
};

/**
 * One option chosen on an item: where it came from (ids, "" when unknown), the item's own copy of the words,
 * and the amount it adds to each item (cents, in the price-entry mode).
 * For "type something" the typed text is kept and `value` is "".
 */
export type LineOption = {
  groupId: string;
  group: string;
  kind: OptionKind;
  valueId: string;
  value: string;
  text: string;
  amountCents: number;
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
  /** Where a delivery goes: a customer's saved address, or one typed for this quote. Optional. */
  deliveryAddress: string;
  discountKind: DiscountKind;
  discountValue: string;
  notes: string;
  /** Shown as a heading above the items. Optional. */
  title: string;
  /** An introduction under the title. Optional. */
  description: string;
  /** "Yours in sweetness": closes the document. Optional. */
  signOff: string;
  /** "Other ways to pay" (the country's other methods, or pay on collection). Optional. Prints under the bank details. */
  paymentInstructions: string;
  /** Show the business's bank details on this quote (when it has saved them). */
  showBankDetails: boolean;
  /** Show each product's photo beside its item. On unless switched off. */
  showPhotos: boolean;
  /** The deposit and when the balance is due (see ./deposit). */
  depositKind: DepositFormValues["depositKind"];
  depositValue: string;
  balanceDue: DepositFormValues["balanceDue"];
  balanceDueDate: string;
  /** The quote's terms: its own copy of each library term it includes, and terms written just for it (see lib/policies). */
  policies: QuotePolicyValues[];
};

export type LineErrors = Partial<
  Record<"name" | "description" | "quantity" | "unit" | "unitPrice" | "discountValue" | "variation" | "options", string>
>;

export type QuoteErrors = {
  fields: Partial<
    Record<
      | "customerId"
      | "issueDate"
      | "validUntil"
      | "neededBy"
      | "deliveryFee"
      | "deliveryAddress"
      | "discountValue"
      | "notes"
      | "lines"
      | "title"
      | "description"
      | "signOff"
      | "paymentInstructions"
      | "depositValue"
      | "balanceDueDate"
      | "policies",
      string
    >
  >;
  /** By line key. */
  lines: Record<string, LineErrors>;
  /** By the key of the term on the quote. */
  policies?: Record<string, QuotePolicyError>;
};

export type ParsedLine = {
  key: string;
  kind: LineKind;
  productId: string | null;
  name: string;
  description: string | null;
  quantityMilli: QuantityMilli;
  unit: string | null;
  unitPriceCents: Cents;
  discount?: Discount;
  vatStatus: VatStatus;
  /** The variation chosen (a copy of its words), or null. */
  variation: { id: string | null; label: string; name: string } | null;
  /** The options chosen (copies), and what they add to each item's price. */
  options: ParsedLineOption[];
  extrasPerItemCents: Cents;
};

export type ParsedLineOption = {
  groupId: string | null;
  group: string;
  kind: OptionKind;
  valueId: string | null;
  value: string | null;
  text: string | null;
  amountCents: Cents;
};

export type ParsedQuote = {
  customerId: string | null;
  issueDate: string;
  validUntil: string;
  neededBy: string | null;
  /**
   * Where a delivery goes, or null. Kept on the draft even if the quote is not (or no longer) a delivery.
   * Undefined when an older app that doesn't know about it saved the quote: the draft keeps what it has.
   */
  deliveryAddress: string | null | undefined;
  /** Goods and services in order, then the delivery or collection line if there is one. */
  lines: ParsedLine[];
  quoteDiscount?: Discount;
  notes: string | null;
  title: string | null;
  description: string | null;
  signOff: string | null;
  paymentInstructions: string | null;
  showBankDetails: boolean;
  /** Show each product's photo beside its item. Undefined when an older app saved the quote: the draft keeps its setting. */
  showPhotos: boolean | undefined;
  /** Null: no deposit. */
  deposit: ParsedDeposit | null;
  policies: { policyId: string | null; title: string | null; body: string }[];
  totals: DocumentTotals;
};

export type ParseQuoteResult = { ok: true; quote: ParsedQuote } | { ok: false; errors: QuoteErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DISCOUNT_KINDS: readonly unknown[] = ["none", "percent", "fixed"];
const ITEM_KINDS: readonly unknown[] = ["product", "service", "custom"];
export const VAT_STATUSES: readonly VatStatus[] = ["standard", "zero", "exempt"];
const FULFILMENTS: readonly unknown[] = ["none", "collection", "delivery"];
/** Far more rows than a quote can hold, so a hand-built request can't make us parse thousands. */
const MAX_RAW_LINES = 500;

/**
 * Is this really the shape of QuoteFormValues? The browser sends the form as a plain object, and
 * a hand-built request can send anything, so the server checks the shape before it looks at any
 * value. (parseQuote then checks the values.)
 */
export function isQuoteFormValues(value: unknown): value is QuoteFormValues {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const strings = [
    "customerId",
    "issueDate",
    "validUntil",
    "neededBy",
    "deliveryFee",
    "discountValue",
    "notes",
    "title",
    "description",
    "signOff",
    "paymentInstructions",
  ];
  if (!strings.every((key) => typeof v[key] === "string")) return false;
  // Only an older app, from before the Terms box became a term, sends this (see parseQuote).
  if (v.terms !== undefined && typeof v.terms !== "string") return false;
  // A phone still running an older version of the app does not send it: that means on.
  if (v.showBankDetails !== undefined && typeof v.showBankDetails !== "boolean") return false;
  if (v.showPhotos !== undefined && typeof v.showPhotos !== "boolean") return false;
  // Same for the deposit: an older app does not send it, and that means no deposit.
  if (v.depositKind !== undefined && !isDepositKind(v.depositKind)) return false;
  if (v.balanceDue !== undefined && v.balanceDue !== "handover" && v.balanceDue !== "date") return false;
  if (v.depositValue !== undefined && typeof v.depositValue !== "string") return false;
  // An older app does not send the delivery address either: that means keep what the draft has.
  if (v.deliveryAddress !== undefined && typeof v.deliveryAddress !== "string") return false;
  if (v.balanceDueDate !== undefined && typeof v.balanceDueDate !== "string") return false;
  if (!DISCOUNT_KINDS.includes(v.discountKind) || !FULFILMENTS.includes(v.fulfilment)) return false;
  if (!Array.isArray(v.lines) || v.lines.length > MAX_RAW_LINES) return false;
  if (
    !Array.isArray(v.policies) ||
    v.policies.length > 100 ||
    !v.policies.every((p) => {
      const x = p as Record<string, unknown> | null;
      return (
        !!x &&
        typeof x.key === "string" &&
        typeof x.policyId === "string" &&
        typeof x.title === "string" &&
        typeof x.body === "string"
      );
    })
  ) {
    return false;
  }
  return v.lines.every((line) => {
    if (typeof line !== "object" || line === null) return false;
    const l = line as Record<string, unknown>;
    return (
      ["key", "productId", "name", "description", "quantity", "unit", "unitPrice", "discountValue"].every(
        (key) => typeof l[key] === "string",
      ) &&
      DISCOUNT_KINDS.includes(l.discountKind) &&
      ITEM_KINDS.includes(l.kind) &&
      // An older app does not send it: that means standard-rated.
      (l.vatStatus === undefined || VAT_STATUSES.includes(l.vatStatus as VatStatus)) &&
      // Nor the variation: that means none.
      ["variationId", "variationLabel", "variationName"].every((key) => l[key] === undefined || typeof l[key] === "string") &&
      // Nor the options: that means none.
      (l.options === undefined || (Array.isArray(l.options) && l.options.length <= MAX_LINE_OPTIONS && l.options.every(isLineOption)))
    );
  });
}

const MAX_LINE_OPTIONS = 100;
const OPTION_KINDS: readonly unknown[] = ["one", "any", "text"];

function isLineOption(value: unknown): value is LineOption {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    ["groupId", "group", "valueId", "value", "text"].every((key) => typeof o[key] === "string") &&
    OPTION_KINDS.includes(o.kind) &&
    typeof o.amountCents === "number"
  );
}

/** Checks the options chosen on an item: their shape, words and amounts. */
function parseLineOptions(options: readonly LineOption[]): { ok: true; options: ParsedLineOption[] } | { ok: false } {
  const parsed: ParsedLineOption[] = [];
  for (const o of options) {
    const group = o.group.trim();
    const value = o.value.trim();
    const text = o.text.trim();
    const amountOk = Number.isSafeInteger(o.amountCents) && o.amountCents >= 0 && o.amountCents <= MAX_CENTS;
    const idsOk = (o.groupId === "" || UUID.test(o.groupId)) && (o.valueId === "" || UUID.test(o.valueId));
    const wordsOk =
      group !== "" &&
      group.length <= OPTION_NAME_MAX &&
      (o.kind === "text" ? text !== "" && text.length <= OPTION_TEXT_MAX && value === "" : value !== "" && value.length <= OPTION_NAME_MAX && text === "");
    if (!amountOk || !idsOk || !wordsOk) return { ok: false };
    parsed.push({
      groupId: o.groupId || null,
      group,
      kind: o.kind,
      valueId: o.valueId || null,
      value: o.kind === "text" ? null : value,
      text: o.kind === "text" ? text : null,
      amountCents: o.amountCents,
    });
  }
  return { ok: true, options: parsed };
}

/** What the options add to each item's price. */
export function optionsPerItem(options: readonly { amountCents: number }[]): Cents {
  return options.reduce((sum, o) => sum + o.amountCents, 0);
}

/** An empty item row, as a new quote starts with. */
export function blankLine(key: string): LineFormValues {
  return {
    key,
    kind: "custom",
    productId: "",
    name: "",
    description: "",
    quantity: "1",
    unit: "",
    unitPrice: "",
    discountKind: "none",
    discountValue: "",
    vatStatus: "standard",
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

/**
 * Checks one line on its own: the configure sheet uses it before adding a line to the quote,
 * and parseQuote uses it for every line.
 */
export function parseLine(line: LineFormValues): { ok: true; line: ParsedLine } | { ok: false; errors: LineErrors } {
  const errors: LineErrors = {};

  // Where the line came from. Only a hand-built request could get these wrong.
  const fromProduct = line.productId !== "";
  const validSource = fromProduct
    ? UUID.test(line.productId) && (line.kind === "product" || line.kind === "service")
    : line.kind === "custom";
  if (!validSource) errors.name = "This item could not be read. Remove it and add it again.";

  const name = optionalText(line.name, QUOTE_LINE_NAME_MAX, "The item name");
  if (!name.ok) errors.name = name.error;
  else if (name.value === null) errors.name = "Say what this item is, like “Wedding cake”.";

  const description = optionalMultiline(line.description, QUOTE_LINE_DESCRIPTION_MAX, "The description");
  if (!description.ok) errors.description = description.error;

  const quantity = parseQuantity(line.quantity);
  if (!quantity.ok) errors.quantity = quantity.error;

  const unit = optionalText(line.unit, QUOTE_UNIT_MAX, "The unit");
  if (!unit.ok) errors.unit = unit.error;

  const price = parseMoney(line.unitPrice);
  if (!price.ok) {
    errors.unitPrice =
      line.unitPrice.trim() === "" ? "Enter a price. Use 0 if it is free." : price.error;
  }

  const discount = discountFrom(line.discountKind, line.discountValue);
  if (!discount.ok) errors.discountValue = discount.error;

  // The options chosen: the item's own copy; only on an item from a product.
  let options: ParsedLineOption[] = [];
  if ((line.options ?? []).length > 0) {
    const r = fromProduct ? parseLineOptions(line.options ?? []) : ({ ok: false } as const);
    if (r.ok) options = r.options;
    else errors.options = "This item's choices could not be read. Choose them again.";
  }

  // The variation: its own copy of the words; a link only to a product's variation.
  const variationName = (line.variationName ?? "").trim();
  const variationLabel = (line.variationLabel ?? "").trim();
  const variationId = line.variationId ?? "";
  let variation: ParsedLine["variation"] = null;
  if (variationName !== "" || variationId !== "") {
    if (!fromProduct || variationName === "" || variationLabel === "" || (variationId !== "" && !UUID.test(variationId))) {
      errors.variation = "This item's choice could not be read. Choose it again.";
    } else if (variationName.length > VARIATION_NAME_MAX || variationLabel.length > VARIATION_LABEL_MAX) {
      errors.variation = "This item's choice has too long a name. Shorten it on the product.";
    } else {
      variation = { id: variationId || null, label: variationLabel, name: variationName };
    }
  }

  if (Object.keys(errors).length > 0 || !name.ok || !description.ok || !quantity.ok || !unit.ok || !price.ok || !discount.ok) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    line: {
      key: line.key,
      kind: line.kind,
      productId: fromProduct ? line.productId : null,
      name: name.value!,
      description: description.value,
      quantityMilli: quantity.value,
      unit: unit.value,
      unitPriceCents: price.value,
      discount: discount.value,
      vatStatus: line.vatStatus && VAT_STATUSES.includes(line.vatStatus) ? line.vatStatus : "standard",
      variation,
      options,
      extrasPerItemCents: optionsPerItem(options),
    },
  };
}

function toInputs(lines: readonly ParsedLine[]): LineInput[] {
  return lines.map((l) => ({
    id: l.key,
    quantityMilli: l.quantityMilli,
    // The price each, with what the options add to each item.
    unitPriceCents: l.unitPriceCents + l.extrasPerItemCents,
    discount: l.discount,
    vatStatus: l.vatStatus,
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
      line: { key: "fulfilment", kind: "collection", productId: null, name: "Collection", description: null, quantityMilli: 1000, unit: null, unitPriceCents: 0, vatStatus: "standard", variation: null, options: [], extrasPerItemCents: 0 },
    };
  }
  const fee = parseMoney(values.deliveryFee.trim() === "" ? "0" : values.deliveryFee);
  if (!fee.ok) return { ok: false, error: fee.error };
  return {
    ok: true,
    line: { key: "fulfilment", kind: "delivery", productId: null, name: "Delivery", description: null, quantityMilli: 1000, unit: null, unitPriceCents: fee.value, vatStatus: "standard", variation: null, options: [], extrasPerItemCents: 0 },
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

  const notes = optionalMultiline(values.notes, QUOTE_NOTES_MAX, "Notes", QUOTE_NOTES_MAX_LINES);
  if (!notes.ok) errors.fields.notes = notes.error;

  const title = optionalText(values.title, QUOTE_TITLE_MAX, "The title");
  if (!title.ok) errors.fields.title = title.error;
  const description = optionalMultiline(values.description, QUOTE_DESCRIPTION_MAX, "The description", QUOTE_DESCRIPTION_MAX_LINES);
  if (!description.ok) errors.fields.description = description.error;
  const signOff = optionalText(values.signOff, QUOTE_SIGN_OFF_MAX, "The sign-off");
  if (!signOff.ok) errors.fields.signOff = signOff.error;
  const deliveryAddress = optionalMultiline(
    typeof values.deliveryAddress === "string" ? values.deliveryAddress : "",
    QUOTE_DELIVERY_ADDRESS_MAX,
    "The delivery address",
  );
  // Only a delivery shows the box, so only then can a too-long address be refused (it could not be fixed
  // otherwise). A quote that isn't a delivery drops one that is too long: it would never be printed.
  if (!deliveryAddress.ok && values.fulfilment === "delivery") errors.fields.deliveryAddress = deliveryAddress.error;
  const payment = optionalMultiline(values.paymentInstructions, QUOTE_PAYMENT_MAX, "Other ways to pay", QUOTE_PAYMENT_MAX_LINES);
  if (!payment.ok) errors.fields.paymentInstructions = payment.error;

  const deposit = parseDeposit(values, values.issueDate);
  if (!deposit.ok) Object.assign(errors.fields, deposit.errors);

  // An older app still open on a phone may send the old Terms box: it becomes a term at the end, so nothing typed is lost.
  const oldTerms = (values as { terms?: unknown }).terms;
  const policies = parseQuotePolicies(
    typeof oldTerms === "string" && oldTerms.trim() !== ""
      ? [...values.policies, { key: "old-terms", policyId: "", title: "", body: oldTerms }]
      : values.policies,
  );
  if (!policies.ok) {
    errors.fields.policies = policies.error;
    errors.policies = policies.byKey;
  }

  const kept = values.lines.filter((l) => !isBlankLine(l));
  // Delivery or collection is stored as a line too, so it counts towards the limit.
  const maxItems = QUOTE_MAX_LINES - (values.fulfilment === "none" ? 0 : 1);
  if (kept.length > maxItems) {
    errors.fields.lines =
      values.fulfilment === "none"
        ? `A quote can have up to ${QUOTE_MAX_LINES} items.`
        : `A quote can have up to ${maxItems} items, plus delivery or collection.`;
  }
  const lines: ParsedLine[] = [];
  for (const line of kept) {
    const r = parseLine(line);
    // Without VAT there is only one treatment; a leftover from when the business was registered is dropped.
    if (r.ok) lines.push(vat.registered ? r.line : { ...r.line, vatStatus: "standard" });
    else errors.lines[line.key] = r.errors;
  }

  const fulfilment = fulfilmentLine(values);
  if (!fulfilment.ok) errors.fields.deliveryFee = fulfilment.error;

  const quoteDiscount = discountFrom(values.discountKind, values.discountValue);
  if (!quoteDiscount.ok) errors.fields.discountValue = quoteDiscount.error;

  const hasErrors =
    Object.keys(errors.fields).length > 0 || Object.keys(errors.lines).length > 0;
  if (hasErrors || !notes.ok || !title.ok || !description.ok || !signOff.ok || !payment.ok || !policies.ok || !fulfilment.ok || !quoteDiscount.ok || !deposit.ok) {
    return { ok: false, errors };
  }

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
      deliveryAddress: typeof values.deliveryAddress !== "string" ? undefined : deliveryAddress.ok ? deliveryAddress.value : null,
      lines: all,
      quoteDiscount: quoteDiscount.value,
      notes: notes.value,
      title: title.value,
      description: description.value,
      signOff: signOff.value,
      paymentInstructions: payment.value,
      showBankDetails: values.showBankDetails !== false,
      showPhotos: typeof values.showPhotos === "boolean" ? values.showPhotos : undefined,
      deposit: deposit.deposit,
      policies: policies.policies,
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
      productId: null,
      name: line.name,
      description: null,
      quantityMilli: quantity.value,
      unit: null,
      unitPriceCents: price.value,
      discount: discount.ok ? discount.value : undefined,
      vatStatus: vat.registered && line.vatStatus && VAT_STATUSES.includes(line.vatStatus) ? line.vatStatus : "standard",
      variation: null,
      ...(() => {
        const r = line.productId ? parseLineOptions(line.options ?? []) : ({ ok: false } as const);
        const options = r.ok ? r.options : [];
        return { options, extrasPerItemCents: optionsPerItem(options) };
      })(),
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
      // Absent (not null) when an older app did not send it, so the draft keeps its address.
      ...(quote.deliveryAddress === undefined ? {} : { delivery_address: quote.deliveryAddress }),
      quote_discount_kind: d ? d.kind : "none",
      quote_discount_value: d ? (d.kind === "percent" ? d.basisPoints : d.cents) : 0,
      notes: quote.notes,
      title: quote.title,
      description: quote.description,
      sign_off: quote.signOff,
      payment_instructions: quote.paymentInstructions,
      show_bank_details: quote.showBankDetails,
      // Absent (not false) when an older app did not send it, so the draft keeps its setting.
      ...(quote.showPhotos === undefined ? {} : { show_photos: quote.showPhotos }),
      ...depositColumns(quote.deposit),
      policies: quote.policies.map((p) => ({ policy_id: p.policyId, title: p.title, body: p.body })),
      country_code: context.countryCode,
      currency_code: context.currencyCode,
      net_cents: quote.totals.netCents,
      vat_cents: quote.totals.vatCents,
      gross_cents: quote.totals.grossCents,
    },
    lines: quote.lines.map((l, i) => ({
      sort_order: i,
      kind: l.kind,
      product_id: l.productId,
      name: l.name,
      description: l.description,
      quantity_milli: l.quantityMilli,
      unit: l.unit,
      unit_price_cents: l.unitPriceCents,
      discount_kind: l.discount ? l.discount.kind : "none",
      discount_value: l.discount
        ? l.discount.kind === "percent"
          ? l.discount.basisPoints
          : l.discount.cents
        : 0,
      vat_status: l.vatStatus,
      variation_id: l.variation?.id ?? null,
      variation_label: l.variation?.label ?? null,
      variation_name: l.variation?.name ?? null,
      options: l.options.map((o) => ({
        group_id: o.groupId,
        group: o.group,
        kind: o.kind,
        value_id: o.valueId,
        value: o.value,
        text: o.text,
        amount_cents: o.amountCents,
      })),
    })),
  };
}
