import { describe, expect, it } from "vitest";
import { calculateDocument, type VatSettings } from "../../money";
import { ZA_LOCALE } from "../../locale/za";
import type { QuoteSnapshot } from "../../quotes/snapshot";
import {
  creditItemsOf,
  creditTotals,
  defaultCreditAmount,
  isZeroQuantityText,
  parseCreditForm,
  remainingItems,
  type CreditFormValues,
} from "../index";
import { buildCreditNoteSnapshot } from "../snapshot";

const inclusive: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const exclusive: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };

const line = (name: string, lineTotalCents: number, quantityMilli = 1000, extra: Record<string, unknown> = {}) => ({
  kind: "custom",
  name,
  description: null,
  quantityMilli,
  unitPriceCents: Math.round((lineTotalCents * 1000) / quantityMilli),
  discount: null,
  lineTotalCents,
  vatStatus: "standard" as const,
  ...extra,
});

const money = (c: number) => `R${(c / 100).toFixed(2)}`;
const qty = (m: number, unit: string | null) => `${m / 1000}${unit ? ` ${unit}` : ""}`;

describe("what an invoice's items allow", () => {
  it("is each item's amount after its share of the whole-invoice discount, leaving out what is at nothing", () => {
    const items = creditItemsOf({
      lines: [line("Cake", 10000, 2000), line("Sign", 5000), line("Delivery", 0)],
      quoteDiscount: { kind: "fixed", cents: 1500, amountCents: 1500 },
    } as never);
    expect(items.map((i) => [i.index, i.name, i.quantityMilli, i.amountCents])).toEqual([
      [0, "Cake", 2000, 9000],
      [1, "Sign", 1000, 4500],
    ]);
  });

  it("takes the earlier credit notes off, never below nothing", () => {
    const items = creditItemsOf({ lines: [line("Cake", 10000, 5000)], quoteDiscount: null } as never);
    const [left] = remainingItems(items, [
      { lineIndex: 0, quantityMilli: 2000, amountCents: 4000 },
      { lineIndex: 7, quantityMilli: 1000, amountCents: 1 },
    ]);
    expect(left.quantityLeftMilli).toBe(3000);
    expect(left.amountLeftCents).toBe(6000);
    const [over] = remainingItems(items, [{ lineIndex: 0, quantityMilli: 9000, amountCents: 99999 }]);
    expect(over.quantityLeftMilli).toBe(0);
    expect(over.amountLeftCents).toBe(0);
  });

  it("offers the share of what is left for a quantity, and all of it for the last", () => {
    const [item] = remainingItems(creditItemsOf({ lines: [line("Cake", 10000, 5000)], quoteDiscount: null } as never), []);
    expect(defaultCreditAmount(item, 2000)).toBe(4000);
    expect(defaultCreditAmount(item, 5000)).toBe(10000);
    expect(defaultCreditAmount(item, 4999)).toBe(9998);
    expect(defaultCreditAmount(item, 0)).toBe(0);
  });
});

describe("the credit note form", () => {
  const remaining = remainingItems(creditItemsOf({ lines: [line("Cake", 10000, 5000), line("Sign", 5000)], quoteDiscount: null } as never), []);
  const context = { remaining, invoiceDate: "2026-10-10", today: "2026-10-20", money, quantity: qty };
  const good: CreditFormValues = {
    reason: "returned",
    issueDate: "2026-10-20",
    explanation: "  Two came back cracked ",
    lines: [
      { index: 0, selected: true, quantity: "2", amount: "40" },
      { index: 1, selected: false, quantity: "", amount: "" },
    ],
  };

  it("takes the ticked items, a reason, a day between the invoice and today, and an explanation", () => {
    expect(parseCreditForm(good, context)).toEqual({
      ok: true,
      reason: "returned",
      issueDate: "2026-10-20",
      explanation: "Two came back cracked",
      lines: [{ index: 0, quantityMilli: 2000, amountCents: 4000 }],
    });
  });

  it("reads zero however it is written, and still refuses an empty box", () => {
    for (const zero of ["0", "0,0", "0.00", "00", " 0 "]) {
      const r = parseCreditForm({ ...good, lines: [{ index: 1, selected: true, quantity: zero, amount: "10" }] }, context);
      expect(r, zero).toMatchObject({ ok: true, lines: [{ index: 1, quantityMilli: 0, amountCents: 1000 }] });
    }
    expect(isZeroQuantityText("")).toBe(false);
    expect(isZeroQuantityText("0,5")).toBe(false);
    expect(isZeroQuantityText("10")).toBe(false);
  });

  it("allows a price change with no goods back (0), but not an empty box", () => {
    const priceChange = parseCreditForm({ ...good, lines: [{ index: 1, selected: true, quantity: "0", amount: "10" }] }, context);
    expect(priceChange).toMatchObject({ ok: true, lines: [{ index: 1, quantityMilli: 0, amountCents: 1000 }] });
    const empty = parseCreditForm({ ...good, lines: [{ index: 1, selected: true, quantity: "", amount: "10" }] }, context);
    expect(empty.ok ? null : empty.errors.byLine?.[1]?.quantity).toMatch(/or 0 if it is only a price change/);
  });

  it("says what is wrong, item by item, and how much is left", () => {
    const bad = (over: Partial<CreditFormValues>) => {
      const r = parseCreditForm({ ...good, ...over }, context);
      return r.ok ? null : r.errors;
    };
    expect(bad({ reason: "" })?.reason).toMatch(/Choose why/);
    expect(bad({ issueDate: "2026-10-09" })?.issueDate).toMatch(/before the invoice/);
    expect(bad({ issueDate: "2026-10-21" })?.issueDate).toMatch(/hasn't come yet/);
    expect(bad({ explanation: " " })?.explanation).toMatch(/Say in a few words/);
    expect(bad({ lines: [{ index: 0, selected: false, quantity: "", amount: "" }] })?.lines).toMatch(/Tick at least one/);
    const errors = bad({
      lines: [
        { index: 0, selected: true, quantity: "6", amount: "100,01" },
        { index: 1, selected: true, quantity: "1", amount: "abc" },
      ],
    });
    expect(errors?.byLine?.[0]?.quantity).toBe("Only 5 left to credit.");
    expect(errors?.byLine?.[0]?.amount).toBe("Only R100.00 left to credit.");
    expect(errors?.byLine?.[1]?.amount).toMatch(/numbers only/);
  });
});

describe("the credit note's money", () => {
  /** An invoice of three items, as the totals module works it out. */
  function invoice(vat: VatSettings) {
    const doc = calculateDocument({
      lines: [33333, 33333, 33334].map((c, i) => ({ id: String(i), quantityMilli: 1000, unitPriceCents: c, vatStatus: "standard" as const })),
      vat,
    });
    return doc;
  }

  it.each([
    ["inclusive", inclusive],
    ["exclusive", exclusive],
  ])("credits exactly the invoice's total and VAT when the whole invoice is credited in two notes (%s)", (_name, vat) => {
    const doc = invoice(vat);
    const first = creditTotals({
      lines: [{ amountCents: 33333, vatStatus: "standard" }, { amountCents: 33333, vatStatus: "standard" }],
      vat,
      invoiceGroups: doc.groups,
      priorGroups: [],
    });
    const second = creditTotals({
      lines: [{ amountCents: 33334, vatStatus: "standard" }],
      vat,
      invoiceGroups: doc.groups,
      priorGroups: first.groups,
    });
    expect(first.vatCents + second.vatCents).toBe(doc.vatCents);
    expect(first.grossCents + second.grossCents).toBe(doc.grossCents);
    expect(first.netCents + second.netCents).toBe(doc.netCents);
    expect(first.netCents + first.vatCents).toBe(first.grossCents);
  });

  it("credits the whole invoice in one note to the cent", () => {
    for (const vat of [inclusive, exclusive]) {
      const doc = invoice(vat);
      const all = creditTotals({
        lines: [33333, 33333, 33334].map((c) => ({ amountCents: c, vatStatus: "standard" as const })),
        vat,
        invoiceGroups: doc.groups,
        priorGroups: [],
      });
      expect(all.grossCents).toBe(doc.grossCents);
      expect(all.vatCents).toBe(doc.vatCents);
    }
  });

  it("works VAT once for each status, and none when the business is not registered", () => {
    const mixed = creditTotals({
      lines: [{ amountCents: 11500, vatStatus: "standard" }, { amountCents: 5000, vatStatus: "zero" }],
      vat: inclusive,
      invoiceGroups: [
        { vatStatus: "standard", amountCents: 23000, vatCents: 3000 },
        { vatStatus: "zero", amountCents: 5000, vatCents: 0 },
      ],
      priorGroups: [],
    });
    expect(mixed.groups.map((g) => [g.vatStatus, g.vatCents])).toEqual([["standard", 1500], ["zero", 0]]);
    expect(mixed.grossCents).toBe(16500);
    const none = creditTotals({
      lines: [{ amountCents: 1000, vatStatus: "standard" }],
      vat: { registered: false },
      invoiceGroups: [{ vatStatus: "standard", amountCents: 1000, vatCents: 0 }],
      priorGroups: [],
    });
    expect(none.vatCents).toBe(0);
    expect(none.grossCents).toBe(1000);
  });
});

describe("the credit note's document", () => {
  const vat = inclusive;
  const doc = calculateDocument({
    lines: [
      { id: "0", quantityMilli: 2000, unitPriceCents: 20000, vatStatus: "standard" },
      { id: "1", quantityMilli: 1000, unitPriceCents: 5000, vatStatus: "standard" },
    ],
    vat,
  });
  const invoiceSnapshot = {
    number: "INV-0007",
    version: 1,
    issueDate: "2026-10-10",
    validUntil: "2026-10-10",
    neededBy: null,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat: { registered: true, entry: "inclusive", rateBp: 1500, taxName: "VAT", registrationNumberLabel: "VAT number" },
    lines: [line("Cake", 40000, 2000, { unit: "box" }), line("Sign", 5000)],
    quoteDiscount: null,
    totals: { subtotalCents: doc.subtotalCents, lineDiscountsCents: 0, quoteDiscountCents: 0, netCents: doc.netCents, vatCents: doc.vatCents, grossCents: doc.grossCents, groups: doc.groups },
    notes: "Thanks!",
    title: "Wedding",
    description: "Pitch",
    signOff: "Bye",
    paymentInstructions: "SnapScan",
    bankDetails: [{ label: "Bank", value: "FNB" }],
    deposit: { label: "Deposit" },
    policies: [{ title: "T", body: "B" }],
    invoice: { dueDate: "2026-10-24", quoteNumber: "QT-1", billedToLabel: "Billed to", dueLabel: "Due date", quoteLabel: "Quote" },
    wording: { title: "Tax invoice", notATaxInvoice: "", inclusiveStatement: "All prices include VAT at 15%." },
  } as unknown as QuoteSnapshot;
  const items = creditItemsOf(invoiceSnapshot);

  it("is a tax credit note for the items credited, naming the invoice, the day and why", () => {
    const { snapshot, totals } = buildCreditNoteSnapshot({
      invoice: invoiceSnapshot,
      invoiceNumber: "INV-0007",
      invoiceDate: "2026-10-10",
      issueDate: "2026-10-20",
      reason: "returned",
      explanation: "One box came back",
      items,
      lines: [{ index: 0, quantityMilli: 1000, amountCents: 20000 }],
      priorGroups: [],
      locale: ZA_LOCALE,
    });
    expect(snapshot.number).toBe("");
    expect(snapshot.wording.title).toBe("Tax credit note");
    expect(snapshot.creditNote).toMatchObject({ invoiceNumber: "INV-0007", invoiceDate: "2026-10-10", reason: "Goods returned or defective", explanation: "One box came back" });
    expect(snapshot.invoice).toBeUndefined();
    expect(snapshot.issueDate).toBe("2026-10-20");
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.lines[0]).toMatchObject({ name: "Cake", quantityMilli: 1000, unit: "box", unitPriceCents: 20000, lineTotalCents: 20000 });
    expect(snapshot.totals.subtotalCents).toBe(20000);
    expect(snapshot.totals.grossCents).toBe(totals.grossCents);
    // Nothing that belongs to the invoice or the quote is carried over.
    expect(snapshot.deposit).toBeNull();
    expect(snapshot.bankDetails).toEqual([]);
    expect(snapshot.policies).toEqual([]);
    expect(snapshot.paymentInstructions).toBeNull();
    expect(snapshot.description).toBeNull();
    expect(snapshot.signOff).toBeNull();
    expect(snapshot.notes).toBe("One box came back");
    expect(snapshot.wording.notATaxInvoice).toBe("");
  });

  it("shows a price change with nothing back as one, for the amount", () => {
    const { snapshot } = buildCreditNoteSnapshot({
      invoice: invoiceSnapshot,
      invoiceNumber: "INV-0007",
      invoiceDate: "2026-10-10",
      issueDate: "2026-10-20",
      reason: "price",
      explanation: "Lower price agreed",
      items,
      lines: [{ index: 1, quantityMilli: 0, amountCents: 1000 }],
      priorGroups: [],
      locale: ZA_LOCALE,
    });
    expect(snapshot.lines[0]).toMatchObject({ name: "Sign", quantityMilli: 1000, unit: null, unitPriceCents: 1000, lineTotalCents: 1000 });
  });

  it("is a plain credit note for a business not registered for the tax", () => {
    const plain = { ...invoiceSnapshot, vat: { ...invoiceSnapshot.vat, registered: false, entry: null, rateBp: null } } as QuoteSnapshot;
    const { snapshot } = buildCreditNoteSnapshot({
      invoice: plain,
      invoiceNumber: "INV-0007",
      invoiceDate: "2026-10-10",
      issueDate: "2026-10-20",
      reason: "other",
      explanation: "x",
      items,
      lines: [{ index: 1, quantityMilli: 1000, amountCents: 5000 }],
      priorGroups: [],
      locale: ZA_LOCALE,
    });
    expect(snapshot.wording.title).toBe("Credit note");
    expect(snapshot.totals.vatCents).toBe(0);
    expect(snapshot.totals.grossCents).toBe(5000);
  });
});
