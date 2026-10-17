import { describe, expect, it, vi } from "vitest";

// The renderer is server-only code; the guard import is for the bundler, not for tests.
vi.mock("server-only", () => ({}));

import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import type { BankDetails } from "../../bank";
import { parseQuote, type QuoteFormValues } from "../../quotes";
import { buildQuoteSnapshot, type BusinessFacts } from "../../quotes/snapshot";
import { renderQuotePdf } from "../../quotes/pdf/render";
import {
  defaultInvoiceForm,
  invoiceProblems,
  invoiceStatus,
  parseInvoiceForm,
  visibleInvoices,
  type InvoiceSummary,
} from "../index";
import { buildInvoiceSnapshot } from "../snapshot";

const VAT: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const NO_VAT: VatSettings = { registered: false };

const business = (vat: VatSettings, over: Partial<BusinessFacts> = {}): BusinessFacts => ({
  name: "Sweet Co",
  phone: "011 555 0101",
  email: "hi@sweet.test",
  addressLine1: "1 Baker Street",
  addressLine2: null,
  city: "Johannesburg",
  region: "Gauteng",
  postalCode: "2196",
  vatRegistered: vat.registered,
  vatNumber: vat.registered ? "4987654321" : null,
  logoImageId: null,
  ...over,
});

const bank: BankDetails = {
  countryCode: "ZA",
  details: { holder: "Sweet Co", bank: "FNB", accountType: "Cheque or current", accountNumber: "62123456789", branchCode: "250655" },
  useReference: true,
  updatedAt: "2026-10-05T08:00:00Z",
};

function quoteSnapshot(vat: VatSettings, unitPrice = "800", showBankDetails = true) {
  const values: QuoteFormValues = {
    customerId: "",
    issueDate: "2026-10-02",
    validUntil: "2026-10-16",
    neededBy: "2026-10-30",
    lines: [{ key: "a", kind: "custom", productId: "", name: "Wedding cake", description: "", quantity: "1", unit: "", unitPrice, discountKind: "none", discountValue: "" }],
    fulfilment: "collection",
    deliveryFee: "",
    deliveryAddress: "",
    discountKind: "none",
    discountValue: "",
    notes: "Quote notes",
    title: "",
    description: "Thank you for your interest.",
    signOff: "Thanks for the chance to quote.",
    paymentInstructions: "",
    showBankDetails,
    showPhotos: true,
    depositKind: "percent",
    depositValue: "50",
    balanceDue: "handover",
    balanceDueDate: "",
    balanceDueText: "",
    policies: [],
  };
  const parsed = parseQuote(values, vat);
  if (!parsed.ok) throw new Error("should parse: " + JSON.stringify(parsed.errors));
  return buildQuoteSnapshot({
    quote: parsed.quote,
    number: "QT-0007",
    version: 2,
    business: business(vat),
    customer: null,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat,
    locale: ZA_LOCALE,
    bank,
  });
}

function invoiceOf(vat: VatSettings, over: { note?: string | null; showBankDetails?: boolean; bank?: BankDetails | null } = {}) {
  const version = quoteSnapshot(vat, "800", over.showBankDetails ?? true);
  return {
    version,
    ...buildInvoiceSnapshot({
      version,
      issueDate: "2026-10-20",
      dueDate: "2026-11-03",
      note: over.note ?? null,
      locale: ZA_LOCALE,
      business: business(vat, { addressLine1: "9 New Road" }),
      customer: null,
      bank: over.bank === undefined ? bank : over.bank,
    }),
  };
}

describe("the invoice's document", () => {
  it("copies the agreed lines and totals untouched, and the version number the database checks", () => {
    const { version, snapshot } = invoiceOf(VAT);
    expect(snapshot.lines).toEqual(version.lines);
    expect(snapshot.totals).toEqual(version.totals);
    expect(snapshot.version).toBe(2);
    expect(snapshot.issueDate).toBe("2026-10-20");
    expect(snapshot.invoice).toMatchObject({ dueDate: "2026-11-03", quoteNumber: "QT-0007", billedToLabel: "Billed to", dueLabel: "Due date" });
  });

  it("has no number yet (the database gives it) and drops what belongs to the quote", () => {
    const { snapshot } = invoiceOf(VAT);
    expect(snapshot.number).toBe("");
    expect(snapshot.description).toBeNull();
    expect(snapshot.signOff).toBeNull();
    expect(snapshot.neededBy).toBeNull();
    expect(snapshot.deposit).toBeNull();
    expect(snapshot.wording.notATaxInvoice).toBe("");
  });

  it("is a tax invoice only for a business registered for the tax", () => {
    expect(invoiceOf(VAT).snapshot.wording.title).toBe("Tax invoice");
    expect(invoiceOf(NO_VAT).snapshot.wording.title).toBe("Invoice");
  });

  it("shows the business as it is today, not as it was when the quote was sent", () => {
    const { version, snapshot } = invoiceOf(VAT);
    expect(version.business.addressLines.join(" ")).toContain("1 Baker Street");
    expect(snapshot.business.addressLines.join(" ")).toContain("9 New Road");
  });

  it("uses the maker's note in place of the quote's notes, and keeps the quote's when there is none", () => {
    expect(invoiceOf(VAT, { note: "Thanks, see you soon" }).snapshot.notes).toBe("Thanks, see you soon");
    expect(invoiceOf(VAT).snapshot.notes).toBe("Quote notes");
  });

  it("leaves the payment reference to the database, and says what to call it", () => {
    const { snapshot, referenceLabel } = invoiceOf(VAT);
    expect(snapshot.bankDetails?.map((l) => l.label)).not.toContain("Reference");
    expect(snapshot.bankDetails?.length).toBeGreaterThan(0);
    expect(referenceLabel).toBe(ZA_LOCALE.payment.referenceLabel);
    expect(invoiceOf(VAT, { bank: { ...bank, useReference: false } }).referenceLabel).toBeNull();
  });

  it("prints no bank details when the quote did not, or the business has none now", () => {
    expect(invoiceOf(VAT, { showBankDetails: false }).snapshot.bankDetails).toEqual([]);
    const gone = invoiceOf(VAT, { bank: null });
    expect(gone.snapshot.bankDetails).toEqual([]);
    expect(gone.referenceLabel).toBeNull();
  });

  it("draws as a PDF", async () => {
    const { snapshot } = invoiceOf(VAT);
    const pdf = await renderQuotePdf({ ...snapshot, number: "INV-0001" });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
    const texts: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      texts.push(...content.items.map((item) => ("str" in item ? item.str : "")));
    }
    // Labels may be drawn in capitals.
    const text = texts.join(" ").toLowerCase();
    expect(text).toContain("tax invoice");
    expect(text).toContain("inv-0001");
    expect(text).toContain("billed to");
    expect(text).toContain("due date");
    expect(text).toContain("qt-0007");
    expect(text).not.toContain("not a tax invoice");
    expect(text).not.toContain("prepared for");
    expect(text).not.toContain("valid until");
    expect(text).not.toContain("version 2");
  }, 30000);
});

describe("the invoice form", () => {
  it("starts today, due the usual days later", () => {
    expect(defaultInvoiceForm("2026-10-20", 14)).toEqual({ issueDate: "2026-10-20", dueDate: "2026-11-03", note: "" });
    expect(defaultInvoiceForm("2026-12-25", 14).dueDate).toBe("2027-01-08");
  });

  it("accepts the same day and a note, and trims", () => {
    expect(parseInvoiceForm({ issueDate: "2026-10-20", dueDate: "2026-10-20", note: "  Thanks " })).toEqual({
      ok: true,
      issueDate: "2026-10-20",
      dueDate: "2026-10-20",
      note: "Thanks",
    });
    expect(parseInvoiceForm({ issueDate: "2026-10-20", dueDate: "2026-11-03", note: "  " })).toMatchObject({ ok: true, note: null });
  });

  it("says what to fix", () => {
    const bad = parseInvoiceForm({ issueDate: "", dueDate: "nope", note: "x".repeat(2001) });
    expect(bad).toMatchObject({ ok: false, errors: { issueDate: expect.any(String), dueDate: expect.any(String), note: expect.any(String) } });
    expect(parseInvoiceForm({ issueDate: "2026-10-20", dueDate: "2026-10-19", note: "" })).toMatchObject({
      ok: false,
      errors: { dueDate: "The due day can't be before the invoice date." },
    });
  });
});

describe("what an invoice needs before it is issued", () => {
  const full = { phone: "011", email: null, addressLine1: "1 Main", city: "Paarl" };
  const customer = { addressLines: ["2 Side St", "Paarl"] };

  it("needs the business's address, but not its phone or email", () => {
    expect(invoiceProblems({ business: full, customer, grossCents: 1000, taxRegistered: true, locale: ZA_LOCALE })).toEqual([]);
    const noAddress = invoiceProblems({ business: { ...full, addressLine1: null, city: null }, customer, grossCents: 1000, taxRegistered: false, locale: ZA_LOCALE });
    expect(noAddress.map((p) => p.code)).toEqual(["business"]);
    expect(noAddress[0].message).toMatch(/business address/i);
  });

  it("needs the customer's address on a tax invoice of R5 000 or more, and not below", () => {
    const check = (grossCents: number, taxRegistered: boolean, c: { addressLines: string[] } | null) =>
      invoiceProblems({ business: full, customer: c, grossCents, taxRegistered, locale: ZA_LOCALE }).map((p) => p.code);
    expect(check(499_999, true, { addressLines: [] })).toEqual([]);
    expect(check(500_000, true, { addressLines: [] })).toEqual(["customer-address"]);
    expect(check(500_000, true, null)).toEqual(["customer-address"]);
    expect(check(500_000, true, customer)).toEqual([]);
    // Not registered: it is not a tax invoice, so the threshold does not apply.
    expect(check(900_000, false, { addressLines: [] })).toEqual([]);
  });
});

describe("the status of an invoice is worked out", () => {
  const base = { grossCents: 100_000, dueDate: "2026-11-03" };
  it("is unpaid up to and on the due day, overdue after it", () => {
    expect(invoiceStatus({ ...base, paidCents: 0, today: "2026-10-20" })).toBe("unpaid");
    expect(invoiceStatus({ ...base, paidCents: 0, today: "2026-11-03" })).toBe("unpaid");
    expect(invoiceStatus({ ...base, paidCents: 0, today: "2026-11-04" })).toBe("overdue");
  });
  it("is part paid while something is owing and the day has not passed, paid when nothing is", () => {
    expect(invoiceStatus({ ...base, paidCents: 40_000, today: "2026-10-20" })).toBe("part_paid");
    expect(invoiceStatus({ ...base, paidCents: 40_000, today: "2026-12-01" })).toBe("overdue");
    expect(invoiceStatus({ ...base, paidCents: 100_000, today: "2026-12-01" })).toBe("paid");
    expect(invoiceStatus({ ...base, paidCents: 120_000, today: "2026-12-01" })).toBe("paid");
    expect(invoiceStatus({ grossCents: 0, paidCents: 0, dueDate: "2026-11-03", today: "2026-12-01" })).toBe("paid");
  });
});

describe("the invoices list", () => {
  const inv = (over: Partial<InvoiceSummary>): InvoiceSummary => ({
    id: "i",
    organisationId: "o",
    number: "INV-0001",
    quoteId: "q",
    customerName: "Thandi",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    grossCents: 1000,
    currencyCode: "ZAR",
    ...over,
  });
  const list = [
    inv({ id: "a", number: "INV-0001", customerName: "Thandi", issueDate: "2026-10-01", dueDate: "2026-10-15" }),
    inv({ id: "b", number: "INV-0002", customerName: "Pieter", issueDate: "2026-10-18", dueDate: "2026-11-01" }),
    inv({ id: "c", number: "INV-0003", customerName: "Thandi", issueDate: "2026-10-18", dueDate: "2026-11-01" }),
  ];

  it("lists newest first, the later number first on the same day", () => {
    expect(visibleInvoices(list, "all", "", "2026-10-20").map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
  it("filters by what is owing and overdue, and searches by number or customer", () => {
    expect(visibleInvoices(list, "overdue", "", "2026-10-20").map((i) => i.id)).toEqual(["a"]);
    expect(visibleInvoices(list, "unpaid", "", "2026-10-20")).toHaveLength(3);
    expect(visibleInvoices(list, "paid", "", "2026-10-20")).toHaveLength(0);
    expect(visibleInvoices(list, "paid", "", "2026-10-20", (i) => (i.id === "b" ? i.grossCents : 0)).map((i) => i.id)).toEqual(["b"]);
    expect(visibleInvoices(list, "all", " pieter ", "2026-10-20").map((i) => i.id)).toEqual(["b"]);
    expect(visibleInvoices(list, "all", "0003", "2026-10-20").map((i) => i.id)).toEqual(["c"]);
  });
});
