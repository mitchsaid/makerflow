import { parseQuantity } from "../money";
import { addDays, isIsoDay } from "../quotes/dates";
import { EVERY_MAX, FREQUENCIES, checkSchedule, firstAfter, occurrence, type Ending, type Frequency, type Schedule } from "./schedule";

/**
 * The "Repeat this" form (docs/plans/recurring.md): how often, from which day, until when. Read here, once, by the same
 * code the browser checks with and the server saves with.
 */
export type RepeatFormValues = {
  frequency: Frequency;
  /** "1" to "12", as chosen. */
  every: string;
  startsOn: string;
  /** Monthly only. */
  lastDay: boolean;
  end: "never" | "on" | "after";
  endsOn: string;
  /** A whole number of times, as typed. */
  maxRuns: string;
};

export type RepeatFormErrors = Partial<Record<"every" | "startsOn" | "endsOn" | "maxRuns", string>>;

/** Monthly, from the same day next month: the usual thing, and always a day that is still to come. */
export function blankRepeatForm(today: string): RepeatFormValues {
  const next = occurrence({ frequency: "month", every: 1, startsOn: today }, 1);
  return { frequency: "month", every: "1", startsOn: next, lastDay: false, end: "never", endsOn: "", maxRuns: "" };
}

/** The form as it should read for a repeat that already exists. */
export function repeatFormOf(schedule: Schedule, ending: Ending): RepeatFormValues {
  return {
    frequency: schedule.frequency,
    every: String(schedule.every),
    startsOn: schedule.startsOn,
    lastDay: schedule.lastDay === true,
    end: ending.endsOn !== null ? "on" : ending.maxRuns !== null ? "after" : "never",
    endsOn: ending.endsOn ?? "",
    maxRuns: ending.maxRuns !== null ? String(ending.maxRuns) : "",
  };
}

export function parseRepeatForm(
  values: RepeatFormValues,
  today: string,
  /** The starting day may be in the past for a repeat that is already running, as long as it is not changed. */
  options: { keepStartsOn?: string } = {},
): { ok: true; schedule: Schedule; ending: Ending } | { ok: false; errors: RepeatFormErrors } {
  const errors: RepeatFormErrors = {};
  const everyNumber = Number(values.every);
  if (!FREQUENCIES.includes(values.frequency)) errors.every = "Choose how often.";
  else if (!Number.isInteger(everyNumber) || everyNumber < 1 || everyNumber > EVERY_MAX) errors.every = `Choose a number from 1 to ${EVERY_MAX}.`;

  if (!isIsoDay(values.startsOn)) errors.startsOn = "Choose the first day.";

  let endsOn: string | null = null;
  let maxRuns: number | null = null;
  if (values.end === "on") {
    if (!isIsoDay(values.endsOn)) errors.endsOn = "Choose the last day.";
    else endsOn = values.endsOn;
  } else if (values.end === "after") {
    const q = parseQuantity(values.maxRuns);
    if (!q.ok || q.value % 1000 !== 0) errors.maxRuns = "Enter a whole number of times, like 6.";
    else maxRuns = q.value / 1000;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const schedule: Schedule = { frequency: values.frequency, every: everyNumber, startsOn: values.startsOn, ...(values.frequency === "month" && values.lastDay ? { lastDay: true } : {}) };
  const ending: Ending = { endsOn, maxRuns };
  const kept = options.keepStartsOn === values.startsOn;
  const checked = checkSchedule(schedule, ending, kept ? values.startsOn : today);
  if (!checked.ok) return { ok: false, errors: { [checked.field]: checked.message } };
  return { ok: true, schedule, ending };
}

/** The first day it is due, for a schedule that has just been made or changed: its starting day, or the next one on or after today. */
export function firstDue(schedule: Schedule, today: string): string {
  if (schedule.startsOn >= today) return schedule.startsOn;
  // The first occurrence on or after today is the first one strictly after yesterday.
  return firstAfter(schedule, addDays(today, -1));
}

export type RepeatStatus = "running" | "paused" | "finished";

export function repeatStatus(r: { nextRunOn: string | null; pausedAt: string | null }): RepeatStatus {
  return r.nextRunOn === null ? "finished" : r.pausedAt !== null ? "paused" : "running";
}
