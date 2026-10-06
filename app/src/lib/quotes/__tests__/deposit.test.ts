import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import type { VatSettings } from "../../money";
import { depositAmounts, depositColumns, parseDeposit } from "../deposit";
import { isQuoteFormValues, parseQuote, toDatabasePayload, type QuoteFormValues } from "../index";
import { buildQuoteSnapshot } from "../snapshot";
import { sendProblems } from "../send-checks";
import { toFormValues } from "../form-values";

const NOT_REGISTERED: VatSettings = { registered: false };
const INCLUSIVE: VatSettings = { registered: true, entry: "inclusive", standardRateBp: 1500 };

describe("parseDeposit", () => {
  it("is no deposit unless one is asked for", () => {
    expect(parseDeposit({}, "2026-10-10")).toEqual({ ok: true, deposit: null });
    expect(parseDeposit({ depositKind: "none", depositValue: "50" }, "2026-10-10")).toEqual({ ok: true, deposit: null });
  });

  it("reads a percentage in basis points and a fixed amount in cents", () => {
    expect(parseDeposit({ depositKind: "percent", depositValue: "50" }, "2026-10-10")).toEqual({
      ok: true,
      deposit: { kind: "percent", basisPoints: 5000, balance: { kind: "handover" } },
    });
    expect(parseDeposit({ depositKind: "fixed", depositValue: "1 250,50" }, "2026-10-10")).toEqual({
      ok: true,
      deposit: { kind: "fixed", cents: 125050, balance: { kind: "handover" } },
    });
  });

  it("says how to fix an empty, zero or over-100 percentage and a zero or wrong amount", () => {
    for (const [kind, value] of [["percent", ""], ["percent", "0"], ["percent", "101"], ["percent", "abc"], ["fixed", ""], ["fixed", "0"], ["fixed", "R-5"]] as const) {
      const r = parseDeposit({ depositKind: kind, depositValue: value }, "2026-10-10");
      expect(r.ok, `${kind} ${value}`).toBe(false);
      if (!r.ok) expect(r.errors.depositValue, `${kind} ${value}`).toBeTruthy();
    }
  });

  it("needs a real date for a by-date balance, not before the quote's date", () => {
    const base = { depositKind: "percent", depositValue: "50", balanceDue: "date" } as const;
    expect(parseDeposit({ ...base, balanceDueDate: "" }, "2026-10-10")).toMatchObject({ ok: false, errors: { balanceDueDate: expect.stringMatching(/Choose the date/) } });
    expect(parseDeposit({ ...base, balanceDueDate: "2026-02-31" }, "2026-10-10").ok).toBe(false);
    expect(parseDeposit({ ...base, balanceDueDate: "2026-10-09" }, "2026-10-10")).toMatchObject({ ok: false, errors: { balanceDueDate: expect.stringMatching(/before the date of the quote/) } });
    expect(parseDeposit({ ...base, balanceDueDate: "2026-11-14" }, "2026-10-10")).toMatchObject({
      ok: true,
      deposit: { balance: { kind: "date", date: "2026-11-14" } },
    });
  });
});

describe("depositAmounts", () => {
  it("rounds a percentage to the cent and the balance makes up the rest, always", () => {
    for (const gross of [0, 1, 99, 100, 12345, 333_333, 99_999_999]) {
      for (const bp of [1, 3333, 5000, 6667, 10000]) {
        const { depositCents, balanceCents } = depositAmounts(gross, { kind: "percent", basisPoints: bp, balance: { kind: "handover" } });
        expect(depositCents + balanceCents, `${gross} at ${bp}`).toBe(gross);
        expect(depositCents).toBeGreaterThanOrEqual(0);
        expect(depositCents).toBeLessThanOrEqual(gross);
      }
    }
    expect(depositAmounts(250_001, { kind: "percent", basisPoints: 5000, balance: { kind: "handover" } })).toMatchObject({ depositCents: 125_001, balanceCents: 125_000 });
  });

  it("caps a fixed deposit at the total and says when it was too big", () => {
    expect(depositAmounts(100_000, { kind: "fixed", cents: 40_000, balance: { kind: "handover" } })).toEqual({ depositCents: 40_000, balanceCents: 60_000, tooBig: false });
    expect(depositAmounts(100_000, { kind: "fixed", cents: 100_001, balance: { kind: "handover" } })).toEqual({ depositCents: 100_000, balanceCents: 0, tooBig: true });
  });
});

describe("depositColumns", () => {
  it("stores no deposit as none, and the terms otherwise", () => {
    expect(depositColumns(null)).toEqual({ deposit_kind: "none", deposit_value: 0, balance_due: "handover", balance_due_date: null });
    expect(depositColumns({ kind: "percent", basisPoints: 5000, balance: { kind: "date", date: "2026-11-14" } })).toEqual({
      deposit_kind: "percent",
      deposit_value: 5000,
      balance_due: "date",
      balance_due_date: "2026-11-14",
    });
  });
});

const form = (over: Partial<QuoteFormValues> = {}): QuoteFormValues => ({
  customerId: "",
  issueDate: "2026-10-10",
  validUntil: "2026-10-24",
  neededBy: "",
  lines: [{ key: "a", kind: "custom", productId: "", name: "Cake", description: "", quantity: "1", unit: "", unitPrice: "2500", discountKind: "none", discountValue: "" }],
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
  showBankDetails: true,
  depositKind: "none",
  depositValue: "",
  balanceDue: "handover",
  balanceDueDate: "",
  policies: [],
  ...over,
});

const business = { name: "Sweet Co", phone: "011 555 0101", email: null, addressLine1: null, addressLine2: null, city: null, region: null, postalCode: null, vatRegistered: false, vatNumber: null };
const snapshotOf = (over: Partial<QuoteFormValues>, vat: VatSettings = NOT_REGISTERED) => {
  const parsed = parseQuote(form(over), vat);
  if (!parsed.ok) throw new Error("should parse");
  return buildQuoteSnapshot({ quote: parsed.quote, number: "QT-0001", version: 1, business, customer: null, countryCode: "ZA", currencyCode: "ZAR", vat, locale: ZA_LOCALE, bank: null });
};

describe("a deposit on a quote", () => {
  it("is saved with the quote and comes back as the text the form held", () => {
    const parsed = parseQuote(form({ depositKind: "percent", depositValue: "50", balanceDue: "date", balanceDueDate: "2026-11-14" }), NOT_REGISTERED);
    if (!parsed.ok) throw new Error("should parse");
    expect(parsed.quote.deposit).toMatchObject({ kind: "percent", basisPoints: 5000 });
    const payload = toDatabasePayload(parsed.quote, { countryCode: "ZA", currencyCode: "ZAR" }).quote;
    expect(payload).toMatchObject({ deposit_kind: "percent", deposit_value: 5000, balance_due: "date", balance_due_date: "2026-11-14" });
    const back = toFormValues(
      {
        customerId: null, issueDate: "2026-10-10", validUntil: "2026-10-24", neededBy: null, discountKind: "none", discountValue: 0, notes: null, title: null, description: null, signOff: null, terms: null,
        paymentInstructions: null, showBankDetails: true, depositKind: "percent", depositValue: 5000, balanceDue: "date", balanceDueDate: "2026-11-14", policies: [], lines: [],
      },
      ZA_LOCALE.numberStyle,
    );
    expect(back).toMatchObject({ depositKind: "percent", depositValue: "50", balanceDue: "date", balanceDueDate: "2026-11-14" });
  });

  it("has no deposit by default, and an older app that does not send it saves none", () => {
    const { depositKind: _k, depositValue: _v, balanceDue: _b, balanceDueDate: _d, ...older } = form();
    void [_k, _v, _b, _d];
    expect(isQuoteFormValues(older)).toBe(true);
    const parsed = parseQuote(older as QuoteFormValues, NOT_REGISTERED);
    if (!parsed.ok) throw new Error("should parse");
    expect(parsed.quote.deposit).toBeNull();
    expect(isQuoteFormValues({ ...form(), depositKind: "lottery" })).toBe(false);
  });

  it("reports a bad deposit at its fields, with everything else still parsed", () => {
    const parsed = parseQuote(form({ depositKind: "percent", depositValue: "" }), NOT_REGISTERED);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.fields.depositValue).toBeTruthy();
  });

  it("is frozen in the snapshot with its words: 50% of R2 500,00, balance on collection or delivery", () => {
    const s = snapshotOf({ depositKind: "percent", depositValue: "50" });
    expect(s.deposit).toEqual({
      label: "Deposit to start work",
      depositCents: 125_000,
      percentText: "50%",
      balanceLabel: "Balance",
      balanceCents: 125_000,
      dueText: "due on collection or delivery",
    });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("follows the quote's own delivery or collection, or a date", () => {
    expect(snapshotOf({ depositKind: "fixed", depositValue: "500", fulfilment: "collection" }).deposit?.dueText).toBe("due on collection");
    expect(snapshotOf({ depositKind: "fixed", depositValue: "500", fulfilment: "delivery", deliveryFee: "100" }).deposit?.dueText).toBe("due on delivery");
    expect(snapshotOf({ depositKind: "fixed", depositValue: "500", balanceDue: "date", balanceDueDate: "2026-11-14" }).deposit?.dueText).toMatch(/^due by 14 Nov 2026$/);
  });

  it("takes the deposit from the total including VAT, with the deposit and balance adding up", () => {
    const s = snapshotOf({ depositKind: "percent", depositValue: "33,33" }, INCLUSIVE);
    expect(s.deposit!.depositCents + s.deposit!.balanceCents).toBe(s.totals.grossCents);
  });

  it("is absent when none is asked for", () => {
    expect(snapshotOf({}).deposit).toBeNull();
  });

  it("stops the quote being sent when a fixed deposit is more than the total, and says how to fix it", () => {
    const problems = sendProblems({
      hasCustomer: true,
      itemCount: 1,
      validUntil: "2026-10-24",
      today: "2026-10-10",
      profile: { phone: "011", email: null, addressLine1: null, city: null },
      locale: ZA_LOCALE,
      depositTooBig: true,
    });
    expect(problems.map((p) => p.code)).toEqual(["deposit"]);
    expect(problems[0].message).toMatch(/more than the quote total/);
  });
});
