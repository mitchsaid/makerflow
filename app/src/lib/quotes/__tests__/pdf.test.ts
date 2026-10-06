import { describe, expect, it, vi } from "vitest";

// The renderer is server-only code; the guard import is for the bundler, not for tests.
vi.mock("server-only", () => ({}));

import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { parseQuote, type QuoteFormValues } from "../index";
import { renderQuotePdf } from "../pdf/render";
import { buildQuoteSnapshot } from "../snapshot";

const vats: Record<string, VatSettings> = {
  inclusive: { registered: true, entry: "inclusive", standardRateBp: 1500 },
  exclusive: { registered: true, entry: "exclusive", standardRateBp: 1500 },
  none: { registered: false },
};

function snapshot(vat: VatSettings, over: Partial<QuoteFormValues> = {}, name = "Wedding cake") {
  const values: QuoteFormValues = {
    customerId: "",
    issueDate: "2026-10-02",
    validUntil: "2026-10-16",
    neededBy: "2026-10-30",
    lines: [
      {
        key: "a",
        kind: "custom",
        productId: "",
        name,
        description: "Three tiers, vanilla",
        quantity: "1",
        unit: "",
        unitPrice: "800",
        discountKind: "percent",
        discountValue: "10",
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
  };
  const parsed = parseQuote(values, vat);
  if (!parsed.ok) throw new Error("should parse");
  return buildQuoteSnapshot({
    quote: parsed.quote,
    number: "QT-0001",
    version: 1,
    business: {
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
    },
    customer: null,
    countryCode: "ZA",
    currencyCode: "ZAR",
    vat,
    locale: ZA_LOCALE,
    bank: null,
  });
}

describe("the quote PDF", () => {
  it.each(Object.keys(vats))("renders a real PDF for %s VAT", async (mode) => {
    const pdf = await renderQuotePdf(snapshot(vats[mode]));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it("renders a draft preview and a long quote across pages", async () => {
    const lines = Array.from({ length: 70 }, (_, i): QuoteFormValues["lines"][number] => ({
      key: `l${i}`,
      kind: "custom",
      productId: "",
      name: `Item ${i + 1}`,
      description: "A description that is long enough to need some room on the page.",
      quantity: "2",
      unit: "",
      unitPrice: "19,99",
      discountKind: "none",
      discountValue: "",
    }));
    const short = await renderQuotePdf(snapshot(vats.inclusive), { draft: true });
    const long = await renderQuotePdf(snapshot(vats.inclusive, { lines }));
    expect(long.length).toBeGreaterThan(short.length);
    // Several pages: the page-tree count is stored in plain text.
    expect(long.toString("latin1")).toMatch(/\/Count [2-9]/);
  });

  it("does not fall over on accents, Zulu and Afrikaans letters, or emoji in names", async () => {
    const pdf = await renderQuotePdf(snapshot(vats.inclusive, {}, "Sjokolade koek, Zoë’s ḿeringue ŋ 🎂 Ndiyabulela"));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

import { drawable } from "../pdf/fonts";
import { forPdf } from "../pdf/render";

describe("text for the PDF font", () => {
  it("keeps the letters South African languages use, and drops what the font can't draw", () => {
    expect(drawable("Zoë’s ḿeringue, Ndiyabulela, Ngiyabonga ŋ")).toBe("Zoë’s ḿeringue, Ndiyabulela, Ngiyabonga ŋ");
    expect(drawable("🎂 Cake 🎂")).toBe("Cake");
    expect(drawable("Chocolate  ✨ cake")).toBe("Chocolate cake");
    expect(drawable("Line one\nLine two")).toBe("Line one\nLine two");
  });

  it("only touches what the person typed, never the locale's number style", () => {
    const s = snapshot(vats.inclusive, {}, "🎂 Cake");
    const cleaned = forPdf(s);
    expect(cleaned.lines[0].name).toBe("Cake");
    expect(cleaned.numberStyle).toEqual(s.numberStyle);
    expect(cleaned.numberStyle.groupSeparator).toBe(" ");
    expect(s.lines[0].name).toBe("🎂 Cake");
  });
});

describe("the quote's own wording on the document", () => {
  it("renders the title, description, units, how to pay, sign-off and terms, even when long", async () => {
    const long = "A long line of terms that goes on and on about how the order works. ".repeat(60);
    const withWording = await renderQuotePdf({
      ...snapshot(vats.inclusive),
      title: "Wedding cake for Sarah",
      description: "Thank you for asking about your wedding cake.",
      signOff: "Yours in sweetness",
      terms: long,
      paymentInstructions: "EFT to Sweet Co\nFNB 123456",
      lines: snapshot(vats.inclusive).lines.map((l) => ({ ...l, unit: "kg" })),
    });
    const plain = await renderQuotePdf(snapshot(vats.inclusive));
    expect(withWording.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(withWording.length).toBeGreaterThan(plain.length);
  });
});

describe("long and awkward text on the document", () => {
  it("copes with a wide quantity and a long unit, and with many short lines", async () => {
    const base = snapshot(vats.inclusive);
    const lines = Array.from({ length: 80 }, (_, i) => `Term ${i + 1}`).join("\n");
    const pdf = await renderQuotePdf({
      ...base,
      terms: lines,
      paymentInstructions: Array.from({ length: 20 }, (_, i) => `Pay ${i + 1}`).join("\n"),
      lines: base.lines.map((l) => ({ ...l, quantityMilli: 12_500_500, unit: "portions per tray" })),
    });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("policies on the document", () => {
  it("renders each policy under its title, with other terms after them, and an old version without any", async () => {
    const base = snapshot(vats.inclusive);
    const policies = Array.from({ length: 5 }, (_, i) => ({
      title: `Policy ${i + 1}`,
      body: "Some wording that explains the policy in plain words. ".repeat(12),
    }));
    const withPolicies = await renderQuotePdf({ ...base, policies, terms: "Other terms here." });
    const without = await renderQuotePdf({ ...base, policies: undefined });
    expect(withPolicies.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(withPolicies.length).toBeGreaterThan(without.length);
  });
});

describe("designs", () => {
  it("draws a version sent before designs existed, and one naming an unknown design, in the classic design", async () => {
    const old = { ...snapshot(vats.inclusive) } as Record<string, unknown>;
    delete old.design;
    const withoutDesign = await renderQuotePdf(old as unknown as ReturnType<typeof snapshot>);
    const unknown = await renderQuotePdf({ ...snapshot(vats.inclusive), design: "future" as never });
    const classic = await renderQuotePdf(snapshot(vats.inclusive));
    for (const pdf of [withoutDesign, unknown, classic]) {
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    }
    expect(Math.abs(withoutDesign.length - classic.length)).toBeLessThan(200);
  });
});

describe("bank details on the document", () => {
  it("renders a How to pay block with the bank lines and other ways to pay, and an old version without", async () => {
    const base = snapshot(vats.inclusive);
    const bankDetails = [
      { label: "Account holder", value: "Sweet Co" },
      { label: "Bank", value: "FNB 🎂" },
      { label: "Account number", value: "62123456789" },
      { label: "Reference", value: "QT-0001" },
    ];
    const both = await renderQuotePdf({ ...base, bankDetails, paymentInstructions: "SnapScan also works." });
    const onlyBank = await renderQuotePdf({ ...base, bankDetails });
    const without = await renderQuotePdf({ ...base, bankDetails: undefined });
    for (const pdf of [both, onlyBank, without]) expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(onlyBank.length).toBeGreaterThan(without.length);
    expect(both.length).toBeGreaterThan(onlyBank.length);
  });
});
