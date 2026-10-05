import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { parseLine, parseQuote, toDatabasePayload, type LineFormValues, type QuoteFormValues } from "../index";
import { addStarter, TERMS_STARTERS } from "../terms-starters";
import { quantityText } from "../units";

const NOT_REGISTERED: VatSettings = { registered: false };

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "k1",
  kind: "custom",
  productId: "",
  name: "Flour",
  description: "",
  quantity: "2",
  unit: "kg",
  unitPrice: "50",
  discountKind: "none",
  discountValue: "",
  ...over,
});

const quote = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-05",
  validUntil: "2026-10-19",
  neededBy: "",
  lines: [line()],
  fulfilment: "none",
  deliveryFee: "",
  discountKind: "none",
  discountValue: "",
  notes: "",
  title: "",
  description: "",
  signOff: "",
  terms: "",
  paymentInstructions: "",
  policies: [],
  ...over,
});

describe("units", () => {
  it("keeps a unit on a line, and treats blank as a plain count", () => {
    const withUnit = parseLine(line());
    expect(withUnit.ok && withUnit.line.unit).toBe("kg");
    const plain = parseLine(line({ unit: "   " }));
    expect(plain.ok && plain.line.unit).toBeNull();
  });

  it("tidies spaces and refuses a unit that is too long, saying how to fix it", () => {
    const tidy = parseLine(line({ unit: "  per   dozen " }));
    expect(tidy.ok && tidy.line.unit).toBe("per dozen");
    const long = parseLine(line({ unit: "x".repeat(21) }));
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.unit).toMatch(/up to 20 characters/);
  });

  it("can write the quantity and unit with a plain space, so a narrow column can wrap it", () => {
    expect(quantityText(2000, "kg", ZA_LOCALE.numberStyle, " ")).toBe("2 kg");
  });

  it("writes the quantity with its unit, keeping them together", () => {
    expect(quantityText(2000, "kg", ZA_LOCALE.numberStyle)).toBe("2 kg");
    expect(quantityText(500, "kg", ZA_LOCALE.numberStyle)).toBe("0,5 kg");
    expect(quantityText(12_000, null, ZA_LOCALE.numberStyle)).toBe("12");
  });

  it("does not change the money: a unit is a label", () => {
    const a = parseQuote(quote(), NOT_REGISTERED);
    const b = parseQuote(quote({ lines: [line({ unit: "" })] }), NOT_REGISTERED);
    expect(a.ok && b.ok && a.quote.totals.grossCents).toBe(b.ok && b.quote.totals.grossCents);
    expect(a.ok && a.quote.totals.grossCents).toBe(10_000);
  });
});

describe("quote wording", () => {
  it("keeps the title, description, sign-off, terms and how to pay, and stores them in the payload", () => {
    const r = parseQuote(
      quote({
        title: "  Wedding cake  for Sarah ",
        description: "Thank you for asking.\n\n\n\nThree tiers.",
        signOff: "Yours in sweetness",
        terms: "Deposit first.",
        paymentInstructions: "EFT to 123\nRef: Sarah",
      }),
      NOT_REGISTERED,
    );
    if (!r.ok) throw new Error("should parse");
    expect(r.quote).toMatchObject({
      title: "Wedding cake for Sarah",
      description: "Thank you for asking.\n\nThree tiers.",
      signOff: "Yours in sweetness",
      terms: "Deposit first.",
      paymentInstructions: "EFT to 123\nRef: Sarah",
    });
    const payload = toDatabasePayload(r.quote, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.quote).toMatchObject({
      title: "Wedding cake for Sarah",
      sign_off: "Yours in sweetness",
      terms: "Deposit first.",
      payment_instructions: "EFT to 123\nRef: Sarah",
    });
    expect(payload.lines[0].unit).toBe("kg");
  });

  it("is all optional: empty means nothing is stored", () => {
    const r = parseQuote(quote(), NOT_REGISTERED);
    if (!r.ok) throw new Error("should parse");
    expect([r.quote.title, r.quote.description, r.quote.signOff, r.quote.terms, r.quote.paymentInstructions]).toEqual([
      null, null, null, null, null,
    ]);
  });

  it("limits the lines too, because a page only holds so many", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n");
    const r = parseQuote(
      quote({ description: many(31), terms: many(81), paymentInstructions: many(21), notes: many(61) }),
      NOT_REGISTERED,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.fields.description).toMatch(/up to 30 lines/);
      expect(r.errors.fields.terms).toMatch(/up to 80 lines/);
      expect(r.errors.fields.paymentInstructions).toMatch(/up to 20 lines/);
      expect(r.errors.fields.notes).toMatch(/up to 60 lines/);
    }
    const fine = parseQuote(
      quote({ description: many(30), terms: many(80), paymentInstructions: many(20), notes: many(60) }),
      NOT_REGISTERED,
    );
    expect(fine.ok).toBe(true);
  });

  it("says how to fix each over-long piece, by field", () => {
    const r = parseQuote(
      quote({
        title: "t".repeat(121),
        description: "d".repeat(2001),
        signOff: "s".repeat(201),
        terms: "x".repeat(4001),
        paymentInstructions: "p".repeat(1001),
      }),
      NOT_REGISTERED,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const field of ["title", "description", "signOff", "terms", "paymentInstructions"] as const) {
        expect(r.errors.fields[field], field).toMatch(/can be up to/);
      }
    }
  });
});

describe("terms starters", () => {
  it("adds a starting line on its own line, once", () => {
    const text = TERMS_STARTERS[1].text;
    expect(addStarter("", text)).toBe(text);
    expect(addStarter("Existing terms.\n", text)).toBe(`Existing terms.\n${text}`);
    expect(addStarter(text, text)).toBe(text);
  });
});
