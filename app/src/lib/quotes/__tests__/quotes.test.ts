import { describe, expect, it } from "vitest";
import type { VatSettings } from "../../money";
import {
  isBlankLine,
  parseQuote,
  previewTotals,
  toDatabasePayload,
  type LineFormValues,
  type QuoteFormValues,
} from "../index";

const NOT_REGISTERED: VatSettings = { registered: false };
const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const EXCLUSIVE: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "k1",
  name: "Wedding cake",
  description: "",
  quantity: "1",
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
  discountKind: "none",
  discountValue: "",
  notes: "",
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
