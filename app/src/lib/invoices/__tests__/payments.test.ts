import { describe, expect, it } from "vitest";
import { owingCentsOf, paidCentsOf, parsePaymentForm, paymentRows, refundDueCentsOf, type PaymentEntry } from "../payments";

const entry = (over: Partial<PaymentEntry>): PaymentEntry => ({
  id: "p",
  amountCents: 1000,
  paidOn: "2026-10-20",
  method: null,
  note: null,
  reversesId: null,
  createdAt: "2026-10-20T08:00:00Z",
  ...over,
});

describe("what has been paid", () => {
  it("is the payments less the reversals", () => {
    const entries = [
      entry({ id: "a", amountCents: 40_000 }),
      entry({ id: "b", amountCents: 75_000 }),
      entry({ id: "r", amountCents: 75_000, reversesId: "b" }),
    ];
    expect(paidCentsOf(entries)).toBe(40_000);
    expect(paidCentsOf([])).toBe(0);
  });

  it("owes what is left, never below nothing", () => {
    expect(owingCentsOf(115_000, 40_000)).toBe(75_000);
    expect(owingCentsOf(115_000, 115_000)).toBe(0);
    expect(owingCentsOf(100, 500)).toBe(0);
    expect(owingCentsOf(115_000, 40_000, 30_000)).toBe(45_000);
  });

  it("says what the customer is owed back when they paid more than the invoice now comes to", () => {
    expect(refundDueCentsOf(115_000, 115_000, 30_000)).toBe(30_000);
    expect(refundDueCentsOf(115_000, 80_000, 30_000)).toBe(0);
    expect(refundDueCentsOf(115_000, 50_000, 115_000)).toBe(50_000);
    expect(refundDueCentsOf(115_000, 0, 115_000)).toBe(0);
  });
});

describe("the payments list", () => {
  it("lists payments by the day received, each with the reversal that undid it, and hides reversals as rows", () => {
    const rows = paymentRows([
      entry({ id: "late", paidOn: "2026-10-25", createdAt: "2026-10-25T08:00:00Z" }),
      entry({ id: "early", paidOn: "2026-10-20", createdAt: "2026-10-26T08:00:00Z" }),
      entry({ id: "rev", reversesId: "early", paidOn: "2026-10-27", createdAt: "2026-10-27T08:00:00Z" }),
    ]);
    expect(rows.map((r) => r.payment.id)).toEqual(["early", "late"]);
    expect(rows[0].reversal?.id).toBe("rev");
    expect(rows[1].reversal).toBeNull();
  });
});

describe("the payment form", () => {
  const context = { owingCents: 75_000, owingText: "R 750,00", today: "2026-10-20" };
  const ok = { amount: "400", paidOn: "2026-10-20", method: "eft", note: "  Deposit " };

  it("takes an amount up to what is owing, a day not ahead of today, an optional way and note", () => {
    expect(parsePaymentForm(ok, context)).toEqual({ ok: true, amountCents: 40_000, paidOn: "2026-10-20", method: "eft", note: "Deposit" });
    expect(parsePaymentForm({ ...ok, amount: "750", method: "", note: "" }, context)).toEqual({
      ok: true,
      amountCents: 75_000,
      paidOn: "2026-10-20",
      method: null,
      note: null,
    });
    expect(parsePaymentForm({ ...ok, amount: "1 250,50", paidOn: "2026-10-19" }, { ...context, owingCents: 200_000 })).toMatchObject({ ok: true, amountCents: 125_050 });
  });

  it("says what is wrong and how to fix it", () => {
    const bad = (over: Partial<typeof ok>) => {
      const r = parsePaymentForm({ ...ok, ...over }, context);
      return r.ok ? null : r.errors;
    };
    expect(bad({ amount: "" })?.amount).toMatch(/amount/i);
    expect(bad({ amount: "abc" })?.amount).toMatch(/numbers/i);
    expect(bad({ amount: "0" })?.amount).toMatch(/above nothing/i);
    expect(bad({ amount: "750,01" })?.amount).toBe("That is more than what is owing (R 750,00). Enter R 750,00 or less.");
    expect(bad({ paidOn: "" })?.paidOn).toMatch(/Choose the day/);
    expect(bad({ paidOn: "2026-10-21" })?.paidOn).toMatch(/hasn't come yet/);
    expect(bad({ method: "bitcoin" })?.method).toMatch(/from the list/);
    expect(bad({ note: "x".repeat(501) })?.note).toMatch(/under 500/);
  });

  it("says a paid invoice is paid in full", () => {
    const r = parsePaymentForm(ok, { ...context, owingCents: 0 });
    expect(r.ok ? null : r.errors.amount).toBe("This invoice is paid in full.");
  });
});
