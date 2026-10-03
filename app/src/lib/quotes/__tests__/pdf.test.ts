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
