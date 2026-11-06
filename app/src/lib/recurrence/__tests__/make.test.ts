import { describe, expect, it } from "vitest";
import { blankInvoiceForm } from "../../invoices/draft";
import type { LineFormValues } from "../../quotes";
import { checkForToday, dueGap, formForToday } from "../make";

const line = (over: Partial<LineFormValues> = {}): LineFormValues => ({
  key: "l1", productId: "", kind: "custom", name: "Workshop pass", description: "", quantity: "1", unitPrice: "300", discountKind: "none", discountValue: "", ...over,
} as LineFormValues);

const form = (over = {}) => ({ ...blankInvoiceForm({ today: "2026-10-01", dueDays: 14, customerId: "7b2f6c1e-3b0a-4c5e-9a55-0f3d1f9d2a11" }), lines: [line()], ...over });

describe("a repeat's draft for today", () => {
  it("keeps the gap between the invoice date and the due date", () => {
    expect(dueGap(form(), 30)).toBe(14);
    expect(dueGap({ issueDate: "2026-10-01", dueDate: "2026-10-01" }, 30)).toBe(0);
    // A gap that cannot be right falls back to the usual one.
    expect(dueGap({ issueDate: "2026-10-10", dueDate: "2026-10-01" }, 30)).toBe(30);
    expect(dueGap({ issueDate: "", dueDate: "" }, 30)).toBe(30);
  });

  it("is dated today and due the same number of days later", () => {
    const made = formForToday(form(), "2026-11-15", 30);
    expect(made.issueDate).toBe("2026-11-15");
    expect(made.dueDate).toBe("2026-11-29");
    expect(made.lines).toHaveLength(1);
  });

  it("is checked as an invoice, and a good one passes", () => {
    const r = checkForToday(form(), "2026-11-15", 30, { registered: false });
    expect(r.ok).toBe(true);
  });

  it("an item that no longer checks out gives a reason to pause with, in words", () => {
    const r = checkForToday(form({ lines: [line({ unitPrice: "abc" })] }), "2026-11-15", 30, { registered: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/^It could not make an invoice: .+Edit what it repeats/);
      expect(r.reason.length).toBeLessThanOrEqual(300);
    }
  });

  it("no items, or no customer, is a reason too", () => {
    const none = checkForToday(form({ lines: [] }), "2026-11-15", 30, { registered: false });
    expect(none.ok).toBe(false);
    const nobody = checkForToday(form({ customerId: "" }), "2026-11-15", 30, { registered: false });
    expect(nobody.ok).toBe(false);
  });
});
