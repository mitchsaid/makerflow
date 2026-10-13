import { describe, expect, it } from "vitest";
import { getLocalePack } from "../../locale";
import {
  canMoveJob,
  isItemMade,
  isOverdueJob,
  JOB_STATUSES,
  jobNumberText,
  jobProgress,
  jobStatusLabel,
  nextJobStep,
  otherJobSteps,
  parseMade,
  progressText,
  stepMade,
  takesCounts,
  takesNewItems,
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
  items: [{ name: "Cake", quantityMilli: 1000, madeMilli: 0, unit: null }],
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
    job({ number: 2, neededBy: "2026-11-05", customerName: "Thandi", items: [{ name: "Wedding cake", quantityMilli: 1000, madeMilli: 0, unit: null }] }),
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

describe("what is made", () => {
  const item = (quantityMilli: number, madeMilli: number) => ({ quantityMilli, madeMilli });
  const style = getLocalePack("ZA").numberStyle;

  it("counts an item as made only when all of it is", () => {
    expect(isItemMade(item(5000, 5000))).toBe(true);
    expect(isItemMade(item(5000, 4000))).toBe(false);
    expect(isItemMade(item(2500, 2500))).toBe(true);
  });

  it("counts whole items for the job, and knows when everything is made", () => {
    expect(jobProgress([item(1000, 1000), item(2000, 1000), item(1000, 0)])).toEqual({ made: 1, total: 3, allMade: false });
    expect(jobProgress([item(1000, 1000), item(2000, 2000)])).toEqual({ made: 2, total: 2, allMade: true });
    // A job with no items has nothing to be made, so it is never "all made".
    expect(jobProgress([])).toEqual({ made: 0, total: 0, allMade: false });
  });

  it("says it in plain words", () => {
    expect(progressText({ made: 1, total: 3, allMade: false })).toBe("1 of 3 items made");
    expect(progressText({ made: 0, total: 1, allMade: false })).toBe("0 of 1 item made");
    expect(progressText({ made: 1, total: 1, allMade: true })).toBe("1 of 1 item made");
    expect(progressText({ made: 3, total: 3, allMade: true })).toBe("All 3 items made");
  });

  it("steps a whole unit at a time and stays between none and all", () => {
    expect(stepMade(0, 5000, 1)).toBe(1000);
    expect(stepMade(4000, 5000, 1)).toBe(5000);
    expect(stepMade(5000, 5000, 1)).toBe(5000);
    expect(stepMade(0, 500, 1)).toBe(500);
    expect(stepMade(2000, 5000, -1)).toBe(1000);
    expect(stepMade(0, 5000, -1)).toBe(0);
    // Part of a unit made: plus finishes what is left, minus goes down to the whole unit below.
    expect(stepMade(2000, 2500, 1)).toBe(2500);
    expect(stepMade(2500, 2500, -1)).toBe(2000);
    expect(stepMade(500, 500, -1)).toBe(0);
  });

  it("reads a typed count: none up to all, in the business's number style", () => {
    expect(parseMade("3", 5000, style)).toEqual({ ok: true, value: 3000 });
    expect(parseMade("2,5", 5000, style)).toEqual({ ok: true, value: 2500 });
    expect(parseMade("5", 5000, style)).toEqual({ ok: true, value: 5000 });
    expect(parseMade("0", 5000, style)).toEqual({ ok: true, value: 0 });
    expect(parseMade(" 0,0 ", 5000, style)).toEqual({ ok: true, value: 0 });
  });

  it("explains what to type when the count is wrong", () => {
    const more = parseMade("6", 5000, style);
    expect(more.ok).toBe(false);
    expect(more.ok ? "" : more.error).toBe("That is more than the 5 ordered. Enter a number up to 5.");
    expect(parseMade("", 5000, style).ok).toBe(false);
    expect(parseMade("abc", 5000, style).ok).toBe(false);
    expect(parseMade("-1", 5000, style).ok).toBe(false);
    expect(parseMade("1,0005", 5000, style).ok).toBe(false);
  });

  it("takes counts while it is being made, and new items until it is handed over", () => {
    expect(JOB_STATUSES.filter(takesCounts)).toEqual(["not_started", "in_progress"]);
    expect(JOB_STATUSES.filter(takesNewItems)).toEqual(["not_started", "in_progress", "ready"]);
  });
});
