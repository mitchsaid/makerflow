import { describe, expect, it } from "vitest";
import { afterRun, checkSchedule, describeSchedule, firstAfter, isSchedule, occurrence, upcoming, type Schedule } from "../schedule";

const monthly = (startsOn: string, extra: Partial<Schedule> = {}): Schedule => ({ frequency: "month", every: 1, startsOn, ...extra });

describe("occurrences", () => {
  it("weekly and fortnightly keep the weekday of the starting day", () => {
    const week: Schedule = { frequency: "week", every: 1, startsOn: "2026-11-03" }; // a Tuesday
    expect([0, 1, 2].map((k) => occurrence(week, k))).toEqual(["2026-11-03", "2026-11-10", "2026-11-17"]);
    expect([0, 1, 2].map((k) => occurrence({ ...week, every: 2 }, k))).toEqual(["2026-11-03", "2026-11-17", "2026-12-01"]);
  });

  it("monthly from the 31st clamps to short months and comes back, never drifting", () => {
    const s = monthly("2026-01-31");
    expect([0, 1, 2, 3, 4].map((k) => occurrence(s, k))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
    // A leap year keeps the 29th of February.
    expect(occurrence(s, 13)).toBe("2027-02-28");
    expect(occurrence(monthly("2027-12-31"), 2)).toBe("2028-02-29");
  });

  it("every 3 months and across a year end", () => {
    const s = monthly("2026-11-15", { every: 3 });
    expect([0, 1, 2].map((k) => occurrence(s, k))).toEqual(["2026-11-15", "2027-02-15", "2027-05-15"]);
  });

  it("the last day of the month, whatever its length", () => {
    const s = monthly("2026-01-31", { lastDay: true });
    expect([0, 1, 2, 3].map((k) => occurrence(s, k))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    // Started on the 15th, still the last day of each month.
    expect([0, 1].map((k) => occurrence(monthly("2026-01-15", { lastDay: true }), k))).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("yearly, with the 29th of February falling on the 28th in other years", () => {
    const s: Schedule = { frequency: "year", every: 1, startsOn: "2028-02-29" };
    expect([0, 1, 4].map((k) => occurrence(s, k))).toEqual(["2028-02-29", "2029-02-28", "2032-02-29"]);
  });

  it("refuses a bad occurrence number", () => {
    expect(() => occurrence(monthly("2026-01-01"), -1)).toThrow();
    expect(() => occurrence(monthly("2026-01-01"), 1.5)).toThrow();
  });
});

describe("first day after", () => {
  it("is the starting day when it is still to come", () => {
    expect(firstAfter(monthly("2026-12-01"), "2026-11-06")).toBe("2026-12-01");
  });

  it("is strictly after the given day", () => {
    const s = monthly("2026-01-15");
    expect(firstAfter(s, "2026-11-15")).toBe("2026-12-15");
    expect(firstAfter(s, "2026-11-14")).toBe("2026-11-15");
    expect(firstAfter(s, "2026-11-16")).toBe("2026-12-15");
  });

  it("works far from the start, in each frequency", () => {
    expect(firstAfter({ frequency: "week", every: 2, startsOn: "2026-11-03" }, "2030-01-01")).toBe("2030-01-08");
    expect(firstAfter({ frequency: "year", every: 2, startsOn: "2026-03-03" }, "2031-03-03")).toBe("2032-03-03");
    expect(firstAfter(monthly("2026-01-31"), "2028-02-10")).toBe("2028-02-29");
  });

  it("lists the next few", () => {
    expect(upcoming(monthly("2026-01-31"), "2026-02-01", 3)).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(upcoming(monthly("2026-12-01"), "2026-11-06", 2)).toEqual(["2026-12-01", "2027-01-01"]);
  });
});

describe("after a run", () => {
  const s = monthly("2026-01-15");

  it("on time: the next one is the following occurrence", () => {
    expect(afterRun(s, { endsOn: null, maxRuns: null }, { dueOn: "2026-11-15", today: "2026-11-15", runCount: 4 })).toEqual({ nextRunOn: "2026-12-15", skipped: 0, runCount: 5 });
  });

  it("late: makes one, counts the dates that went by and is next due after today", () => {
    expect(afterRun(s, { endsOn: null, maxRuns: null }, { dueOn: "2026-08-15", today: "2026-11-20", runCount: 7 })).toEqual({ nextRunOn: "2026-12-15", skipped: 3, runCount: 8 });
  });

  it("finishes at the end day or after the last run", () => {
    expect(afterRun(s, { endsOn: "2026-12-01", maxRuns: null }, { dueOn: "2026-11-15", today: "2026-11-15", runCount: 0 }).nextRunOn).toBeNull();
    expect(afterRun(s, { endsOn: "2026-12-15", maxRuns: null }, { dueOn: "2026-11-15", today: "2026-11-15", runCount: 0 }).nextRunOn).toBe("2026-12-15");
    expect(afterRun(s, { endsOn: null, maxRuns: 3 }, { dueOn: "2026-11-15", today: "2026-11-15", runCount: 2 }).nextRunOn).toBeNull();
    expect(afterRun(s, { endsOn: null, maxRuns: 3 }, { dueOn: "2026-11-15", today: "2026-11-15", runCount: 1 }).nextRunOn).toBe("2026-12-15");
  });
});

describe("checks", () => {
  it("reads only a whole schedule", () => {
    expect(isSchedule(monthly("2026-11-15"))).toBe(true);
    expect(isSchedule({ frequency: "day", every: 1, startsOn: "2026-11-15" })).toBe(false);
    expect(isSchedule(monthly("2026-11-15", { every: 13 }))).toBe(false);
    expect(isSchedule(monthly("2026-02-30"))).toBe(false);
    expect(isSchedule({ frequency: "week", every: 1, startsOn: "2026-11-15", lastDay: true })).toBe(false);
  });

  it("names what is wrong, at the field", () => {
    const s = monthly("2026-11-15");
    expect(checkSchedule(s, { endsOn: null, maxRuns: null }, "2026-11-06")).toEqual({ ok: true });
    expect(checkSchedule(monthly("2026-11-01"), { endsOn: null, maxRuns: null }, "2026-11-06")).toMatchObject({ ok: false, field: "startsOn" });
    expect(checkSchedule(s, { endsOn: "2026-11-01", maxRuns: null }, "2026-11-06")).toMatchObject({ ok: false, field: "endsOn" });
    expect(checkSchedule(s, { endsOn: null, maxRuns: 0 }, "2026-11-06")).toMatchObject({ ok: false, field: "maxRuns" });
    expect(checkSchedule(s, { endsOn: null, maxRuns: 101 }, "2026-11-06")).toMatchObject({ ok: false, field: "maxRuns" });
  });

  it("describes a schedule in words", () => {
    expect(describeSchedule({ frequency: "week", every: 1, startsOn: "2026-11-03" }, "en-ZA")).toBe("Every week on Tuesdays");
    expect(describeSchedule({ frequency: "week", every: 2, startsOn: "2026-11-03" }, "en-ZA")).toBe("Every 2 weeks on Tuesdays");
    expect(describeSchedule(monthly("2026-11-22"), "en-ZA")).toBe("Every month on the 22nd");
    expect(describeSchedule(monthly("2026-11-11", { every: 3 }), "en-ZA")).toBe("Every 3 months on the 11th");
    expect(describeSchedule(monthly("2026-11-30", { lastDay: true }), "en-ZA")).toBe("Every month on the last day");
    expect(describeSchedule({ frequency: "year", every: 1, startsOn: "2026-03-03" }, "en-ZA")).toMatch(/^Every year on 3 March$/);
  });
});
