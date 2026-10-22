import { describe, expect, it } from "vitest";
import type { LineFormValues } from "../../quotes";
import type { VatSettings } from "../../money";
import { blankInvoiceForm, differsFromQuote, isInvoiceDraftForm, parseInvoiceDraft, quoteValuesOf, type InvoiceDraftForm } from "../draft";

const NOT_REGISTERED: VatSettings = { registered: false };
const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const CUSTOMER = "11111111-2222-4333-8444-555555555555";

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "k1",
  kind: "custom",
  productId: "",
  name: "Shelf",
  description: "",
  quantity: "2",
  unit: "",
  unitPrice: "100",
  discountKind: "none",
  discountValue: "",
  ...over,
});

const form = (over: Partial<InvoiceDraftForm> = {}): InvoiceDraftForm => ({
  ...blankInvoiceForm({ today: "2026-10-22", dueDays: 14, customerId: CUSTOMER }),
  lines: [line()],
  ...over,
});

describe("a blank invoice", () => {
  it("starts today, due the business's usual days later, with the customer if one is chosen", () => {
    const f = blankInvoiceForm({ today: "2026-10-22", dueDays: 14, customerId: CUSTOMER });
    expect(f.issueDate).toBe("2026-10-22");
    expect(f.dueDate).toBe("2026-11-05");
    expect(f.customerId).toBe(CUSTOMER);
    expect(f.lines).toEqual([]);
    expect(blankInvoiceForm({ today: "2026-10-22", dueDays: 14 }).customerId).toBe("");
  });
  it("carries the quote-only parts empty, and reads as an invoice form", () => {
    const f = blankInvoiceForm({ today: "2026-10-22", dueDays: 14 });
    expect(f.depositKind).toBe("none");
    expect(f.policies).toEqual([]);
    expect(f.signOff).toBe("");
    expect(isInvoiceDraftForm(f)).toBe(true);
  });
});

describe("isInvoiceDraftForm", () => {
  it("refuses what is not an invoice form, so nothing odd is stored or read", () => {
    expect(isInvoiceDraftForm(null)).toBe(false);
    expect(isInvoiceDraftForm("x")).toBe(false);
    expect(isInvoiceDraftForm({})).toBe(false);
    const noDue: Record<string, unknown> = { ...form() };
    delete noDue.dueDate;
    expect(isInvoiceDraftForm(noDue)).toBe(false);
    expect(isInvoiceDraftForm({ ...form(), dueDate: 5 })).toBe(false);
    expect(isInvoiceDraftForm({ ...form(), lines: Array.from({ length: 101 }, (_, i) => line({ key: `k${i}` })) })).toBe(false);
  });
});

describe("quoteValuesOf", () => {
  it("uses the due day where the quote parser wants a valid-until day, and no needed-by day", () => {
    const v = quoteValuesOf(form({ dueDate: "2026-12-01", neededBy: "2026-11-01" }));
    expect(v.validUntil).toBe("2026-12-01");
    expect(v.neededBy).toBe("");
    expect("dueDate" in v).toBe(false);
  });
});

describe("parseInvoiceDraft", () => {
  it("works the totals out here: 2 × R100 is R200 when there is no VAT", () => {
    const r = parseInvoiceDraft(form(), NOT_REGISTERED);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quote.totals.grossCents).toBe(20000);
      expect(r.quote.totals.vatCents).toBe(0);
      expect(r.dueDate).toBe("2026-11-05");
      expect(r.note).toBeNull();
    }
  });
  it("works VAT out the way the business enters prices: R200 including 15% is R26,09 of VAT", () => {
    const r = parseInvoiceDraft(form(), INCLUSIVE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.quote.totals.grossCents).toBe(20000);
      expect(r.quote.totals.vatCents).toBe(2609);
    }
  });
  it("carries a delivery fee and a discount into the total, the discount on everything (as on a quote)", () => {
    const r = parseInvoiceDraft(form({ fulfilment: "delivery", deliveryFee: "50", discountKind: "percent", discountValue: "10" }), NOT_REGISTERED);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.quote.totals.grossCents).toBe(((20000 + 5000) * 90) / 100);
  });
  it("keeps the note, trimmed, and none when empty", () => {
    const r = parseInvoiceDraft(form({ notes: "  Thanks!  " }), NOT_REGISTERED);
    expect(r.ok && r.note).toBe("Thanks!");
  });

  it("needs a customer, an item, and the dates, each said in the invoice's own words", () => {
    const r = parseInvoiceDraft(form({ customerId: "", lines: [], issueDate: "", dueDate: "" }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.fields.customerId).toBe("Choose who the invoice is for.");
      expect(r.errors.fields.lines).toBe("Add at least one item.");
      expect(r.errors.fields.issueDate).toBe("Choose the invoice date.");
      expect(r.errors.fields.dueDate).toBe("Choose the day it is due.");
      expect(r.errors.fields.validUntil).toBeUndefined();
    }
  });
  it("refuses a due day before the invoice day", () => {
    const r = parseInvoiceDraft(form({ dueDate: "2026-10-21" }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.fields.dueDate).toBe("The due day can't be before the invoice date.");
  });
  it("names an item that is wrong, by its key, and keeps the others", () => {
    const r = parseInvoiceDraft(form({ lines: [line({ key: "ok" }), line({ key: "bad", unitPrice: "abc" })] }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors.lines)).toEqual(["bad"]);
    }
  });
  it("counts only items that are filled in, so an empty row is not an item", () => {
    const r = parseInvoiceDraft(form({ lines: [line({ name: "", unitPrice: "", quantity: "" })] }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.fields.lines).toBe("Add at least one item.");
  });
  it("says an invoice, not a quote, when there are too many items", () => {
    const many = Array.from({ length: 100 }, (_, i) => line({ key: `k${i}`, name: `Item ${i}` }));
    const r = parseInvoiceDraft(form({ lines: many, fulfilment: "delivery", deliveryFee: "10" }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.fields.lines).toMatch(/^An invoice can have up to 99 items/);
  });
  it("refuses a note that is too long", () => {
    const r = parseInvoiceDraft(form({ notes: "x".repeat(2001) }), NOT_REGISTERED);
    expect(r.ok).toBe(false);
  });
});

describe("differsFromQuote", () => {
  const agreed = {
    lines: [{ kind: "custom", name: "Cake", description: null, quantityMilli: 1000, unit: null, unitPriceCents: 50000, discount: null, lineTotalCents: 50000, vatStatus: "standard" }],
    totals: { netCents: 43478, vatCents: 6522, grossCents: 50000 },
    quoteDiscount: null,
  };
  it("is false for the quote exactly as it was agreed, even with extras the invoice does not look at", () => {
    expect(differsFromQuote({ ...agreed, lines: [{ ...agreed.lines[0], photoImageId: "x" }] }, agreed)).toBe(false);
    expect(differsFromQuote(agreed, structuredClone(agreed))).toBe(false);
  });
  it("is true for any change an invoice could carry: quantity, price, name, an extra item, a discount, the totals", () => {
    expect(differsFromQuote({ ...agreed, lines: [{ ...agreed.lines[0], quantityMilli: 2000 }] }, agreed)).toBe(true);
    expect(differsFromQuote({ ...agreed, lines: [{ ...agreed.lines[0], unitPriceCents: 40000, lineTotalCents: 40000 }] }, agreed)).toBe(true);
    expect(differsFromQuote({ ...agreed, lines: [{ ...agreed.lines[0], name: "Cake!" }] }, agreed)).toBe(true);
    expect(differsFromQuote({ ...agreed, lines: [...agreed.lines, agreed.lines[0]] }, agreed)).toBe(true);
    expect(differsFromQuote({ ...agreed, quoteDiscount: { kind: "percent", basisPoints: 1000 } }, agreed)).toBe(true);
    expect(differsFromQuote({ ...agreed, totals: { ...agreed.totals, grossCents: 49999 } }, agreed)).toBe(true);
  });
});
