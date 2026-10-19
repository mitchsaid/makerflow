import { describe, expect, it } from "vitest";
import type { PaymentEntry } from "../../invoices/payments";
import { buildStatement, parsePeriod, periodStart, type StatementInvoice } from "../index";

const pay = (id: string, amountCents: number, paidOn: string, reversesId: string | null = null): PaymentEntry => ({
  id,
  amountCents,
  paidOn,
  method: null,
  note: null,
  reversesId,
  createdAt: `${paidOn}T08:00:00Z`,
});

const invoice = (over: Partial<StatementInvoice> & Pick<StatementInvoice, "id" | "number" | "issueDate" | "grossCents">): StatementInvoice => ({
  dueDate: over.issueDate,
  description: "Cake",
  payments: [],
  creditNotes: [],
  ...over,
});

const TODAY = "2026-10-20";

describe("periods", () => {
  it("start where they say, given today", () => {
    expect(periodStart("all", TODAY)).toBeNull();
    expect(periodStart("this_month", TODAY)).toBe("2026-10-01");
    expect(periodStart("last_30", TODAY)).toBe("2026-09-20");
    expect(periodStart("last_90", TODAY)).toBe("2026-07-22");
    expect(periodStart("ytd", TODAY)).toBe("2026-01-01");
  });
  it("read an unknown choice as all time", () => {
    expect(parsePeriod("last_90")).toBe("last_90");
    expect(parsePeriod("nonsense")).toBe("all");
    expect(parsePeriod(undefined)).toBe("all");
  });
});

describe("the ledger", () => {
  const invoices = [
    invoice({
      id: "a",
      number: "INV-0001",
      issueDate: "2026-08-01",
      grossCents: 100_000,
      payments: [pay("p1", 40_000, "2026-08-05")],
      creditNotes: [{ id: "c1", number: "CN-0001", issueDate: "2026-09-10", reason: "Returned", grossCents: 10_000 }],
    }),
    invoice({ id: "b", number: "INV-0002", issueDate: "2026-10-05", grossCents: 50_000, payments: [pay("p2", 50_000, "2026-10-06"), pay("r2", 50_000, "2026-10-07", "p2")] }),
  ];

  it("lists invoices, credit notes, payments and reversals by day with a running balance", () => {
    const s = buildStatement({ invoices, today: TODAY, period: "all", onlyOwing: false });
    expect(s.entries.map((e) => [e.date, e.kind, e.reference, e.debitCents, e.creditCents, e.balanceCents])).toEqual([
      ["2026-08-01", "invoice", "INV-0001", 100_000, 0, 100_000],
      ["2026-08-05", "payment", "INV-0001", 0, 40_000, 60_000],
      ["2026-09-10", "credit_note", "CN-0001", 0, 10_000, 50_000],
      ["2026-10-05", "invoice", "INV-0002", 50_000, 0, 100_000],
      ["2026-10-06", "payment", "INV-0002", 0, 50_000, 50_000],
      ["2026-10-07", "reversal", "INV-0002", 50_000, 0, 100_000],
    ]);
    expect(s.openingCents).toBe(0);
    expect(s.closingCents).toBe(100_000);
    expect(s.invoicedCents).toBe(150_000);
    expect(s.creditedCents).toBe(10_000);
    expect(s.paidCents).toBe(40_000);
  });

  it("carries what was owing before the period forward, so the closing balance is the same for every period", () => {
    const all = buildStatement({ invoices, today: TODAY, period: "all", onlyOwing: false });
    for (const period of ["this_month", "last_30", "last_90", "ytd"] as const) {
      const s = buildStatement({ invoices, today: TODAY, period, onlyOwing: false });
      expect(s.closingCents, period).toBe(all.closingCents);
      expect(s.openingCents + s.invoicedCents - s.creditedCents - s.paidCents, period).toBe(s.closingCents);
    }
    const month = buildStatement({ invoices, today: TODAY, period: "this_month", onlyOwing: false });
    expect(month.openingCents).toBe(50_000);
    expect(month.entries.map((e) => e.reference)).toEqual(["INV-0002", "INV-0002", "INV-0002"]);
    expect(month.entries[0].balanceCents).toBe(100_000);
  });

  it("puts an invoice before its credit note and payment on the same day", () => {
    const s = buildStatement({
      invoices: [invoice({ id: "x", number: "INV-1", issueDate: "2026-10-01", grossCents: 1000, payments: [pay("p", 500, "2026-10-01")], creditNotes: [{ id: "c", number: "CN-1", issueDate: "2026-10-01", reason: "x", grossCents: 100 }] })],
      today: TODAY,
      period: "all",
      onlyOwing: false,
    });
    expect(s.entries.map((e) => e.kind)).toEqual(["invoice", "credit_note", "payment"]);
  });

  it("names the way a payment was made", () => {
    const s = buildStatement({
      invoices: [invoice({ id: "x", number: "INV-1", issueDate: "2026-10-01", grossCents: 1000, payments: [{ ...pay("p", 500, "2026-10-02"), method: "eft" }] })],
      today: TODAY,
      period: "all",
      onlyOwing: false,
      methodLabel: (m) => (m === "eft" ? "EFT or bank transfer" : m),
    });
    expect(s.entries[1].description).toBe("Payment received, EFT or bank transfer");
  });
});

describe("only what is owing", () => {
  it("keeps the invoices with something owing, with their payments and credit notes, so the balance is what is owing", () => {
    const invoices = [
      invoice({ id: "paid", number: "INV-1", issueDate: "2026-09-01", grossCents: 1000, payments: [pay("p", 1000, "2026-09-02")] }),
      invoice({ id: "open", number: "INV-2", issueDate: "2026-09-05", grossCents: 5000, payments: [pay("q", 1000, "2026-09-06")], creditNotes: [{ id: "c", number: "CN-1", issueDate: "2026-09-07", reason: "x", grossCents: 500 }] }),
      invoice({ id: "credited", number: "INV-3", issueDate: "2026-09-08", grossCents: 700, creditNotes: [{ id: "d", number: "CN-2", issueDate: "2026-09-09", reason: "x", grossCents: 700 }] }),
    ];
    const s = buildStatement({ invoices, today: TODAY, period: "all", onlyOwing: true });
    expect(s.entries.map((e) => e.reference)).toEqual(["INV-2", "INV-2", "CN-1"]);
    expect(s.closingCents).toBe(3500);
    expect(s.ageing.totalCents).toBe(3500);
    expect(s.openInvoices).toBe(1);
  });
});

describe("ageing", () => {
  const owing = (id: string, issueDate: string, grossCents: number) => invoice({ id, number: `INV-${id}`, issueDate, grossCents });

  it("sorts what is owing by how long ago each invoice was issued, with the day boundaries", () => {
    const s = buildStatement({
      invoices: [
        owing("1", "2026-09-20", 100), // 30 days: current
        owing("2", "2026-09-19", 200), // 31 days
        owing("3", "2026-08-21", 400), // 60 days
        owing("4", "2026-08-20", 800), // 61 days
        owing("5", "2026-07-22", 1600), // 90 days
        owing("6", "2026-07-21", 3200), // 91 days
      ],
      today: TODAY,
      period: "all",
      onlyOwing: false,
    });
    expect(s.ageing).toEqual({ currentCents: 100, days31Cents: 600, days61Cents: 2400, days91Cents: 3200, totalCents: 6300 });
  });

  it("counts what is left after payments and credit notes, and leaves out what is settled", () => {
    const s = buildStatement({
      invoices: [
        invoice({ id: "a", number: "INV-A", issueDate: "2026-10-01", grossCents: 1000, payments: [pay("p", 300, "2026-10-02")], creditNotes: [{ id: "c", number: "CN-A", issueDate: "2026-10-03", reason: "x", grossCents: 200 }] }),
        invoice({ id: "b", number: "INV-B", issueDate: "2026-10-01", grossCents: 500, payments: [pay("q", 500, "2026-10-02")] }),
      ],
      today: TODAY,
      period: "all",
      onlyOwing: false,
    });
    expect(s.ageing.totalCents).toBe(500);
    expect(s.openInvoices).toBe(1);
  });

  it("shows an invoice paid beyond what it now comes to as credit on account, not against another invoice", () => {
    const s = buildStatement({
      invoices: [
        invoice({ id: "a", number: "INV-A", issueDate: "2026-10-01", grossCents: 1000, payments: [pay("p", 1000, "2026-10-02")], creditNotes: [{ id: "c", number: "CN-A", issueDate: "2026-10-03", reason: "x", grossCents: 400 }] }),
        invoice({ id: "b", number: "INV-B", issueDate: "2026-10-01", grossCents: 300 }),
      ],
      today: TODAY,
      period: "all",
      onlyOwing: false,
    });
    expect(s.creditOnAccountCents).toBe(400);
    expect(s.ageing.totalCents).toBe(300);
    expect(s.closingCents).toBe(-100);
  });

  it("is empty for a customer with no invoices", () => {
    const s = buildStatement({ invoices: [], today: TODAY, period: "all", onlyOwing: false });
    expect(s.entries).toEqual([]);
    expect(s.closingCents).toBe(0);
    expect(s.ageing.totalCents).toBe(0);
  });
});
