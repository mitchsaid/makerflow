import { describe, expect, it } from "vitest";
import { blankInvoiceForm } from "../../invoices/draft";
import type { LineFormValues } from "../../quotes";
import type { RecurrenceSummary } from "../data";
import { repeatRowsOf } from "../rows";

const line = { key: "l1", productId: "", kind: "custom", name: "Workshop pass", description: "", quantity: "1", unitPrice: "300", discountKind: "none", discountValue: "" } as LineFormValues;
const base: RecurrenceSummary = {
  id: "r1",
  organisationId: "o1",
  customerId: "c1",
  customerName: "Thandi",
  form: { ...blankInvoiceForm({ today: "2026-11-01", dueDays: 14, customerId: "c1" }), lines: [line] },
  schedule: { frequency: "month", every: 1, startsOn: "2026-11-15" },
  ending: { endsOn: null, maxRuns: null },
  nextRunOn: "2026-12-15",
  pausedAt: null,
  pausedReason: null,
  runCount: 0,
  lastRunOn: null,
  lastSkipped: 0,
  theme: { id: null, starter: null },
};
const rows = (r: Partial<RecurrenceSummary>) => repeatRowsOf([{ ...base, ...r }], { registered: false }, "en-ZA", "2026-11-06")[0];

describe("a repeat as the list shows it", () => {
  it("a running one says how often, what it comes to and when it is next", () => {
    const r = rows({});
    expect(r).toMatchObject({ status: "running", how: "Every month on the 15th", grossCents: 30000, itemCount: 1, made: null, until: null });
    expect(r.next).toMatch(/15 Dec 2026/);
  });

  it("says what it has made, and what it skipped", () => {
    expect(rows({ runCount: 3, lastRunOn: "2026-11-15" }).made).toMatch(/^Last made 15 Nov 2026 · 3 made$/);
    expect(rows({ runCount: 3, lastRunOn: "2026-11-15", lastSkipped: 2 }).made).toMatch(/2 earlier dates were skipped/);
    expect(rows({ runCount: 1, lastRunOn: "2026-11-15", lastSkipped: 1 }).made).toMatch(/1 earlier date was skipped/);
  });

  it("a paused one gives the reason and no next day", () => {
    const r = rows({ pausedAt: "2026-11-06T10:00:00Z", pausedReason: "An item is no longer valid." });
    expect(r).toMatchObject({ status: "paused", next: null, pausedReason: "An item is no longer valid." });
  });

  it("a finished one has no next day", () => {
    expect(rows({ nextRunOn: null })).toMatchObject({ status: "finished", next: null });
  });

  it("says how it ends", () => {
    expect(rows({ ending: { endsOn: "2027-06-06", maxRuns: null } }).until).toMatch(/^Until 0?6 Jun 2027$/);
    expect(rows({ ending: { endsOn: null, maxRuns: 6 } }).until).toBe("6 times in all");
    expect(rows({ ending: { endsOn: null, maxRuns: 1 } }).until).toBe("1 time in all");
  });

  it("copes with a form or schedule that cannot be read", () => {
    const r = rows({ form: null, schedule: null });
    expect(r).toMatchObject({ how: null, itemCount: 0, grossCents: null, startsOn: null });
  });

  it("an item that is not priced yet gives no total", () => {
    expect(rows({ form: { ...base.form!, lines: [{ ...line, unitPrice: "" }] } }).grossCents).toBeNull();
  });
});
