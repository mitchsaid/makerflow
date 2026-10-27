import { describe, expect, it } from "vitest";
import { ZA_LOCALE, validatePaymentLink } from "../../locale/za";
import { howToPayGroups } from "../groups";
import {
  canEditPaymentMethods,
  invoicePaymentWays,
  parsePaymentMethodForm,
  paymentMethodFromRow,
  paymentMethodLines,
  paymentMethodSummary,
  paymentWaySnapshots,
  sortPaymentMethods,
  waysForNewQuote,
  type PaymentMethod,
  type PaymentMethodRow,
} from "../index";

const row = (over: Partial<PaymentMethodRow> = {}): PaymentMethodRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "link",
  name: "Pay online",
  details: { url: "https://pay.example.test/sweet", ignored: "x" },
  image_id: null,
  on_new_quotes: true,
  sort_order: 0,
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
  ...over,
});

const link = paymentMethodFromRow(row(), ZA_LOCALE)!;
const payshap = paymentMethodFromRow(
  row({
    id: "22222222-2222-4222-8222-222222222222",
    kind: "mobile-id",
    name: "PayShap",
    details: { id: "082 555 0101" },
    created_at: "2026-10-03T10:00:00Z",
  }),
  ZA_LOCALE,
)!;

describe("South African ways to pay", () => {
  it("offers the QR code (a picture) and the rest, all ready", () => {
    expect(
      ZA_LOCALE.payment.waysToPay.map((k) => [k.kind, k.available]),
    ).toEqual([
      ["qr", true],
      ["link", true],
      ["mobile-id", true],
      ["collection", true],
      ["other", true],
    ]);
    expect(ZA_LOCALE.payment.bankTransferName).toBe("EFT");
  });

  it("wants a whole https web address for a payment link", () => {
    expect(validatePaymentLink(" https://pay.example.test/x ")).toEqual({
      ok: true,
      value: "https://pay.example.test/x",
    });
    for (const bad of [
      "",
      "pay.example.test",
      "http://pay.example.test",
      "https://localhost",
      "https://a b.test",
      "javascript:alert(1)",
    ]) {
      expect(validatePaymentLink(bad).ok).toBe(false);
    }
  });
});

describe("paymentMethodFromRow", () => {
  it("keeps only the fields the country's kind knows", () => {
    expect(link.details).toEqual({ url: "https://pay.example.test/sweet" });
    expect(link.onNewQuotes).toBe(true);
  });

  it("leaves out a kind the country does not offer, and one not built yet", () => {
    expect(
      paymentMethodFromRow(row({ kind: "snapscan" }), ZA_LOCALE),
    ).toBeNull();
    expect(paymentMethodFromRow(row({ kind: "bitcoin" }), ZA_LOCALE)).toBeNull();
  });

  it("copes with details that are not an object", () => {
    expect(
      paymentMethodFromRow(row({ details: [] }), ZA_LOCALE)!.details,
    ).toEqual({});
  });
});

describe("parsePaymentMethodForm", () => {
  it("accepts a complete form and stores clean values", () => {
    expect(
      parsePaymentMethodForm(
        {
          kind: "link",
          name: "  Pay   online ",
          fields: { url: "https://pay.example.test/x" },
          imageId: "",
          onNewQuotes: false,
        },
        ZA_LOCALE,
      ),
    ).toEqual({
      ok: true,
      kind: "link",
      name: "Pay online",
      details: { url: "https://pay.example.test/x" },
      imageId: null,
      onNewQuotes: false,
    });
  });

  it("says how to fix each problem, at the field", () => {
    const r = parsePaymentMethodForm(
      {
        kind: "link",
        name: " ",
        fields: { url: "pay.example.test" },
        imageId: "",
        onNewQuotes: true,
      },
      ZA_LOCALE,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toMatch(/Give it a name/);
      expect(r.errors.fields.url).toMatch(/starting with https:\/\//);
    }
  });

  it("asks for what a kind needs, and nothing for the optional words of pay on collection", () => {
    const empty = parsePaymentMethodForm(
      { kind: "mobile-id", name: "PayShap", fields: {}, imageId: "", onNewQuotes: true },
      ZA_LOCALE,
    );
    expect(empty.ok).toBe(false);
    expect(
      parsePaymentMethodForm(
        {
          kind: "collection",
          name: "Pay on collection",
          fields: {},
          imageId: "",
          onNewQuotes: true,
        },
        ZA_LOCALE,
      ).ok,
    ).toBe(true);
  });

  it("refuses a kind that is unknown", () => {
    for (const kind of ["bitcoin", ""]) {
      const r = parsePaymentMethodForm(
        { kind, name: "x", fields: {}, imageId: "", onNewQuotes: true },
        ZA_LOCALE,
      );
      expect(r.ok).toBe(false);
    }
  });

  it("wants a QR code's picture, and gives other kinds none", () => {
    const qrId = "33333333-3333-4333-8333-333333333333";
    const without = parsePaymentMethodForm({ kind: "qr", name: "SnapScan", fields: {}, imageId: "", onNewQuotes: true }, ZA_LOCALE);
    expect(without.ok).toBe(false);
    if (!without.ok) expect(without.errors.image).toMatch(/Choose the QR code picture/);
    const bad = parsePaymentMethodForm({ kind: "qr", name: "SnapScan", fields: {}, imageId: "not-an-id", onNewQuotes: true }, ZA_LOCALE);
    expect(bad.ok).toBe(false);
    expect(parsePaymentMethodForm({ kind: "qr", name: "SnapScan", fields: { words: "Scan to pay" }, imageId: qrId, onNewQuotes: true }, ZA_LOCALE)).toEqual({
      ok: true,
      kind: "qr",
      name: "SnapScan",
      details: { words: "Scan to pay" },
      imageId: qrId,
      onNewQuotes: true,
    });
    // A picture sent with a kind that has none is dropped.
    const link = parsePaymentMethodForm({ kind: "link", name: "Pay", fields: { url: "https://pay.example.test/x" }, imageId: qrId, onNewQuotes: true }, ZA_LOCALE);
    expect(link.ok && link.imageId).toBeNull();
  });

  it("limits the name's length", () => {
    const r = parsePaymentMethodForm(
      {
        kind: "other",
        name: "x".repeat(61),
        fields: { words: "Ask me" },
        imageId: "",
        onNewQuotes: true,
      },
      ZA_LOCALE,
    );
    expect(r.ok).toBe(false);
  });
});

describe("lines and summaries", () => {
  it("prints one row per filled field with the country's label", () => {
    expect(paymentMethodLines(link, ZA_LOCALE)).toEqual([
      { label: "Web address", value: "https://pay.example.test/sweet" },
    ]);
    expect(paymentMethodSummary(payshap, ZA_LOCALE)).toBe(
      "PayShap or mobile payment ID · 082 555 0101",
    );
  });
});

describe("which ways a document shows", () => {
  it("lists them oldest first, by sort order then when they were added", () => {
    const first = { ...link, id: "a", sortOrder: 1 };
    const second = {
      ...payshap,
      id: "b",
      sortOrder: 0,
      createdAt: "2026-10-05T10:00:00Z",
    };
    const third = {
      ...payshap,
      id: "c",
      sortOrder: 0,
      createdAt: "2026-10-04T10:00:00Z",
    };
    expect(sortPaymentMethods([first, second, third]).map((m) => m.id)).toEqual(
      ["c", "b", "a"],
    );
  });

  it("starts new quotes with the ways kept on new quotes", () => {
    const off = { ...payshap, onNewQuotes: false };
    expect(waysForNewQuote([link, off]).map((m) => m.id)).toEqual([link.id]);
  });

  it("freezes every way except the ones unticked, with ids", () => {
    const shown = paymentWaySnapshots([link, payshap], [payshap.id], ZA_LOCALE);
    expect(shown).toEqual([
      {
        id: link.id,
        kind: "link",
        name: "Pay online",
        lines: [
          { label: "Web address", value: "https://pay.example.test/sweet" },
        ],
        imageId: null,
      },
    ]);
    expect(paymentWaySnapshots([link, payshap], [], ZA_LOCALE)).toHaveLength(2);
  });

  it("gives an invoice the current details of the ways the quote showed, and the quote's own copy of one since removed", () => {
    const shown = paymentWaySnapshots([link, payshap], [], ZA_LOCALE);
    const changed: PaymentMethod = {
      ...link,
      name: "Pay by card",
      details: { url: "https://pay.example.test/new" },
    };
    const onInvoice = invoicePaymentWays(shown, [changed], ZA_LOCALE);
    expect(onInvoice[0]).toMatchObject({
      id: link.id,
      name: "Pay by card",
      lines: [{ label: "Web address", value: "https://pay.example.test/new" }],
    });
    expect(onInvoice[1]).toEqual(shown[1]);
  });

  it("carries a QR code's picture into the document and an invoice, and prints it under its rows", () => {
    const qrId = "33333333-3333-4333-8333-333333333333";
    const qr = paymentMethodFromRow(
      row({ id: "44444444-4444-4444-8444-444444444444", kind: "qr", name: "SnapScan", details: { words: "Scan to pay" }, image_id: qrId }),
      ZA_LOCALE,
    )!;
    expect(qr.imageId).toBe(qrId);
    expect(paymentMethodSummary(qr, ZA_LOCALE)).toBe("QR code · Scan to pay");
    const shown = paymentWaySnapshots([qr], [], ZA_LOCALE);
    expect(shown[0].imageId).toBe(qrId);
    expect(invoicePaymentWays(shown, [qr], ZA_LOCALE)[0].imageId).toBe(qrId);
    const groups = howToPayGroups({ bankDetails: [], paymentMethods: shown, wording: { bankTransferName: "EFT" } as never });
    expect(groups).toEqual([{ name: "SnapScan", lines: [{ label: "What to tell the customer", value: "Scan to pay" }], bank: false, imageId: qrId }]);
    // A picture that is not a valid id is not used.
    expect(paymentMethodFromRow(row({ kind: "qr", image_id: "nope" }), ZA_LOCALE)!.imageId).toBeNull();
  });

  it("only the owner changes them", () => {
    expect(canEditPaymentMethods("owner")).toBe(true);
    for (const role of ["admin", "staff", null])
      expect(canEditPaymentMethods(role)).toBe(false);
  });
});

describe("howToPayGroups", () => {
  const wording = { bankTransferName: "EFT" } as never;
  const bank = [{ label: "Bank", value: "FNB" }];
  const ways = paymentWaySnapshots([link], [], ZA_LOCALE);

  it("names the account only when other ways are shown with it", () => {
    expect(
      howToPayGroups({ bankDetails: bank, paymentMethods: [], wording }),
    ).toEqual([{ name: null, lines: bank, bank: true, imageId: null }]);
    expect(
      howToPayGroups({ bankDetails: bank, paymentMethods: ways, wording }).map(
        (g) => g.name,
      ),
    ).toEqual(["EFT", "Pay online"]);
  });

  it("is empty when nothing is shown, and works for older snapshots", () => {
    expect(
      howToPayGroups({ bankDetails: [], paymentMethods: [], wording }),
    ).toEqual([]);
    expect(howToPayGroups({ wording } as never)).toEqual([]);
  });
});
