import { describe, expect, it } from "vitest";
import type { Customer } from "../../customers";
import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { buildQuoteSnapshot, type QuoteSnapshot } from "../../quotes/snapshot";
import { blankInvoiceForm, parseInvoiceDraft, type InvoiceDraftForm } from "../draft";
import { invoiceFormFromSnapshot } from "../duplicate";

const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const EXCLUSIVE: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };
const NOT_REGISTERED: VatSettings = { registered: false };
const PRODUCT = "11111111-1111-4111-8111-111111111111";
const SERVICE = "22222222-2222-4222-8222-222222222222";
const STYLE = ZA_LOCALE.numberStyle;
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

const customer = { id: CUSTOMER, organisationId: "o1", name: "Thandi Nkosi", kind: "person", addressLine1: "12 Main Road", city: "Soweto", postalCode: "1804", deliverySameAsMain: true, archived: false } as unknown as Customer;
const business = { name: "Sweet Co", phone: "011 555 0101", email: null, addressLine1: "1 Baker Street", addressLine2: null, city: "Johannesburg", region: "Gauteng", postalCode: "2196", vatRegistered: true, vatNumber: "4987654321" };

/** An invoice with a bit of everything that changes what it adds up to. */
function original(): InvoiceDraftForm {
  return {
    ...blankInvoiceForm({ today: "2026-10-31", dueDays: 14, customerId: CUSTOMER }),
    lines: [
      {
        key: "a",
        kind: "product",
        productId: PRODUCT,
        name: "Wedding cake",
        description: "Three tiers",
        quantity: "1",
        unit: "",
        unitPrice: "800",
        discountKind: "percent",
        discountValue: "10",
        variationId: "",
        variationLabel: "Size",
        variationName: "Large",
        options: [
          { groupId: "", group: "Flavour", kind: "one", valueId: "", value: "Red velvet", text: "", amountCents: 5000 },
          { groupId: "", group: "Extras", kind: "any", valueId: "", value: "Gold leaf", text: "", amountCents: 12033 },
          { groupId: "", group: "Candles", kind: "any", valueId: "", value: "Candles", text: "", amountCents: 1550, quantityMilli: 3000 },
          { groupId: "", group: "Message", kind: "text", valueId: "", value: "", text: "Happy birthday Sipho", amountCents: 2000 },
        ],
      },
      {
        key: "b",
        kind: "service",
        productId: SERVICE,
        name: "Delivery setup",
        description: "",
        quantity: "2,5",
        unit: "hours",
        unitPrice: "333,33",
        discountKind: "fixed",
        discountValue: "17,50",
        listPrice: "400",
        quantityPriceText: "2 or more: 10% off",
      },
      { key: "c", kind: "custom", productId: "", name: "Cupcakes", description: "", quantity: "12", unit: "", unitPrice: "15,15", discountKind: "none", discountValue: "" },
    ],
    fulfilment: "delivery",
    deliveryFee: "50",
    deliveryAddress: "5 Long Street, Soweto",
    discountKind: "percent",
    discountValue: "5",
    notes: "Thank you!",
    paymentInstructions: "EFT to 123",
    showQuantityPrices: true,
  };
}

function snapshotOf(form: InvoiceDraftForm, vat: VatSettings): QuoteSnapshot {
  const parsed = parseInvoiceDraft(form, vat);
  if (!parsed.ok) throw new Error(`should parse: ${JSON.stringify(parsed.errors)}`);
  return buildQuoteSnapshot({
    quote: parsed.quote,
    number: "",
    version: 1,
    business: { ...business, vatRegistered: vat.registered },
    customer,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat,
    locale: ZA_LOCALE,
    bank: null,
  });
}

describe("duplicating an invoice", () => {
  for (const [name, vat] of [
    ["VAT-inclusive prices", INCLUSIVE],
    ["VAT-exclusive prices", EXCLUSIVE],
    ["a business not registered for VAT", NOT_REGISTERED],
  ] as const) {
    it(`totals exactly what the original did, with ${name}`, () => {
      const sent = snapshotOf(original(), vat);
      const copied = invoiceFormFromSnapshot(sent, { customerId: CUSTOMER, today: "2026-11-02", dueDays: 7, numberStyle: STYLE });
      expect(copied.ok).toBe(true);
      if (!copied.ok) return;
      const again = snapshotOf(copied.form, vat);
      // Every total, every VAT group, and every line, to the cent.
      expect(again.totals).toEqual(sent.totals);
      expect(again.quoteDiscount).toEqual(sent.quoteDiscount);
      expect(again.lines).toHaveLength(sent.lines.length);
      for (const [i, line] of sent.lines.entries()) {
        expect(again.lines[i]).toMatchObject({
          kind: line.kind,
          name: line.name,
          quantityMilli: line.quantityMilli,
          unitPriceCents: line.unitPriceCents,
          lineTotalCents: line.lineTotalCents,
          discount: line.discount,
          ...(line.options ? { options: line.options } : {}),
          ...(line.variation ? { variation: line.variation } : {}),
          ...(line.quantityPrice ? { quantityPrice: line.quantityPrice } : {}),
        });
      }
    });
  }

  it("is a new draft: today's date, the usual due day, the same customer and words, and no number", () => {
    const sent = snapshotOf(original(), INCLUSIVE);
    const copied = invoiceFormFromSnapshot(sent, { customerId: CUSTOMER, today: "2026-11-02", dueDays: 7, numberStyle: STYLE });
    if (!copied.ok) throw new Error("should copy");
    expect(copied.form).toMatchObject({
      customerId: CUSTOMER,
      issueDate: "2026-11-02",
      dueDate: "2026-11-09",
      fulfilment: "delivery",
      deliveryFee: "50",
      deliveryAddress: "5 Long Street, Soweto",
      notes: "Thank you!",
      paymentInstructions: "EFT to 123",
      showQuantityPrices: true,
    });
    expect(copied.form.lines.map((l) => l.name)).toEqual(["Wedding cake", "Delivery setup", "Cupcakes"]);
    // Delivery is chosen, not typed as an item.
    expect(copied.form.lines.some((l) => l.name === "Delivery")).toBe(false);
  });

  it("refuses an invoice from before options were simplified, saying why", () => {
    const sent = snapshotOf(original(), INCLUSIVE);
    const old: QuoteSnapshot = { ...sent, lines: sent.lines.map((l, i) => (i === 0 ? { ...l, options: [{ group: "Gold", kind: "any" as const, charge: "line" as const, value: "Gold leaf", text: null, amountCents: 5000 }] } : l)) };
    const copied = invoiceFormFromSnapshot(old, { customerId: CUSTOMER, today: "2026-11-02", dueDays: 7, numberStyle: STYLE });
    expect(copied).toEqual({ ok: false, reason: "This invoice is too old to duplicate." });
  });
});
