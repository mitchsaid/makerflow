import { describe, expect, it } from "vitest";
import { customerOverview } from "../overview";

const TODAY = "2026-10-22";

describe("customerOverview", () => {
  it("adds up what invoices still have owing, after payments and credit notes", () => {
    const o = customerOverview({
      quotes: [],
      jobs: [],
      invoices: [
        { grossCents: 100000, paidCents: 40000, creditedCents: 10000 }, // 50 000 owing
        { grossCents: 20000, paidCents: 0, creditedCents: 0 }, // 20 000 owing
        { grossCents: 5000, paidCents: 5000, creditedCents: 0 }, // settled
      ],
      today: TODAY,
    });
    expect(o.owingCents).toBe(70000);
  });

  it("counts an invoice paid beyond what it comes to as nothing owing, not as a reduction of another", () => {
    const o = customerOverview({
      quotes: [],
      jobs: [],
      invoices: [
        { grossCents: 10000, paidCents: 10000, creditedCents: 4000 }, // 4 000 over-paid
        { grossCents: 3000, paidCents: 0, creditedCents: 0 },
      ],
      today: TODAY,
    });
    expect(o.owingCents).toBe(3000);
  });

  it("counts quotes still waiting for an answer: drafts, revisions and sent quotes that have not run out", () => {
    const o = customerOverview({
      quotes: [
        { status: "draft", version: 1, validUntil: "2026-11-01" },
        { status: "draft", version: 2, validUntil: "2026-11-01" },
        { status: "sent", version: 1, validUntil: "2026-10-22" }, // valid today
        { status: "sent", version: 1, validUntil: "2026-10-21" }, // ran out yesterday
        { status: "accepted", version: 1, validUntil: "2026-12-01" },
        { status: "declined", version: 1, validUntil: "2026-12-01" },
      ],
      jobs: [],
      invoices: [],
      today: TODAY,
    });
    expect(o.openQuotes).toBe(3);
  });

  it("counts jobs that are not done and not cancelled", () => {
    const o = customerOverview({
      quotes: [],
      jobs: [{ status: "not_started" }, { status: "in_progress" }, { status: "ready" }, { status: "done" }, { status: "cancelled" }],
      invoices: [],
      today: TODAY,
    });
    expect(o.jobsInProgress).toBe(3);
  });

  it("is all zero for a customer with nothing", () => {
    expect(customerOverview({ quotes: [], jobs: [], invoices: [], today: TODAY })).toEqual({ owingCents: 0, openQuotes: 0, jobsInProgress: 0 });
  });
});
