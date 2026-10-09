import { describe, expect, it } from "vitest";
import type { VatSettings } from "../../money";
import {
  isBlankLine,
  isQuoteFormValues,
  parseQuote,
  previewTotals,
  toDatabasePayload,
  type LineFormValues,
  type LineOption,
  type QuoteFormValues,
} from "../index";
import { ZA_LOCALE } from "../../locale/za";
import { toFormValues } from "../form-values";

const NOT_REGISTERED: VatSettings = { registered: false };
const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const EXCLUSIVE: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "k1",
  kind: "custom",
  productId: "",
  name: "Wedding cake",
  description: "",
  quantity: "1",
  unit: "",
  unitPrice: "800",
  discountKind: "none",
  discountValue: "",
  ...over,
});

const quote = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-02",
  validUntil: "2026-10-16",
  neededBy: "",
  lines: [line()],
  fulfilment: "none",
  deliveryFee: "",
  deliveryAddress: "",
  discountKind: "none",
  discountValue: "",
  notes: "",
  title: "",
  description: "",
  signOff: "",
  paymentInstructions: "",
  showBankDetails: true, showPhotos: true,
  depositKind: "none",
  depositValue: "",
  balanceDue: "handover",
  balanceDueDate: "",
  policies: [],
  ...over,
});

function parsed(values: QuoteFormValues, vat: VatSettings = NOT_REGISTERED) {
  const r = parseQuote(values, vat);
  if (!r.ok) throw new Error(`expected a valid quote: ${JSON.stringify(r.errors)}`);
  return r.quote;
}
function errorsOf(values: QuoteFormValues, vat: VatSettings = NOT_REGISTERED) {
  const r = parseQuote(values, vat);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("parseQuote", () => {
  it("accepts a draft with no customer and no lines", () => {
    const q = parsed(quote({ lines: [] }));
    expect(q.customerId).toBeNull();
    expect(q.lines).toEqual([]);
    expect(q.totals.grossCents).toBe(0);
  });

  it("turns typed text into exact numbers and totals", () => {
    const q = parsed(
      quote({
        lines: [
          line({ key: "a", quantity: "1", unitPrice: "800" }),
          line({ key: "b", name: "Cupcakes", quantity: "12", unitPrice: "15,50" }),
        ],
      }),
    );
    expect(q.lines.map((l) => [l.quantityMilli, l.unitPriceCents])).toEqual([
      [1000, 80000],
      [12000, 1550],
    ]);
    expect(q.totals.grossCents).toBe(80000 + 18600);
  });

  it("drops blank rows without complaint but flags half-filled ones", () => {
    const blank = line({ key: "blank", name: "", unitPrice: "", quantity: "1" });
    expect(isBlankLine(blank)).toBe(true);
    expect(parsed(quote({ lines: [line(), blank] })).lines).toHaveLength(1);

    const half = line({ key: "half", name: "Cupcakes", unitPrice: "" });
    const e = errorsOf(quote({ lines: [line(), half] }));
    expect(e.lines.half?.unitPrice).toMatch(/Enter a price/);
    expect(e.lines.k1).toBeUndefined();
  });

  it("reports every problem by field and by line, in plain words", () => {
    const e = errorsOf(
      quote({
        customerId: "not-an-id",
        issueDate: "",
        validUntil: "2026-10-01",
        neededBy: "soon",
        lines: [line({ key: "x", name: "", quantity: "0", unitPrice: "abc" })],
        discountKind: "percent",
        discountValue: "",
      }),
    );
    expect(Object.keys(e.fields).sort()).toEqual(["customerId", "discountValue", "issueDate", "neededBy"]);
    expect(Object.keys(e.lines.x ?? {}).sort()).toEqual(["name", "quantity", "unitPrice"]);
    expect(e.lines.x?.name).toMatch(/Say what this item is/);
  });

  it("will not let the quote expire before its date", () => {
    expect(errorsOf(quote({ validUntil: "2026-10-01" })).fields.validUntil).toMatch(/can't expire before/);
    expect(parsed(quote({ validUntil: "2026-10-02" })).validUntil).toBe("2026-10-02");
  });

  it("adds a collection or delivery line, taxed like any other", () => {
    const collection = parsed(quote({ fulfilment: "collection" }));
    expect(collection.lines.at(-1)).toMatchObject({ kind: "collection", unitPriceCents: 0, name: "Collection" });
    expect(collection.totals.grossCents).toBe(80000);

    const delivery = parsed(quote({ fulfilment: "delivery", deliveryFee: "50" }), EXCLUSIVE);
    expect(delivery.lines.at(-1)).toMatchObject({ kind: "delivery", unitPriceCents: 5000 });
    // 800 + 50 = 850 excluding VAT, VAT 127,50, total 977,50
    expect(delivery.totals.netCents).toBe(85000);
    expect(delivery.totals.vatCents).toBe(12750);
    expect(delivery.totals.grossCents).toBe(97750);

    expect(errorsOf(quote({ fulfilment: "delivery", deliveryFee: "abc" })).fields.deliveryFee).toBeDefined();
    // A delivery with no fee typed is free delivery, not an error.
    expect(parsed(quote({ fulfilment: "delivery", deliveryFee: "" })).totals.grossCents).toBe(80000);
    // A fee typed and then switched back to nothing leaves no line behind.
    expect(parsed(quote({ fulfilment: "none", deliveryFee: "50" })).lines).toHaveLength(1);
  });

  it("applies line and quote discounts in the documented order", () => {
    const q = parsed(
      quote({
        lines: [
          line({ key: "a", unitPrice: "1000", discountKind: "percent", discountValue: "10" }),
          line({ key: "b", name: "Other", unitPrice: "1000" }),
        ],
        discountKind: "fixed",
        discountValue: "100",
      }),
    );
    // 900 + 1000 = 1900, less 100 = 1800
    expect(q.totals.lineDiscountsCents).toBe(10000);
    expect(q.totals.quoteDiscountCents).toBe(10000);
    expect(q.totals.grossCents).toBe(180000);
  });

  it("refuses discounts bigger than what they come off", () => {
    const lineTooBig = errorsOf(quote({ lines: [line({ unitPrice: "100", discountKind: "fixed", discountValue: "150" })] }));
    expect(lineTooBig.lines.k1?.discountValue).toMatch(/more than the item's price/);
    expect(errorsOf(quote({ discountKind: "fixed", discountValue: "900" })).fields.discountValue).toMatch(
      /more than the quote total/,
    );
    expect(errorsOf(quote({ discountKind: "percent", discountValue: "150" })).fields.discountValue).toBeDefined();
    expect(errorsOf(quote({ discountKind: "percent", discountValue: "0" })).fields.discountValue).toMatch(/above 0/);
  });

  it("handles VAT entry modes", () => {
    const inclusive = parsed(quote(), INCLUSIVE);
    expect(inclusive.totals.grossCents).toBe(80000);
    expect(inclusive.totals.vatCents).toBe(10435); // 800 x 15 / 115
    const exclusive = parsed(quote(), EXCLUSIVE);
    expect(exclusive.totals.netCents).toBe(80000);
    expect(exclusive.totals.grossCents).toBe(92000);
  });

  it("refuses quotes too big to store, without throwing", () => {
    const huge = quote({
      lines: [line({ key: "a", quantity: "9999999", unitPrice: "999999999" }), line({ key: "b", name: "More", quantity: "9999999", unitPrice: "999999999" })],
    });
    expect(errorsOf(huge).fields.lines).toMatch(/too large/);
  });

  it("limits notes and the number of items", () => {
    expect(errorsOf(quote({ notes: "x".repeat(2001) })).fields.notes).toBeDefined();
    const many = Array.from({ length: 101 }, (_, i) => line({ key: `k${i}`, name: `Item ${i}` }));
    expect(errorsOf(quote({ lines: many })).fields.lines).toMatch(/up to 100/);
    expect(parseQuote(quote({ lines: many.slice(0, 100) }), NOT_REGISTERED).ok).toBe(true);
  });
});

describe("previewTotals", () => {
  it("matches the strict totals whenever the quote is valid", () => {
    const values = quote({
      lines: [line({ key: "a", unitPrice: "19,99", quantity: "3" }), line({ key: "b", name: "B", unitPrice: "5,05", quantity: "0,5" })],
      fulfilment: "delivery",
      deliveryFee: "35",
      discountKind: "percent",
      discountValue: "7,5",
    });
    for (const vat of [NOT_REGISTERED, INCLUSIVE, EXCLUSIVE]) {
      expect(previewTotals(values, vat)).toEqual(parsed(values, vat).totals);
    }
  });

  it("skips what is not valid yet and never throws while typing", () => {
    const values = quote({
      lines: [line({ key: "a" }), line({ key: "b", name: "B", unitPrice: "12x" }), line({ key: "c", name: "C", quantity: "" })],
      discountKind: "percent",
      discountValue: "abc",
    });
    expect(previewTotals(values, NOT_REGISTERED)?.grossCents).toBe(80000);
    expect(previewTotals(quote({ lines: [] }), NOT_REGISTERED)?.grossCents).toBe(0);
  });
});

describe("toDatabasePayload", () => {
  it("maps a parsed quote onto what save_quote_draft expects", () => {
    const q = parsed(
      quote({
        customerId: "11111111-1111-4111-8111-111111111111",
        neededBy: "2026-11-01",
        notes: "Thanks",
        lines: [line({ unitPrice: "100", discountKind: "percent", discountValue: "10" })],
        fulfilment: "delivery",
        deliveryFee: "20",
        discountKind: "fixed",
        discountValue: "5",
      }),
      EXCLUSIVE,
    );
    const p = toDatabasePayload(q, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(p.quote).toMatchObject({
      customer_id: "11111111-1111-4111-8111-111111111111",
      issue_date: "2026-10-02",
      valid_until: "2026-10-16",
      needed_by: "2026-11-01",
      quote_discount_kind: "fixed",
      quote_discount_value: 500,
      notes: "Thanks",
      country_code: "ZA",
      currency_code: "ZAR",
      net_cents: q.totals.netCents,
      vat_cents: q.totals.vatCents,
      gross_cents: q.totals.grossCents,
    });
    expect(p.lines.map((l) => [l.sort_order, l.kind, l.discount_kind, l.discount_value])).toEqual([
      [0, "custom", "percent", 1000],
      [1, "delivery", "none", 0],
    ]);
  });

  it("sends no discount as none and zero", () => {
    const p = toDatabasePayload(parsed(quote()), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(p.quote.quote_discount_kind).toBe("none");
    expect(p.quote.quote_discount_value).toBe(0);
    expect(p.quote.customer_id).toBeNull();
    expect(p.quote.needed_by).toBeNull();
  });
});

describe("toFormValues", () => {
  const stored = {
    customerId: "11111111-1111-4111-8111-111111111111",
    issueDate: "2026-10-02",
    validUntil: "2026-10-16",
    neededBy: null,
    deliveryAddress: null,
    discountKind: "percent" as const,
    discountValue: 750,
    notes: null,
    title: null, description: null, signOff: null, paymentInstructions: null, showBankDetails: true, showPhotos: true, depositKind: "none" as const, depositValue: 0, balanceDue: "handover" as const, balanceDueDate: null, policies: [],
    lines: [
      { id: "l2", sortOrder: 1, kind: "custom", productId: null, name: "Cupcakes", description: "Vanilla", quantityMilli: 12_000, unit: null, unitPriceCents: 1550, discountKind: "none" as const, discountValue: 0 },
      { id: "l3", sortOrder: 2, kind: "delivery", productId: null, name: "Delivery", description: null, quantityMilli: 1000, unit: null, unitPriceCents: 3500, discountKind: "none" as const, discountValue: 0 },
      { id: "l1", sortOrder: 0, kind: "product", productId: "22222222-2222-4222-8222-222222222222", name: "Cake", description: null, quantityMilli: 1125, unit: null, unitPriceCents: 80_000, discountKind: "fixed" as const, discountValue: 5000 },
    ],
  };

  it("shows a stored quote as form text, in order, with delivery as a choice and a fee", () => {
    const v = toFormValues(stored, ZA_LOCALE.numberStyle);
    expect(v.lines.map((l) => [l.name, l.quantity, l.unitPrice, l.discountKind, l.discountValue])).toEqual([
      ["Cake", "1,1250", "800", "fixed", "50"],
      ["Cupcakes", "12", "15,50", "none", ""],
    ]);
    expect(v).toMatchObject({ fulfilment: "delivery", deliveryFee: "35", discountKind: "percent", discountValue: "7,5", neededBy: "", notes: "" });
  });

  it("brings the delivery address back as typed, or empty when there is none", () => {
    const withAddress = { ...stored, deliveryAddress: "22 Jacaranda Avenue\nParkhurst" };
    expect(toFormValues(withAddress, ZA_LOCALE.numberStyle).deliveryAddress).toBe("22 Jacaranda Avenue\nParkhurst");
    expect(toFormValues(stored, ZA_LOCALE.numberStyle).deliveryAddress).toBe("");
  });

  it("saves back to exactly what was stored", () => {
    const v = toFormValues(stored, ZA_LOCALE.numberStyle);
    const q = parsed(v, EXCLUSIVE);
    const payload = toDatabasePayload(q, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.lines.map((l) => [l.name, l.quantity_milli, l.unit_price_cents, l.discount_kind, l.discount_value, l.kind])).toEqual([
      ["Cake", 1125, 80000, "fixed", 5000, "product"],
      ["Cupcakes", 12000, 1550, "none", 0, "custom"],
      ["Delivery", 1000, 3500, "none", 0, "delivery"],
    ]);
    expect(payload.quote).toMatchObject({ quote_discount_kind: "percent", quote_discount_value: 750 });
  });
});

describe("limits with delivery", () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => line({ key: `k${i}`, name: `Item ${i}` }));
  it("counts delivery or collection towards the 100 lines, with a message that says so", () => {
    const e = errorsOf(quote({ lines: many(100), fulfilment: "delivery", deliveryFee: "10" }));
    expect(e.fields.lines).toMatch(/up to 99 items, plus delivery or collection/);
    expect(parseQuote(quote({ lines: many(99), fulfilment: "delivery", deliveryFee: "10" }), NOT_REGISTERED).ok).toBe(true);
    expect(parseQuote(quote({ lines: many(100) }), NOT_REGISTERED).ok).toBe(true);
  });
});

describe("isQuoteFormValues", () => {
  it("accepts the real thing", () => {
    expect(isQuoteFormValues(quote())).toBe(true);
    expect(isQuoteFormValues(quote({ lines: [] }))).toBe(true);
  });
  it("rejects anything that is not the right shape, instead of throwing later", () => {
    const good = quote();
    const bad: unknown[] = [
      null,
      undefined,
      "quote",
      [],
      { ...good, lines: undefined },
      { ...good, lines: "nope" },
      { ...good, lines: [null] },
      { ...good, lines: [{ ...good.lines[0], name: 5 }] },
      { ...good, lines: [{ ...good.lines[0], discountKind: "huge" }] },
      { ...good, notes: undefined },
      { ...good, neededBy: 20261001 },
      { ...good, fulfilment: "drone" },
      { ...good, discountKind: "free" },
      { ...good, lines: Array.from({ length: 501 }, () => good.lines[0]) },
    ];
    for (const value of bad) expect(isQuoteFormValues(value), JSON.stringify(value)?.slice(0, 60)).toBe(false);
  });
});

describe("lines from products", () => {
  const PRODUCT = "22222222-2222-4222-8222-222222222222";
  it("keeps where a line came from, and saves it", () => {
    const q = parsed(quote({ lines: [line({ kind: "service", productId: PRODUCT })] }));
    expect(q.lines[0]).toMatchObject({ kind: "service", productId: PRODUCT });
    const p = toDatabasePayload(q, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(p.lines[0]).toMatchObject({ kind: "service", product_id: PRODUCT });
  });
  it("a one-off item has no product", () => {
    const p = toDatabasePayload(parsed(quote()), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(p.lines[0]).toMatchObject({ kind: "custom", product_id: null });
  });
  it("refuses a line whose source does not add up", () => {
    for (const bad of [
      line({ kind: "custom", productId: PRODUCT }),
      line({ kind: "product", productId: "" }),
      line({ kind: "product", productId: "not-an-id" }),
    ]) {
      expect(errorsOf(quote({ lines: [bad] })).lines.k1?.name).toMatch(/could not be read/);
    }
  });
  it("comes back from storage as the same kind of line", () => {
    const v = toFormValues(
      {
        customerId: null, issueDate: "2026-10-03", validUntil: "2026-10-17", neededBy: null, deliveryAddress: null,
        discountKind: "none", discountValue: 0, notes: null,
        title: null, description: null, signOff: null, paymentInstructions: null, showBankDetails: true, showPhotos: true, depositKind: "none" as const, depositValue: 0, balanceDue: "handover" as const, balanceDueDate: null, policies: [],
        lines: [{ id: "x", sortOrder: 0, kind: "service", productId: PRODUCT, name: "Design", description: null, quantityMilli: 2000, unit: null, unitPriceCents: 45000, discountKind: "none", discountValue: 0 }],
      },
      ZA_LOCALE.numberStyle,
    );
    expect(v.lines[0]).toMatchObject({ kind: "service", productId: PRODUCT, quantity: "2", unitPrice: "450" });
  });
});

describe("the delivery address", () => {
  it("is optional, tidied, and limited to 400 characters", () => {
    expect(parsed(quote({ fulfilment: "delivery", deliveryAddress: "" })).deliveryAddress).toBeNull();
    expect(parsed(quote({ fulfilment: "delivery", deliveryAddress: "  22 Jacaranda Avenue \r\n  Parkhurst  " })).deliveryAddress).toBe(
      "22 Jacaranda Avenue\nParkhurst",
    );
    expect(parsed(quote({ deliveryAddress: "x".repeat(400) })).deliveryAddress).toHaveLength(400);
    expect(errorsOf(quote({ fulfilment: "delivery", deliveryAddress: "x".repeat(401) })).fields.deliveryAddress).toMatch(/400/);
  });

  it("can only be refused when a delivery shows the box: otherwise a too-long one is dropped, not blocked", () => {
    const tooLong = "x".repeat(401);
    expect(parsed(quote({ fulfilment: "collection", deliveryAddress: tooLong })).deliveryAddress).toBeNull();
    expect(parsed(quote({ fulfilment: "none", deliveryAddress: tooLong })).deliveryAddress).toBeNull();
    expect(errorsOf(quote({ fulfilment: "delivery", deliveryAddress: tooLong })).fields.deliveryAddress).toBeDefined();
  });

  it("is saved with the draft, and an older app that doesn't send it leaves the saved one alone", () => {
    const withIt = toDatabasePayload(parsed(quote({ deliveryAddress: "The gate at the back" })), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(withIt.quote.delivery_address).toBe("The gate at the back");
    const cleared = toDatabasePayload(parsed(quote({ deliveryAddress: "" })), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(cleared.quote).toHaveProperty("delivery_address", null);
    const older: Record<string, unknown> = { ...quote() };
    delete older.deliveryAddress;
    expect(isQuoteFormValues(older)).toBe(true);
    const payload = toDatabasePayload(parsed(older as QuoteFormValues), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.quote).not.toHaveProperty("delivery_address");
  });

  it("is refused when it is not text", () => {
    expect(isQuoteFormValues({ ...quote(), deliveryAddress: 5 })).toBe(false);
  });
});

describe("the photos switch", () => {
  it("is saved with the draft, and an older app that doesn't send it leaves the saved one alone", () => {
    const on = toDatabasePayload(parsed(quote({ showPhotos: true })), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(on.quote.show_photos).toBe(true);
    const off = toDatabasePayload(parsed(quote({ showPhotos: false })), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(off.quote.show_photos).toBe(false);
    const older: Record<string, unknown> = { ...quote() };
    delete older.showPhotos;
    expect(isQuoteFormValues(older)).toBe(true);
    const payload = toDatabasePayload(parsed(older as QuoteFormValues), { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.quote).not.toHaveProperty("show_photos");
    expect(isQuoteFormValues({ ...quote(), showPhotos: "yes" })).toBe(false);
  });
});

describe("VAT treatment on items", () => {
  const stored = {
    customerId: null, issueDate: "2026-10-02", validUntil: "2026-10-16", neededBy: null, deliveryAddress: null,
    discountKind: "none" as const, discountValue: 0, notes: null, title: null, description: null, signOff: null,
    paymentInstructions: null, showBankDetails: true, showPhotos: true, depositKind: "none" as const,
    depositValue: 0, balanceDue: "handover" as const, balanceDueDate: null, policies: [],
  };
  const lines = [line({ key: "a", unitPrice: "115" }), line({ key: "b", name: "Bread", unitPrice: "100", vatStatus: "zero" })];

  it("charges VAT on the standard-rated items only", () => {
    const p = parsed(quote({ lines }), INCLUSIVE);
    expect(p.totals.vatCents).toBe(1500);
    expect(p.totals.grossCents).toBe(21_500);
    expect(p.lines.map((l) => l.vatStatus)).toEqual(["standard", "zero"]);
  });

  it("adds VAT on top for the standard-rated items when prices are entered without it", () => {
    const p = parsed(quote({ lines }), EXCLUSIVE);
    expect(p.totals.vatCents).toBe(1725);
    expect(p.totals.grossCents).toBe(11_500 + 10_000 + 1725);
  });

  it("treats everything as standard when the business is not VAT registered", () => {
    const p = parsed(quote({ lines }), NOT_REGISTERED);
    expect(p.lines.map((l) => l.vatStatus)).toEqual(["standard", "standard"]);
    expect(p.totals.vatCents).toBe(0);
  });

  it("treats a missing treatment (an older app) as standard, and refuses an unknown one", () => {
    const old = line({ key: "a" }) as Record<string, unknown>;
    delete old.vatStatus;
    expect(isQuoteFormValues(quote({ lines: [old as LineFormValues] }))).toBe(true);
    expect(parsed(quote({ lines: [old as LineFormValues] }), INCLUSIVE).lines[0].vatStatus).toBe("standard");
    expect(isQuoteFormValues(quote({ lines: [line({ vatStatus: "reduced" as never })] }))).toBe(false);
  });

  it("shares a quote discount across the treatments in proportion", () => {
    const p = parsed(quote({ lines, discountKind: "percent", discountValue: "10" }), INCLUSIVE);
    // 215 less 10% = 193,50; the standard part is 103,50 and holds 13,50 of VAT.
    expect(p.totals.grossCents).toBe(19_350);
    expect(p.totals.vatCents).toBe(1350);
  });

  it("is saved with each line and comes back into the form", () => {
    const p = parsed(quote({ lines }), INCLUSIVE);
    const payload = toDatabasePayload(p, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.lines.map((l) => l.vat_status)).toEqual(["standard", "zero"]);
    const back = toFormValues(
      {
        ...stored,
        lines: payload.lines.map((l, i) => ({
          id: `l${i}`, sortOrder: i, kind: l.kind, productId: null, name: l.name, description: null,
          quantityMilli: l.quantity_milli, unit: null, unitPriceCents: l.unit_price_cents,
          discountKind: "none" as const, discountValue: 0, vatStatus: l.vat_status as "standard" | "zero",
        })),
      },
      ZA_LOCALE.numberStyle,
    );
    expect(back.lines.map((l) => l.vatStatus)).toEqual(["standard", "zero"]);
  });

  it("shows in the live total", () => {
    expect(previewTotals(quote({ lines }), INCLUSIVE)?.vatCents).toBe(1500);
  });
});

describe("a variation on an item", () => {
  const PRODUCT = "22222222-2222-4222-8222-222222222222";
  const VARIATION = "33333333-3333-4333-8333-333333333333";
  const fromProduct = (over: Partial<LineFormValues> = {}) =>
    line({ kind: "product", productId: PRODUCT, variationId: VARIATION, variationLabel: "Size", variationName: "Large", unitPrice: "600", ...over });

  it("keeps its own copy of the words and is saved with the item", () => {
    const p = parsed(quote({ lines: [fromProduct()] }));
    expect(p.lines[0].variation).toEqual({ id: VARIATION, label: "Size", name: "Large" });
    const payload = toDatabasePayload(p, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.lines[0]).toMatchObject({ variation_id: VARIATION, variation_label: "Size", variation_name: "Large" });
  });

  it("keeps the words when the product's variation has gone (no id)", () => {
    expect(parsed(quote({ lines: [fromProduct({ variationId: "" })] })).lines[0].variation).toEqual({ id: null, label: "Size", name: "Large" });
  });

  it("refuses a variation on a one-off item, or one it can't read", () => {
    expect(errorsOf(quote({ lines: [line({ variationLabel: "Size", variationName: "Large" })] })).lines.k1.variation).toBeTruthy();
    expect(errorsOf(quote({ lines: [fromProduct({ variationId: "nope" })] })).lines.k1.variation).toBeTruthy();
    expect(errorsOf(quote({ lines: [fromProduct({ variationLabel: "" })] })).lines.k1.variation).toBeTruthy();
    expect(isQuoteFormValues(quote({ lines: [fromProduct({ variationName: 3 as never })] }))).toBe(false);
  });

  it("an item without one has none, and an older app's item still reads", () => {
    expect(parsed(quote()).lines[0].variation).toBeNull();
  });
});

describe("options and extras on an item", () => {
  const PRODUCT = "22222222-2222-4222-8222-222222222222";
  const opt = (over: Partial<LineOption> = {}): LineOption => ({
    groupId: "", group: "Extras", kind: "any", valueId: "", value: "Gold sprinkles", text: "", amountCents: 200, ...over,
  });
  const cupcakes = (options: LineOption[]) =>
    line({ kind: "product", productId: PRODUCT, name: "Cupcakes", quantity: "12", unitPrice: "15", options });

  it("adds every option's amount to the price each", () => {
    const p = parsed(quote({ lines: [cupcakes([opt(), opt({ value: "Gift box", amountCents: 300 })])] }));
    expect(p.lines[0]).toMatchObject({ extrasPerItemCents: 500, unitPriceCents: 1500 });
    // 12 × (R15 + R2 + R3) = R240.
    expect(p.totals.grossCents).toBe(24000);
    expect(previewTotals(quote({ lines: [cupcakes([opt(), opt({ value: "Gift box", amountCents: 300 })])] }), NOT_REGISTERED)?.grossCents).toBe(24000);
  });

  it("charges an older app's “once for the line” option for each item too", () => {
    const older = { ...opt({ value: "Gift box", amountCents: 300 }), charge: "line" } as LineOption;
    const p = parsed(quote({ lines: [cupcakes([older])] }));
    expect(p.lines[0].extrasPerItemCents).toBe(300);
    expect(p.totals.grossCents).toBe(12 * 1800);
  });

  it("keeps typed text, and is saved with the item", () => {
    const p = parsed(quote({ lines: [cupcakes([opt({ group: "Message", kind: "text", value: "", text: " Happy 40th ", amountCents: 2500 })])] }));
    expect(p.lines[0].options[0]).toMatchObject({ text: "Happy 40th", value: null, amountCents: 2500 });
    const payload = toDatabasePayload(p, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.lines[0].options).toEqual([
      { group_id: null, group: "Message", kind: "text", value_id: null, value: null, text: "Happy 40th", amount_cents: 2500 },
    ]);
  });

  it("refuses options it can't read, or on a one-off item", () => {
    expect(errorsOf(quote({ lines: [cupcakes([opt({ amountCents: -1 })])] })).lines.k1.options).toBeTruthy();
    expect(errorsOf(quote({ lines: [cupcakes([opt({ value: "" })])] })).lines.k1.options).toBeTruthy();
    expect(errorsOf(quote({ lines: [cupcakes([opt({ kind: "text", text: "" })])] })).lines.k1.options).toBeTruthy();
    expect(errorsOf(quote({ lines: [line({ options: [opt()] })] })).lines.k1.options).toBeTruthy();
    expect(isQuoteFormValues(quote({ lines: [cupcakes([{ ...opt(), kind: "maybe" as never }])] }))).toBe(false);
  });

  it("comes back into the form from what was stored", () => {
    const back = toFormValues(
      {
        customerId: null, issueDate: "2026-10-02", validUntil: "2026-10-16", neededBy: null, deliveryAddress: null,
        discountKind: "none", discountValue: 0, notes: null, title: null, description: null, signOff: null,
        paymentInstructions: null, showBankDetails: true, showPhotos: true, depositKind: "none", depositValue: 0,
        balanceDue: "handover", balanceDueDate: null, policies: [],
        lines: [{ id: "l1", sortOrder: 0, kind: "product", productId: PRODUCT, name: "Cupcakes", description: null, quantityMilli: 12000, unit: null, unitPriceCents: 1500, discountKind: "none", discountValue: 0, options: [opt()] }],
      },
      ZA_LOCALE.numberStyle,
    );
    expect(back.lines[0].options).toEqual([opt()]);
  });
});
