import { describe, expect, it, vi } from "vitest";

// The renderer is server-only code; the guard import is for the bundler, not for tests.
vi.mock("server-only", () => ({}));

import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { parseQuote, type QuoteFormValues } from "../index";
import { FONT_LIST } from "../font-list";
import { BLANK_SPEC, HEADERS, LAYOUTS, LOGO_MODES, ROWS, STARTERS, TABLE_HEADS, TOTALS, resolveTheme, themeFromStored, type ThemeSpec } from "../themes";
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
    deliveryAddress: "",
    discountKind: "fixed",
    discountValue: "20",
    notes: "Thank you!",
    title: "",
    description: "",
    signOff: "",
    terms: "",
    paymentInstructions: "",
    showBankDetails: true, showPhotos: true,
    depositKind: "none",
    depositValue: "",
    balanceDue: "handover",
    balanceDueDate: "",
    policies: [],
    ...over,
  };
  const parsed = parseQuote(values, vat);
  if (!parsed.ok) throw new Error("should parse: " + JSON.stringify(parsed.errors));
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

describe("themes", () => {
  const withTheme = (spec: Partial<ThemeSpec>, name = "Mine") => ({
    ...snapshot(vats.inclusive),
    theme: resolveTheme({ ...BLANK_SPEC, ...spec }, name),
  });
  const textOf = async (pdf: Buffer) => (await pageTexts(pdf)).flat().join(" ");
  /** The table's headings are drawn in capitals (a style, not the words); other text may say "prices", so match the capitals. */
  const hasWord = (text: string, word: string) => new RegExp(`\\b${word.toUpperCase().replace(".", "\\.")}(?![a-z])`).test(text);

  it("draws a version sent before themes existed, and one naming an unknown design, as Classic", async () => {
    const old = { ...snapshot(vats.inclusive) } as Record<string, unknown>;
    delete old.theme;
    const withoutTheme = await renderQuotePdf(old as unknown as ReturnType<typeof snapshot>);
    const unknown = await renderQuotePdf({ ...(old as unknown as ReturnType<typeof snapshot>), design: "future" });
    const classic = await renderQuotePdf(snapshot(vats.inclusive));
    for (const pdf of [withoutTheme, unknown, classic]) expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(Math.abs(withoutTheme.length - classic.length)).toBeLessThan(200);
  });

  it("draws a version sent with the first designs (their older theme shape) as it was", async () => {
    const first = {
      key: "bold", headingFont: "sans", header: "band", tableHead: "filled", rows: "zebra", totals: "solid", radius: 0,
      paper: "#ffffff", ink: "#1a1a1a", muted: "#666666", line: "#dddddd", accent: "#1e3a8a", onAccent: "#ffffff",
      accentInk: "#1e3a8a", tint: "#e8ebf3", tintStrong: "#f1f3f8",
    };
    const upgraded = themeFromStored({ theme: first });
    expect(upgraded.header).toBe("band");
    expect(upgraded.layout).toBe("table");
    expect(upgraded.muted).toBe("#666666");
    expect(upgraded.name).toBe("Bold");
    const pdf = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: first as never });
    expect(await textOf(pdf)).toContain("Page 1 of");
  });

  it("draws every starter with all of its text, the page numbers included", async () => {
    for (const s of STARTERS) {
      const pdf = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: resolveTheme(s.spec, s.name) });
      const text = await textOf(pdf);
      expect(text, s.key).toContain("Page 1 of");
      expect(text, s.key).toContain("Total including VAT");
    }
  }, 30000);

  it("marks a draft in every header style, the band included", async () => {
    for (const header of HEADERS) {
      const pdf = await renderQuotePdf(withTheme({ header }), { draft: true });
      expect(await textOf(pdf), header).toContain("DRAFT PREVIEW");
    }
  }, 30000);

  it("draws every way of showing the items with every option, and the item text is there", async () => {
    const sharp = (await import("sharp")).default;
    const photo = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#ccaa88" } }).jpeg().toBuffer();
    const base = snapshot(vats.inclusive);
    const withPhoto = { ...base, lines: base.lines.map((l) => ({ ...l, photoImageId: "p1" })) };
    const images = new Map([["p1", { contentType: "image/jpeg", bytes: photo }]]);
    // Every layout with every row style, and every table heading on the table.
    const combos = [
      ...LAYOUTS.flatMap((layout) => ROWS.map((rows) => ({ layout, rows, tableHead: "line" as const }))),
      ...TABLE_HEADS.map((tableHead) => ({ layout: "table" as const, rows: "lines" as const, tableHead })),
    ];
    for (const { layout, rows, tableHead } of combos) {
      const pdf = await renderQuotePdf(
        { ...withPhoto, theme: resolveTheme({ ...BLANK_SPEC, layout, rows, tableHead, photo: "large", photoShape: "round", numbered: true, density: "airy" }, "x") },
        { images },
      );
      const text = await textOf(pdf);
      expect(text, `${layout} ${rows} ${tableHead}`).toContain("Wedding cake");
      expect(text, `${layout} ${rows} ${tableHead}`).toContain("Page 1 of");
    }
  }, 120000);

  it("leaves out what the theme turns off: quantity, price, descriptions, and shows the numbers", async () => {
    const all = await textOf(await renderQuotePdf(withTheme({ numbered: true })));
    expect(hasWord(all, "Qty")).toBe(true);
    expect(hasWord(all, "Price")).toBe(true);
    expect(all).toContain("Three tiers, vanilla");
    expect(hasWord(all, "No.")).toBe(true);
    const lean = await textOf(await renderQuotePdf(withTheme({ showQty: false, showUnitPrice: false, descriptions: false })));
    expect(hasWord(lean, "Qty")).toBe(false);
    expect(hasWord(lean, "Price")).toBe(false);
    expect(lean).not.toContain("Three tiers, vanilla");
    expect(lean).toContain("Wedding cake");
    const list = await textOf(await renderQuotePdf(withTheme({ layout: "list", showQty: true, showUnitPrice: true })));
    expect(list).toContain("×");
  }, 30000);

  it("draws the centred header, the logo choices, the serif body and every totals style", async () => {
    const sharp = (await import("sharp")).default;
    const logo = { contentType: "image/png", bytes: await sharp({ create: { width: 60, height: 20, channels: 3, background: "#aa5522" } }).png().toBuffer() };
    for (const headerLogo of LOGO_MODES) {
      const pdf = await renderQuotePdf(withTheme({ headerAlign: "center", headerLogo, bodyFont: "serif", header: "boxed" }), { logo });
      expect(await textOf(pdf), headerLogo).toContain("Page 1 of");
    }
    for (const totals of TOTALS) {
      expect(await textOf(await renderQuotePdf(withTheme({ totals }))), totals).toContain("Total including VAT");
    }
  }, 60000);

  it("draws every font in the list, as headings and as text, with the quote's words in it", async () => {
    const plain = await renderQuotePdf(withTheme({}));
    for (const { id, label } of FONT_LIST) {
      const pdf = await renderQuotePdf(withTheme({ headingFont: id, bodyFont: id }));
      const text = await textOf(pdf);
      expect(text, label).toContain("Wedding cake");
      expect(text, label).toContain("Page 1 of");
      if (id !== "sans") expect(Buffer.compare(pdf, plain), `${label} differs from Noto Sans`).not.toBe(0);
    }
  }, 120000);

  it("draws a gradient and a picture behind every page, on every page of a long quote", async () => {
    const sharp = (await import("sharp")).default;
    const picture = await sharp({ create: { width: 200, height: 280, channels: 3, background: "#d9c7a8" } }).jpeg().toBuffer();
    const bgId = "3f2a1b2c-0000-4000-8000-000000000001";
    const base = snapshot(vats.inclusive);
    const countImages = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length;

    const plain = await renderQuotePdf({ ...base, theme: resolveTheme(BLANK_SPEC, "x") });
    const gradient = await renderQuotePdf({ ...base, theme: resolveTheme({ ...BLANK_SPEC, background: "gradient", paper: "#fbf7f0", gradientTo: "#fde9d9", gradientDirection: "diagonal" }, "x") });
    expect(await textOf(gradient)).toContain("Page 1 of");
    expect(Buffer.compare(gradient, plain)).not.toBe(0);

    const theme = resolveTheme({ ...BLANK_SPEC, background: "image", backgroundImageId: bgId, imageStrength: "soft" }, "x");
    const withPicture = await renderQuotePdf({ ...base, theme }, { background: { contentType: "image/jpeg", bytes: picture } });
    expect(countImages(withPicture)).toBeGreaterThan(countImages(plain));
    // A picture that could not be loaded is simply left out.
    const without = await renderQuotePdf({ ...base, theme });
    expect(countImages(without)).toBe(countImages(plain));
    // A picture behind a quote that runs onto a second page is on both pages.
    const long = await renderQuotePdf({ ...snapshot(vats.inclusive, { lines: manyLines(40) }), theme }, { background: { contentType: "image/jpeg", bytes: picture } });
    const pages = await pageTexts(long);
    expect(pages.length).toBeGreaterThan(1);
    expect(await textOf(long)).toContain("Page 2 of");
  }, 60000);

  it("draws a sent version from its frozen theme, whatever the theme is now", async () => {
    const frozen = resolveTheme({ ...BLANK_SPEC, accent: "#7e22ce", header: "band" }, "Mine");
    const a = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: frozen });
    const b = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: frozen });
    expect(a.length).toBe(b.length);
    const other = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: resolveTheme({ ...BLANK_SPEC, accent: "#0f766e", header: "band" }, "Mine") });
    expect(Buffer.compare(a, other)).not.toBe(0);
  });

  it("falls back to Classic when a stored theme is damaged", async () => {
    const pdf = await renderQuotePdf({ ...snapshot(vats.inclusive), theme: { key: "warm", accent: 5 } as never });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
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

describe("the deposit on the document", () => {
  it("renders the deposit and the balance, and an old version without them", async () => {
    const base = snapshot(vats.inclusive);
    const deposit = {
      label: "Deposit to start work",
      depositCents: 125_000,
      percentText: "50%",
      balanceLabel: "Balance",
      balanceCents: 125_000,
      dueText: "due by 14 Nov 2026",
    };
    const withDeposit = await renderQuotePdf({ ...base, deposit });
    const without = await renderQuotePdf({ ...base, deposit: undefined });
    expect(withDeposit.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(withDeposit.length).toBeGreaterThan(without.length);
  });
});

/** The text on each page of a PDF, in drawing order (read back with pdf.js, as the preview does). */
async function pageTexts(pdf: Buffer): Promise<string[][]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const pages: string[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str.trim() : "")).filter((t) => t !== ""));
  }
  return pages;
}

function manyLines(count: number): QuoteFormValues["lines"] {
  return Array.from({ length: count }, (_, i) => ({
    key: `l${i}`,
    kind: "custom" as const,
    productId: "",
    name: `Item ${i + 1}`,
    description: "A description that is long enough to need some room on the page.",
    quantity: "2",
    unit: "",
    unitPrice: "19,99",
    discountKind: "none" as const,
    discountValue: "",
  }));
}

describe("the footer", () => {
  it("prints on every page: the business and number, and 'Page n of m' (a page-wide line height makes react-pdf drop it)", async () => {
    const pdf = await renderQuotePdf(snapshot(vats.inclusive, { lines: manyLines(30) }));
    const pages = await pageTexts(pdf);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((texts, i) => {
      expect(texts.join(" ")).toContain(`Page ${i + 1} of ${pages.length}`);
      expect(texts.join(" ")).toContain("Sweet Co · QT-0001");
    });
  });
});

describe("headings and page breaks", () => {
  const LABELS = ["NOTES", "Notes", "HOW TO PAY", "How to pay", "TERMS", "Terms", "OTHER TERMS", "Other terms", "TERMS AND POLICIES", "Terms and policies", "PREPARED FOR"];

  it("never leave a heading alone at the foot of a page, however the page happens to fall", async () => {
    // Walk the first item's description through a page boundary, so that some length puts the notes
    // (and the heading above them) right at it.
    for (let descriptionLines = 3; descriptionLines <= 12; descriptionLines += 1) {
      const lines = manyLines(6);
      lines[0] = { ...lines[0], description: Array.from({ length: descriptionLines }, (_, i) => `Detail ${i + 1}`).join("\n") };
      const pdf = await renderQuotePdf(
        snapshot(vats.exclusive, {
          lines,
          notes: "Thank you for asking. ".repeat(12),
          paymentInstructions: "EFT is fine. SnapScan too.",
          terms: "Some terms. ".repeat(20),
        }),
      );
      const pages = await pageTexts(pdf);
      pages.forEach((texts, i) => {
        // Leave out the footer (it is drawn first); what is left ends with the body's last text.
        const body = texts.filter((t) => t !== "Sweet Co · QT-0001" && !/^Page \d+ of \d+$/.test(t));
        const last = body[body.length - 1] ?? "";
        expect(LABELS, `${descriptionLines} description lines, page ${i + 1} ends with "${last}"`).not.toContain(last);
      });
    }
  }, 60_000);

  it("repeats the table's column headings on a page the table runs onto, and only there", async () => {
    const pages = await pageTexts(await renderQuotePdf(snapshot(vats.inclusive, { lines: manyLines(60) })));
    expect(pages.length).toBeGreaterThan(2);
    // Every page that carries table rows carries the headings.
    for (const texts of pages) {
      const hasRows = texts.some((t) => /^Item \d+$/.test(t));
      expect(texts.includes("ITEM") || texts.includes("Item")).toBe(hasRows);
    }
  }, 60_000);
});

describe("the delivery address on the document", () => {
  it("prints under 'Deliver to' (cleaned for the font), and an older version without one still draws", async () => {
    const base = snapshot(vats.inclusive);
    const withAddress = await pageTexts(await renderQuotePdf({ ...base, deliveryAddress: "22 Jacaranda Avenue 🎂\nParkhurst" }));
    const text = withAddress[0].join(" ");
    expect(text).toMatch(/deliver to/i);
    expect(text).toContain("22 Jacaranda Avenue");
    expect(text).toContain("Parkhurst");
    expect(text).not.toContain("🎂");
    const without = await pageTexts(await renderQuotePdf({ ...base, deliveryAddress: undefined }));
    expect(without[0].join(" ")).not.toMatch(/deliver to/i);
    const nullAddress = await pageTexts(await renderQuotePdf({ ...base, deliveryAddress: null }));
    expect(nullAddress[0].join(" ")).not.toMatch(/deliver to/i);
  });
});

describe("pictures on the document", () => {
  async function sample(color: string) {
    const sharp = (await import("sharp")).default;
    return sharp({ create: { width: 200, height: 200, channels: 3, background: color } }).jpeg().toBuffer();
  }

  it("draws a logo and the product photos it is given, and none when it is given none", async () => {
    const base = snapshot(vats.inclusive);
    const withIds = { ...base, logoImageId: "logo", lines: base.lines.map((l) => ({ ...l, photoImageId: "photo" })) };
    const images = new Map([["photo", { contentType: "image/jpeg", bytes: await sample("#d97706") }]]);
    const logo = { contentType: "image/jpeg", bytes: await sample("#1e3a8a") };
    const pdf = await renderQuotePdf(withIds, { images, logo });
    const plain = await renderQuotePdf(withIds);
    expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    expect(plain.toString("latin1")).not.toContain("/Subtype /Image");
  });

  it("leaves a missing picture out rather than failing, and keeps the names lined up", async () => {
    const base = snapshot(vats.inclusive);
    const lines = [{ ...base.lines[0], photoImageId: "gone" }, { ...base.lines[0], name: "Second item", photoImageId: null }];
    const pdf = await renderQuotePdf({ ...base, lines, logoImageId: "gone" }, { images: new Map(), logo: null });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = (await pageTexts(pdf))[0].join(" ");
    expect(text).toContain("Second item");
  });

  it("draws a version sent before pictures existed", async () => {
    const old = { ...snapshot(vats.inclusive) } as Record<string, unknown>;
    delete old.logoImageId;
    const pdf = await renderQuotePdf(old as unknown as ReturnType<typeof snapshot>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
