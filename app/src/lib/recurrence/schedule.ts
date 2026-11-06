import { addDays, isIsoDay } from "../quotes/dates";

/**
 * When a repeat is due (docs/plans/recurring.md). Days are calendar days as "YYYY-MM-DD", chosen in the business's own
 * time zone; no time of day is involved. Every occurrence is counted from the STARTING day, never from the previous one,
 * so "the 31st" goes 31, 28 (or 29), 31, 30 and does not drift down to the 28th for good.
 */
export const FREQUENCIES = ["week", "month", "year"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** How many weeks, months or years between one and the next. */
export const EVERY_MAX = 12;

export type Schedule = {
  frequency: Frequency;
  /** 1 to 12: every week, every 2 weeks, every month, every 3 months, every year. */
  every: number;
  /** The first day it is due. A weekly repeat falls on this day's weekday. */
  startsOn: string;
  /** Monthly only: the last day of each month, whatever its length, instead of the starting day of the month. */
  lastDay?: boolean;
};

export type Ending = { endsOn: string | null; maxRuns: number | null };

const parts = (day: string): [number, number, number] => {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
};
const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Whether this describes a schedule that can be worked out (a day that exists, a sensible count). */
export function isSchedule(value: unknown): value is Schedule {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<Schedule>;
  return (
    FREQUENCIES.includes(s.frequency as Frequency) &&
    Number.isInteger(s.every) &&
    (s.every as number) >= 1 &&
    (s.every as number) <= EVERY_MAX &&
    isIsoDay(s.startsOn) &&
    (s.lastDay === undefined || typeof s.lastDay === "boolean") &&
    (!s.lastDay || s.frequency === "month")
  );
}

/** The day of the k-th occurrence (k = 0 is the starting day). */
export function occurrence(schedule: Schedule, k: number): string {
  if (!Number.isInteger(k) || k < 0) throw new RangeError("an occurrence number is a whole number, 0 or more");
  const [y, m, d] = parts(schedule.startsOn);
  if (schedule.frequency === "week") return addDays(schedule.startsOn, 7 * schedule.every * k);
  const monthsAhead = (schedule.frequency === "month" ? schedule.every : 12 * schedule.every) * k;
  const index = y * 12 + (m - 1) + monthsAhead;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = daysInMonth(year, month);
  const day = schedule.lastDay ? last : Math.min(d, last);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** The first occurrence strictly after `day`, or the starting day itself when that is still to come. */
export function firstAfter(schedule: Schedule, day: string): string {
  if (schedule.startsOn > day) return schedule.startsOn;
  // Start near the answer, then step: an estimate a little low is corrected by the loop.
  const [y0, m0, d0] = parts(schedule.startsOn);
  const [y1, m1, d1] = parts(day);
  let k: number;
  if (schedule.frequency === "week") {
    const days = Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y0, m0 - 1, d0)) / 86_400_000);
    k = Math.floor(days / (7 * schedule.every));
  } else {
    const months = (y1 - y0) * 12 + (m1 - m0);
    k = Math.floor(months / (schedule.frequency === "month" ? schedule.every : 12 * schedule.every));
  }
  k = Math.max(0, k - 1);
  for (let i = 0; i < 1000; i++, k++) {
    const next = occurrence(schedule, k);
    if (next > day) return next;
  }
  throw new RangeError("could not work out the next day");
}

/** The days a repeat falls on from now, `count` of them, for showing "next: …, then …". */
export function upcoming(schedule: Schedule, from: string, count: number): string[] {
  const days: string[] = [];
  let day = schedule.startsOn >= from ? schedule.startsOn : firstAfter(schedule, addDays(from, -1));
  for (let i = 0; i < count; i++) {
    days.push(day);
    day = firstAfter(schedule, day);
  }
  return days;
}

/**
 * What happens when a repeat is due: it makes ONE (dated today, however many days were missed), and is due next on the
 * first occurrence after today. `skipped` counts the dates that went by without one (an outage, or a long pause).
 * `nextRunOn` is null when it has finished: the end day has passed or it has made its last one.
 */
export function afterRun(
  schedule: Schedule,
  ending: Ending,
  state: { dueOn: string; today: string; runCount: number },
): { nextRunOn: string | null; skipped: number; runCount: number } {
  const runCount = state.runCount + 1;
  let skipped = 0;
  let day = state.dueOn;
  // Dates between the one that was due and today (inclusive of today only when it was already past due).
  for (let i = 0; i < 1000; i++) {
    const next = firstAfter(schedule, day);
    if (next > state.today) {
      const finished = (ending.maxRuns !== null && runCount >= ending.maxRuns) || (ending.endsOn !== null && next > ending.endsOn);
      return { nextRunOn: finished ? null : next, skipped, runCount };
    }
    skipped += 1;
    day = next;
  }
  throw new RangeError("could not work out when it is next due");
}

/** Whether the schedule and its ending make sense together, with a message to show when they do not. */
export function checkSchedule(schedule: Schedule, ending: Ending, today: string): { ok: true } | { ok: false; field: "startsOn" | "endsOn" | "maxRuns"; message: string } {
  if (schedule.startsOn < today) return { ok: false, field: "startsOn", message: "Choose a starting day that is today or later." };
  if (ending.endsOn !== null) {
    if (!isIsoDay(ending.endsOn)) return { ok: false, field: "endsOn", message: "Choose the last day, or no end." };
    if (ending.endsOn < schedule.startsOn) return { ok: false, field: "endsOn", message: "The last day can't be before the starting day." };
  }
  if (ending.maxRuns !== null && (!Number.isInteger(ending.maxRuns) || ending.maxRuns < 1 || ending.maxRuns > 100)) {
    return { ok: false, field: "maxRuns", message: "Enter a number of times from 1 to 100." };
  }
  return { ok: true };
}

/** A schedule in words: "Every month on the 15th", "Every 2 weeks on Tuesdays", "Every year on 3 March". */
export function describeSchedule(schedule: Schedule, locale: string): string {
  const [y, m, d] = parts(schedule.startsOn);
  const every = schedule.every;
  if (schedule.frequency === "week") {
    const weekday = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
    return every === 1 ? `Every week on ${weekday}s` : `Every ${every} weeks on ${weekday}s`;
  }
  if (schedule.frequency === "month") {
    const when = schedule.lastDay ? "the last day" : `the ${ordinal(d)}`;
    return every === 1 ? `Every month on ${when}` : `Every ${every} months on ${when}`;
  }
  const date = new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
  return every === 1 ? `Every year on ${date}` : `Every ${every} years on ${date}`;
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
}
