import { describe, expect, it } from "vitest";
import {
  canMoveJob,
  isOverdueJob,
  JOB_STATUSES,
  jobNumberText,
  jobStatusLabel,
  nextJobStep,
  otherJobSteps,
  visibleJobs,
  type JobFulfilment,
  type JobSummary,
} from "../index";

describe("job numbers and words", () => {
  it("shows J-0007", () => {
    expect(jobNumberText(7)).toBe("J-0007");
    expect(jobNumberText(12345)).toBe("J-12345");
  });
  it("says what ready means from how it is fulfilled", () => {
    expect(jobStatusLabel("ready", "collection")).toBe("Ready for collection");
    expect(jobStatusLabel("ready", "delivery")).toBe("Ready for delivery");
    expect(jobStatusLabel("ready", "none")).toBe("Ready");
    expect(jobStatusLabel("in_progress", "none")).toBe("Making");
  });
});

describe("moves", () => {
  it("allows the moves the database allows, and only those", () => {
    const allowed: Record<string, string[]> = {
      not_started: ["in_progress", "cancelled"],
      in_progress: ["ready", "not_started", "cancelled"],
      ready: ["done", "in_progress", "cancelled"],
      out_for_delivery: ["done", "ready"],
      done: ["ready"],
      cancelled: ["not_started"],
    };
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        const expected = allowed[from].includes(to);
        expect(canMoveJob(from, to, "collection"), `${from} to ${to} (collection)`).toBe(expected);
      }
    }
    // Out for delivery only for a delivery.
    expect(canMoveJob("ready", "out_for_delivery", "delivery")).toBe(true);
    expect(canMoveJob("ready", "out_for_delivery", "collection")).toBe(false);
    expect(canMoveJob("ready", "out_for_delivery", "none")).toBe(false);
  });

  it("offers one next step that is always an allowed move, for every status and way of fulfilling", () => {
    for (const fulfilment of ["none", "collection", "delivery"] as JobFulfilment[]) {
      for (const status of JOB_STATUSES) {
        const step = nextJobStep(status, fulfilment);
        if (step) expect(canMoveJob(status, step.to, fulfilment), `${status} -> ${step.to} (${fulfilment})`).toBe(true);
        for (const other of otherJobSteps(status, fulfilment)) {
          expect(canMoveJob(status, other.to, fulfilment), `${status} -> ${other.to} (${fulfilment}) other`).toBe(true);
        }
      }
    }
  });

  it("walks a delivery job through to done, and a collection job without the delivery step", () => {
    const walk = (f: JobFulfilment) => {
      const path: string[] = ["not_started"];
      let status = "not_started" as (typeof JOB_STATUSES)[number];
      for (let i = 0; i < 10; i++) {
        const step = nextJobStep(status, f);
        if (!step) break;
        status = step.to;
        path.push(status);
      }
      return path;
    };
    expect(walk("delivery")).toEqual(["not_started", "in_progress", "ready", "out_for_delivery", "done"]);
    expect(walk("collection")).toEqual(["not_started", "in_progress", "ready", "done"]);
  });

  it("a cancelled job can only be restored; a finished one has no next step", () => {
    expect(nextJobStep("cancelled", "none")).toBeNull();
    expect(otherJobSteps("cancelled", "none").map((s) => s.to)).toEqual(["not_started"]);
    expect(nextJobStep("done", "collection")).toBeNull();
  });
});

const job = (over: Partial<JobSummary> & { number: number }): JobSummary => ({
  id: String(over.number),
  organisationId: "o",
  status: "not_started",
  fulfilment: "collection",
  neededBy: null,
  customerName: "Thandi",
  items: [{ name: "Cake", quantityMilli: 1000, unit: null }],
  createdAt: "2026-10-01",
  ...over,
});

describe("overdue", () => {
  it("is a day that has passed on a job that is not finished", () => {
    expect(isOverdueJob({ status: "in_progress", neededBy: "2026-10-01" }, "2026-10-02")).toBe(true);
    expect(isOverdueJob({ status: "in_progress", neededBy: "2026-10-02" }, "2026-10-02")).toBe(false);
    expect(isOverdueJob({ status: "done", neededBy: "2026-10-01" }, "2026-10-02")).toBe(false);
    expect(isOverdueJob({ status: "cancelled", neededBy: "2026-10-01" }, "2026-10-02")).toBe(false);
    expect(isOverdueJob({ status: "not_started", neededBy: null }, "2026-10-02")).toBe(false);
  });
});

describe("the list", () => {
  const jobs = [
    job({ number: 1, neededBy: "2026-11-20", customerName: "Sipho" }),
    job({ number: 2, neededBy: "2026-11-05", customerName: "Thandi", items: [{ name: "Wedding cake", quantityMilli: 1000, unit: null }] }),
    job({ number: 3, neededBy: null }),
    job({ number: 4, status: "done", neededBy: "2026-10-01" }),
    job({ number: 5, status: "cancelled" }),
  ];
  it("shows active jobs by the day they are needed, undated last, then the finished ones for All", () => {
    expect(visibleJobs(jobs, "active", "").map((j) => j.number)).toEqual([2, 1, 3]);
    expect(visibleJobs(jobs, "done", "").map((j) => j.number)).toEqual([4]);
    expect(visibleJobs(jobs, "all", "").map((j) => j.number)).toEqual([2, 1, 3, 5, 4]);
  });
  it("searches the customer, the number and the items", () => {
    expect(visibleJobs(jobs, "all", "sipho").map((j) => j.number)).toEqual([1]);
    expect(visibleJobs(jobs, "all", "wedding").map((j) => j.number)).toEqual([2]);
    expect(visibleJobs(jobs, "all", "J-0003").map((j) => j.number)).toEqual([3]);
    expect(visibleJobs(jobs, "all", "3").map((j) => j.number)).toEqual([3]);
  });
});
