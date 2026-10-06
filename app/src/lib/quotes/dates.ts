/**
 * Calendar days as "YYYY-MM-DD" text (what a date input holds and what the database stores in
 * a date column). No time zones are involved once the day is chosen; only "today" depends on
 * where the business is.
 */

/** How long a new quote is valid for, until it becomes a business setting. */
export const DEFAULT_VALID_DAYS = 14;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Is this a real calendar day in the form YYYY-MM-DD? */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 2000 || year > 2100) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** The day `days` after (or before, if negative) the given day. */
export function addDays(isoDay: string, days: number): string {
  const m = ISO_DAY.exec(isoDay);
  if (!m) throw new RangeError(`not a day: ${isoDay}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}

/** Today's date where the business is, e.g. "2026-10-02" for Africa/Johannesburg. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // The "en-CA" format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "2 Oct 2026" for showing a stored day. Always read as a calendar day, never shifted by a time zone. */
export function formatDay(isoDay: string, locale: string): string {
  const m = ISO_DAY.exec(isoDay);
  if (!m) return isoDay;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const f = ISO_DAY.exec(from);
  const t = ISO_DAY.exec(to);
  if (!f || !t) throw new RangeError("not a day");
  return Math.round(
    (Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3])) -
      Date.UTC(Number(f[1]), Number(f[2]) - 1, Number(f[3]))) /
      86_400_000,
  );
}

/** "3 Oct 2026, 14:05" for a moment in time, in the business's own time zone. */
export function formatMoment(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
