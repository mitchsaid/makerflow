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
  deliveryAddress: "",
  discountKind: "fixed",
  discountValue: "20",
  notes: "Thank you!",
    title: "",
    description: "",
    signOff: "",
    paymentInstructions: "",
    showBankDetails: true, showPhotos: true,
    depositKind: "none",
    depositValue: "",
    balanceDue: "handover",
    balanceDueDate: "",
    balanceDueText: "",
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
  deliverySameAsMain: true,
  deliveryAddressLine1: null,
  deliveryAddressLine2: null,
  deliveryCity: null,
  deliveryRegion: null,
  deliveryPostalCode: null,
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

  it("records the finished theme it was drawn with, so a later change to a theme never changes it", () => {
    expect(snapshotFor(INCLUSIVE).theme?.name).toBe("Classic");
  });

  it("carries the units and the quote's own wording, so a sent version keeps them", () => {
    const values = form({
      title: "Wedding cake for Sarah",
      description: "Thank you for asking.",
      signOff: "Yours in sweetness",
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
      paymentInstructions: "EFT to 123",
    });
    // The old Terms box is gone: new versions carry their terms as terms, under the frozen heading.
    expect(s).not.toHaveProperty("terms");
    expect(s.wording.termsHeading).toBe("Terms");
    expect(s.lines[0].unit).toBe("tier");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("carries the terms the quote included, each with its title (or none) and wording", () => {
    const parsed = parseQuote(
      form({
        policies: [
          { key: "p-0", policyId: "", title: "If you cancel", body: "You pay the deposit." },
          { key: "p-1", policyId: "", title: "Handmade", body: "Items vary a little." },
          { key: "p-2", policyId: "", title: "", body: "Please allow 2 weeks." },
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
      { title: null, body: "Please allow 2 weeks." },
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
  const ok = {
    hasCustomer: true,
    itemCount: 1,
    validUntil: "2026-10-16",
    today: "2026-10-03",
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
    });
    expect(problems.map((p) => p.code)).toEqual(["customer", "items", "validity"]);
    for (const p of problems) expect(p.message).toMatch(/\.$/);
  });

  it("accepts a quote valid until today, and does not ask for a phone number or email (marking as sent is a record)", () => {
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

describe("the delivery address in the snapshot", () => {
  const snap = (over: Partial<QuoteFormValues>) => {
    const parsed = parseQuote(form(over), INCLUSIVE);
    if (!parsed.ok) throw new Error("should parse");
    return buildQuoteSnapshot({
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
  };

  it("is frozen on a delivery quote", () => {
    expect(snap({ fulfilment: "delivery", deliveryAddress: "22 Jacaranda Avenue\nParkhurst" }).deliveryAddress).toBe(
      "22 Jacaranda Avenue\nParkhurst",
    );
  });

  it("is not printed when the quote is a collection or undecided, or has no address", () => {
    expect(snap({ fulfilment: "collection", deliveryAddress: "22 Jacaranda Avenue" }).deliveryAddress).toBeNull();
    expect(snap({ fulfilment: "none", deliveryAddress: "22 Jacaranda Avenue" }).deliveryAddress).toBeNull();
    expect(snap({ fulfilment: "delivery", deliveryAddress: "" }).deliveryAddress).toBeNull();
  });
});

describe("pictures in the snapshot", () => {
  const productId = "22222222-2222-4222-8222-222222222222";
  const line = (over: Partial<QuoteFormValues["lines"][number]> = {}): QuoteFormValues["lines"][number] => ({
    key: "a",
    kind: "product",
    productId,
    name: "Cake",
    description: "",
    quantity: "1",
    unit: "",
    unitPrice: "100",
    discountKind: "none",
    discountValue: "",
    ...over,
  });
  const snap = (over: Partial<QuoteFormValues>, businessOver: Record<string, unknown> = {}) => {
    const parsed = parseQuote(
      form({ lines: [line(), line({ key: "b", kind: "custom", productId: "", name: "One-off" })], fulfilment: "none", ...over }),
      INCLUSIVE,
    );
    if (!parsed.ok) throw new Error("should parse");
    return buildQuoteSnapshot({
      quote: parsed.quote,
      number: "QT-0001",
      version: 1,
      business: { ...business, ...businessOver },
      customer,
      countryCode: "ZA",
      currencyCode: "ZAR",
      vat: INCLUSIVE,
      locale: ZA_LOCALE,
      bank: null,
      productPhotos: new Map([[productId, "photo-1"]]),
    });
  };

  it("freezes a product's photo on its line, and gives a one-off item none", () => {
    const s = snap({});
    expect(s.lines.map((l) => l.photoImageId)).toEqual(["photo-1", null]);
  });

  it("carries the product's id on its line (so a job can take its steps), and none on a one-off item", () => {
    const s = snap({});
    expect(s.lines.map((l) => l.productId)).toEqual([expect.stringMatching(/^[0-9a-f-]{36}$/), undefined]);
    expect("productId" in s.lines[1]).toBe(false);
  });

  it("carries the ids of what was chosen on a product line (so a job can take the steps that depend on them), and none otherwise", () => {
    const variationId = "44444444-4444-4444-8444-444444444444";
    const valueId = "66666666-6666-4666-8666-666666666666";
    const s = snap({
      lines: [
        line({
          variationId,
          variationLabel: "Size",
          variationName: "Large",
          options: [{ groupId: "55555555-5555-4555-8555-555555555555", group: "Flavour", kind: "one", valueId, value: "Vanilla", text: "", amountCents: 0 }],
        }),
        line({ key: "plain" }),
        line({ key: "b", kind: "custom", productId: "", name: "One-off" }),
      ],
    });
    expect(s.lines[0].chosenIds).toEqual([variationId, valueId]);
    expect("chosenIds" in s.lines[1]).toBe(false);
    expect("chosenIds" in s.lines[2]).toBe(false);
  });

  it("keeps the quantity price on an item only when the quote shows them", () => {
    const priced = line({
      quantity: "12",
      unitPrice: "90",
      listPrice: "100",
      quantityPriceText: "10 or more: 10% off",
      variationId: "44444444-4444-4444-8444-444444444444",
      variationLabel: "Size",
      variationName: "Large",
      options: [{ groupId: "55555555-5555-4555-8555-555555555555", group: "Flavour", kind: "one", valueId: "66666666-6666-4666-8666-666666666666", value: "Vanilla", text: "", amountCents: 500 }],
    });
    const off = snap({ lines: [priced, line({ key: "plain" })] });
    expect("quantityPrice" in off.lines[0]).toBe(false);
    const on = snap({ lines: [priced, line({ key: "plain" })], showQuantityPrices: true });
    // The item's own 100,00 before (the document adds the 5,00 the choice adds to each item when it folds extras in).
    expect(on.lines[0].quantityPrice).toEqual({ listPriceCents: 10_000, text: "10 or more: 10% off" });
    expect(on.lines[0].unitPriceCents).toBe(9_500);
    expect("quantityPrice" in on.lines[1]).toBe(false);
  });

  it("leaves photos out when the quote has them switched off", () => {
    expect(snap({ showPhotos: false }).lines.map((l) => l.photoImageId)).toEqual([null, null]);
  });

  it("shows the picture of the chosen variation or choice on the line, else the product's photo", () => {
    const VAR = "33333333-3333-4333-8333-333333333333";
    const CHOICE = "44444444-4444-4444-8444-444444444444";
    const build = (over: Partial<QuoteFormValues["lines"][number]>, choicePhotos: Map<string, string>) => {
      const parsed = parseQuote(form({ lines: [line(over)], fulfilment: "none" }), INCLUSIVE);
      if (!parsed.ok) throw new Error("should parse");
      return buildQuoteSnapshot({
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
        productPhotos: new Map([[productId, "photo-1"]]),
        choicePhotos,
      }).lines[0].photoImageId;
    };
    const withVariation = { variationId: VAR, variationLabel: "Size", variationName: "Large" };
    const withChoice = { options: [{ groupId: "55555555-5555-4555-8555-555555555555", group: "Flavour", kind: "one" as const, valueId: CHOICE, value: "Vanilla", text: "", amountCents: 0 }] };
    // The variation's picture wins, then the choice's, then the product's.
    expect(build({ ...withVariation, ...withChoice }, new Map([[VAR, "var-img"], [CHOICE, "choice-img"]]))).toBe("var-img");
    expect(build({ ...withVariation, ...withChoice }, new Map([[CHOICE, "choice-img"]]))).toBe("choice-img");
    expect(build({ ...withVariation, ...withChoice }, new Map())).toBe("photo-1");
    expect(build({}, new Map([[VAR, "var-img"]]))).toBe("photo-1");
  });

  it("freezes the logo, or none", () => {
    expect(snap({}, { logoImageId: "logo-1" }).logoImageId).toBe("logo-1");
    expect(snap({}).logoImageId).toBeNull();
  });
});
