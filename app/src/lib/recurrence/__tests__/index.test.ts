import { describe, expect, it } from "vitest";
import { blankRepeatForm, firstDue, parseRepeatForm, repeatFormOf, repeatStatus } from "../index";

const today = "2026-11-06";
const base = { ...blankRepeatForm(today) };

describe("the repeat form", () => {
  it("starts monthly from the same day next month, with no end", () => {
    expect(base).toMatchObject({ frequency: "month", every: "1", startsOn: "2026-12-06", lastDay: false, end: "never" });
    // From the 31st the next month's day is the last one.
    expect(blankRepeatForm("2026-01-31").startsOn).toBe("2026-02-28");
  });

  it("reads a good one", () => {
    const r = parseRepeatForm(base, today);
    expect(r.ok && r.schedule).toEqual({ frequency: "month", every: 1, startsOn: "2026-12-06" });
    expect(r.ok && r.ending).toEqual({ endsOn: null, maxRuns: null });
  });

  it("last day of the month only counts for a monthly repeat", () => {
    const monthly = parseRepeatForm({ ...base, lastDay: true }, today);
    expect(monthly.ok && monthly.schedule.lastDay).toBe(true);
    const weekly = parseRepeatForm({ ...base, frequency: "week", lastDay: true }, today);
    expect(weekly.ok && weekly.schedule.lastDay).toBeUndefined();
  });

  it("says what is wrong at the field", () => {
    expect(parseRepeatForm({ ...base, startsOn: "" }, today)).toEqual({ ok: false, errors: { startsOn: "Choose the first day." } });
    expect(parseRepeatForm({ ...base, startsOn: "2026-11-01" }, today)).toMatchObject({ ok: false, errors: { startsOn: expect.stringMatching(/today or later/) } });
    expect(parseRepeatForm({ ...base, every: "0" }, today)).toMatchObject({ ok: false, errors: { every: expect.any(String) } });
    expect(parseRepeatForm({ ...base, end: "on", endsOn: "" }, today)).toMatchObject({ ok: false, errors: { endsOn: "Choose the last day." } });
    expect(parseRepeatForm({ ...base, end: "on", endsOn: "2026-12-01" }, today)).toMatchObject({ ok: false, errors: { endsOn: expect.stringMatching(/before the starting day/) } });
    expect(parseRepeatForm({ ...base, end: "after", maxRuns: "2,5" }, today)).toMatchObject({ ok: false, errors: { maxRuns: expect.stringMatching(/whole number/) } });
    expect(parseRepeatForm({ ...base, end: "after", maxRuns: "" }, today)).toMatchObject({ ok: false, errors: { maxRuns: expect.any(String) } });
    expect(parseRepeatForm({ ...base, end: "after", maxRuns: "101" }, today)).toMatchObject({ ok: false, errors: { maxRuns: expect.stringMatching(/1 to 100/) } });
  });

  it("an end of a number of times, or a day", () => {
    const after = parseRepeatForm({ ...base, end: "after", maxRuns: "6" }, today);
    expect(after.ok && after.ending).toEqual({ endsOn: null, maxRuns: 6 });
    const on = parseRepeatForm({ ...base, end: "on", endsOn: "2027-06-06" }, today);
    expect(on.ok && on.ending).toEqual({ endsOn: "2027-06-06", maxRuns: null });
  });

  it("a repeat that is already running may keep a starting day in the past, but not move it there", () => {
    const running = { ...base, startsOn: "2026-01-15" };
    expect(parseRepeatForm(running, today, { keepStartsOn: "2026-01-15" }).ok).toBe(true);
    expect(parseRepeatForm(running, today).ok).toBe(false);
  });

  it("round-trips a repeat into the form", () => {
    const form = repeatFormOf({ frequency: "month", every: 3, startsOn: "2026-12-06", lastDay: true }, { endsOn: null, maxRuns: 4 });
    expect(form).toEqual({ frequency: "month", every: "3", startsOn: "2026-12-06", lastDay: true, end: "after", endsOn: "", maxRuns: "4" });
  });

  it("is first due on its starting day, or the next day on or after today", () => {
    expect(firstDue({ frequency: "month", every: 1, startsOn: "2026-12-06" }, today)).toBe("2026-12-06");
    expect(firstDue({ frequency: "month", every: 1, startsOn: "2026-01-06" }, today)).toBe("2026-11-06");
    expect(firstDue({ frequency: "month", every: 1, startsOn: "2026-01-05" }, today)).toBe("2026-12-05");
  });

  it("says whether a repeat is running, paused or finished", () => {
    expect(repeatStatus({ nextRunOn: "2026-12-01", pausedAt: null })).toBe("running");
    expect(repeatStatus({ nextRunOn: "2026-12-01", pausedAt: "2026-11-06T10:00:00Z" })).toBe("paused");
    expect(repeatStatus({ nextRunOn: null, pausedAt: null })).toBe("finished");
  });
});
