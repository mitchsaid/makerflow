import { describe, expect, it } from "vitest";
import type { Customer } from "../../customers";
import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { parseQuote, type QuoteFormValues } from "../index";
import { sendProblems } from "../send-checks";
import { buildQuoteSnapshot } from "../snapshot";

const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };
const EXCLUSIVE: VatSettings = { registered: true, entry: "exclusive", standardRateBp: 1500 };
const NOT_REGISTERED: VatSettings = { registered: false };

const form = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-02",
  validUntil: "2026-10-16",
  neededBy: "",
  lines: [
    {
      key: "a",
      kind: "custom",
      productId: "",
      name: "Wedding cake",
      description: "Three tiers",
      quantity: "1",
      unit: "",
      unitPrice: "800",
      discountKind: "percent",
      discountValue: "10",
    },
    {
      key: "b",
      kind: "custom",
      productId: "",
      name: "Cupcakes",
      description: "",
      quantity: "12",
      unit: "",
      unitPrice: "15",
      discountKind: "none",
      discountValue: "",
    },
  ],
  fulfilment: "delivery",
  deliveryFee: "50",
  discountKind: "fixed",
  discountValue: "20",
  notes: "Thank you!",
    title: "",
    description: "",
    signOff: "",
    terms: "",
    paymentInstructions: "",
    showBankDetails: true,
    policies: [],
  ...over,
});

const customer: Customer = {
  id: "c1",
  organisationId: "o1",
  name: "Thandi Nkosi",
  kind: "business",
  contactPerson: "Thandi",
  email: "thandi@example.test",
  phone: "082 123 4567",
  addressLine1: "12 Main Road",
  addressLine2: null,
  city: "Soweto",
  region: "Gauteng",
  postalCode: "1804",
  deliveryAddress: null,
  vatNumber: "4123456789",
  companyRegistrationNumber: null,
  notes: "private note that must never reach a document",
  archived: false,
};

const business = {
  name: "Sweet Co",
  phone: "011 555 0101",
  email: null,
  addressLine1: "1 Baker Street",
  addressLine2: "Unit 4",
  city: "Johannesburg",
  region: "Gauteng",
  postalCode: "2196",
  vatRegistered: true,
  vatNumber: "4987654321",
};

function snapshotFor(vat: VatSettings, withCustomer = true) {
  const parsed = parseQuote(form(), vat);
  if (!parsed.ok) throw new Error("test quote should parse");
  return buildQuoteSnapshot({
    quote: parsed.quote,
    number: "QT-0042",
    version: 2,
    business: { ...business, vatRegistered: vat.registered },
    customer: withCustomer ? customer : null,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat,
    locale: ZA_LOCALE,
    bank: null,
  });
}

describe("the quote snapshot", () => {
  it("carries the number, version, dates and the wording the locale pack gave", () => {
    const s = snapshotFor(INCLUSIVE);
    expect(s.number).toBe("QT-0042");
    expect(s.version).toBe(2);
    expect(s.issueDate).toBe("2026-10-02");
    expect(s.validUntil).toBe("2026-10-16");
    expect(s.wording.title).toBe("Quotation");
    expect(s.wording.notATaxInvoice).toBe("This quotation is not a tax invoice.");
    expect(s.wording.inclusiveStatement).toBe("All prices include VAT at 15%.");
    expect(s.countryCode).toBe("ZA");
    expect(s.numberStyle).toEqual(ZA_LOCALE.numberStyle);
  });

  it("freezes the amounts exactly as the money module worked them out", () => {
    const parsed = parseQuote(form(), INCLUSIVE);
    if (!parsed.ok) throw new Error("should parse");
    const s = snapshotFor(INCLUSIVE);
    // 800 less 10% = 720.00; 12 x 15 = 180.00; delivery 50.00
    expect(s.lines.map((l) => l.lineTotalCents)).toEqual([72_000, 18_000, 5_000]);
    expect(s.lines.map((l) => l.name)).toEqual(["Wedding cake", "Cupcakes", "Delivery"]);
    expect(s.lines[0].discount).toEqual({ kind: "percent", basisPoints: 1000 });
    expect(s.quoteDiscount).toEqual({ kind: "fixed", cents: 2_000, amountCents: 2_000 });
    expect(s.totals.grossCents).toBe(parsed.quote.totals.grossCents);
    // 720 + 180 + 50 = 950.00, less the R20.00 quote discount
    expect(s.totals.grossCents).toBe(93_000);
    expect(s.totals.vatCents).toBe(parsed.quote.totals.vatCents);
  });

  it("states a VAT-registered business's number and the entry mode, and leaves them out otherwise", () => {
    expect(snapshotFor(INCLUSIVE).business.vatNumber).toBe("4987654321");
    expect(snapshotFor(INCLUSIVE).vat).toMatchObject({ registered: true, entry: "inclusive", rateBp: 1500, taxName: "VAT" });
    expect(snapshotFor(EXCLUSIVE).wording.inclusiveStatement).toBeNull();
    const plain = snapshotFor(NOT_REGISTERED);
    expect(plain.business.vatNumber).toBeNull();
    expect(plain.vat).toMatchObject({ registered: false, entry: null, rateBp: null });
    expect(plain.wording.inclusiveStatement).toBeNull();
  });

  it("writes addresses as the country does and copies the customer's details, but not private notes", () => {
    const s = snapshotFor(INCLUSIVE);
    expect(s.business.addressLines).toEqual(["1 Baker Street", "Unit 4", "Johannesburg", "Gauteng 2196"]);
    expect(s.customer?.addressLines).toEqual(["12 Main Road", "Soweto", "Gauteng 1804"]);
    expect(s.customer).toMatchObject({ name: "Thandi Nkosi", vatNumber: "4123456789", phone: "082 123 4567" });
    expect(JSON.stringify(s)).not.toContain("private note");
  });

  it("records the design it was drawn with, so a later design never changes it", () => {
    expect(snapshotFor(INCLUSIVE).design).toBe("classic");
  });

  it("carries the units and the quote's own wording, so a sent version keeps them", () => {
    const values = form({
      title: "Wedding cake for Sarah",
      description: "Thank you for asking.",
      signOff: "Yours in sweetness",
      terms: "Deposit first.",
      paymentInstructions: "EFT to 123",
      lines: [{ ...form().lines[0], unit: "tier" }],
    });
    const parsed = parseQuote(values, INCLUSIVE);
    if (!parsed.ok) throw new Error("should parse");
    const s = buildQuoteSnapshot({
      quote: parsed.quote,
      number: "QT-0001",
      version: 1,
      business,
      customer,
      countryCode: "ZA",
      currencyCode: "ZAR",
      vat: INCLUSIVE,
      locale: ZA_LOCALE,
      bank: null,
    });
    expect(s).toMatchObject({
      title: "Wedding cake for Sarah",
      description: "Thank you for asking.",
      signOff: "Yours in sweetness",
      terms: "Deposit first.",
      paymentInstructions: "EFT to 123",
    });
    expect(s.lines[0].unit).toBe("tier");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("carries the policies the quote included, each with its own title and wording", () => {
    const parsed = parseQuote(
      form({
        policies: [
          { key: "p-0", policyId: "", title: "If you cancel", body: "You pay the deposit." },
          { key: "p-1", policyId: "", title: "Handmade", body: "Items vary a little." },
        ],
      }),
      INCLUSIVE,
    );
    if (!parsed.ok) throw new Error("should parse");
    const s = buildQuoteSnapshot({
      quote: parsed.quote,
      number: "QT-0001",
      version: 1,
      business,
      customer,
      countryCode: "ZA",
      currencyCode: "ZAR",
      vat: INCLUSIVE,
      locale: ZA_LOCALE,
      bank: null,
    });
    expect(s.policies).toEqual([
      { title: "If you cancel", body: "You pay the deposit." },
      { title: "Handmade", body: "Items vary a little." },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("allows a draft preview without a customer", () => {
    expect(snapshotFor(INCLUSIVE, false).customer).toBeNull();
  });

  it("is plain JSON, so it survives being stored and read back unchanged", () => {
    const s = snapshotFor(EXCLUSIVE);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("what stops a quote being sent", () => {
  const profile = {
    countryCode: "ZA",
    currencyCode: "ZAR",
    phone: "011 555 0101",
    email: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    region: null,
    postalCode: null,
    vatRegistered: false,
    vatNumber: null,
    pricesIncludeVat: true,
  };
  const ok = {
    hasCustomer: true,
    itemCount: 1,
    validUntil: "2026-10-16",
    today: "2026-10-03",
    profile,
    locale: ZA_LOCALE,
    bank: null,
  };

  it("lets a complete quote through", () => {
    expect(sendProblems(ok)).toEqual([]);
  });

  it("lists every problem, in plain words", () => {
    const problems = sendProblems({
      ...ok,
      hasCustomer: false,
      itemCount: 0,
      validUntil: "2026-10-01",
      profile: { ...profile, phone: null },
    });
    expect(problems.map((p) => p.code)).toEqual(["customer", "items", "validity", "contact"]);
    for (const p of problems) expect(p.message).toMatch(/\.$/);
  });

  it("accepts an email instead of a phone number, and a quote valid until today", () => {
    expect(sendProblems({ ...ok, profile: { ...profile, phone: null, email: "a@b.test" } })).toEqual([]);
    expect(sendProblems({ ...ok, validUntil: "2026-10-03" })).toEqual([]);
  });
});

describe("bank details on the document", () => {
  const bank = {
    countryCode: "ZA",
    details: { holder: "Sweet Co", bank: "FNB", accountType: "Cheque or current", accountNumber: "62123456789", branchCode: "250655" },
    useReference: true,
    updatedAt: "2026-10-05T08:00:00Z",
  };
  const snapshotWith = (over: Partial<QuoteFormValues>, saved: typeof bank | null) => {
    const parsed = parseQuote(form(over), INCLUSIVE);
    if (!parsed.ok) throw new Error("should parse");
    return buildQuoteSnapshot({
      quote: parsed.quote,
      number: "QT-0042",
      version: 1,
      business,
      customer,
      countryCode: "ZA",
      currencyCode: "ZAR",
      vat: INCLUSIVE,
      locale: ZA_LOCALE,
      bank: saved,
    });
  };

  it("freezes the saved details as lines, with the quote number as the reference", () => {
    const s = snapshotWith({}, bank);
    expect(s.bankDetails).toEqual([
      { label: "Account holder", value: "Sweet Co" },
      { label: "Bank name", value: "FNB" },
      { label: "Account type", value: "Cheque or current" },
      { label: "Account number", value: "62123456789" },
      { label: "Branch code", value: "250655" },
      { label: "Reference", value: "QT-0042" },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("leaves the reference off when the business did not ask for it", () => {
    const s = snapshotWith({}, { ...bank, useReference: false });
    expect(s.bankDetails?.some((l) => l.label === "Reference")).toBe(false);
  });

  it("prints nothing when the quote switches them off, or none are saved", () => {
    expect(snapshotWith({ showBankDetails: false }, bank).bankDetails).toEqual([]);
    expect(snapshotWith({}, null).bankDetails).toEqual([]);
  });
});
