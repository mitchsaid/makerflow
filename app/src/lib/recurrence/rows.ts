import { isBlankLine, previewTotals } from "../quotes";
import { formatDay } from "../quotes/dates";
import type { VatSettings } from "../money";
import type { RecurrenceSummary } from "./data";
import { blankRepeatForm, repeatFormOf, repeatStatus, type RepeatFormValues, type RepeatStatus } from "./index";
import { describeSchedule } from "./schedule";

/** One repeat as the Repeating list shows it. Everything a card needs, ready to write out. */
export type RepeatRow = {
  id: string;
  customerName: string | null;
  itemCount: number;
  /** What each one comes to (null while an item is not priced). */
  grossCents: number | null;
  status: RepeatStatus;
  /** "Every month on the 15th" (null when the stored schedule cannot be read). */
  how: string | null;
  /** The next day it is due, written out (running only). */
  next: string | null;
  /** Why it is paused, when the run paused it. */
  pausedReason: string | null;
  /** "Last made 6 Nov 2026 · 3 made", or null before the first. */
  made: string | null;
  /** "Until 6 Jun 2027" or "6 times in all", or null for no end. */
  until: string | null;
  /** The schedule as the Change schedule sheet starts from it. */
  scheduleForm: RepeatFormValues;
  startsOn: string | null;
  /** For a card's own sentence ("Pause the repeat for Thandi"). */
  label: string;
};

export function repeatRowsOf(repeats: readonly RecurrenceSummary[], vat: VatSettings, formatLocale: string, today: string): RepeatRow[] {
  return repeats.map((r) => {
    const items = r.form ? r.form.lines.filter((l) => !isBlankLine(l)) : [];
    const totals = r.form ? previewTotals(r.form, vat) : null;
    const priced = items.length > 0 && totals !== null && items.every((l) => l.unitPrice.trim() !== "");
    const status = repeatStatus(r);
    const day = (d: string) => formatDay(d, formatLocale);
    const skipped = r.lastSkipped > 0 ? ` (${r.lastSkipped} earlier ${r.lastSkipped === 1 ? "date was" : "dates were"} skipped)` : "";
    return {
      id: r.id,
      customerName: r.customerName,
      itemCount: items.length,
      grossCents: priced && totals ? totals.grossCents : null,
      status,
      how: r.schedule ? describeSchedule(r.schedule, formatLocale) : null,
      next: status === "running" && r.nextRunOn ? day(r.nextRunOn) : null,
      pausedReason: status === "paused" ? r.pausedReason : null,
      made: r.runCount > 0 && r.lastRunOn ? `Last made ${day(r.lastRunOn)} · ${r.runCount} made${skipped}` : null,
      until: r.ending.endsOn ? `Until ${day(r.ending.endsOn)}` : r.ending.maxRuns !== null ? `${r.ending.maxRuns} ${r.ending.maxRuns === 1 ? "time" : "times"} in all` : null,
      scheduleForm: r.schedule ? repeatFormOf(r.schedule, r.ending) : blankRepeatForm(today),
      startsOn: r.schedule?.startsOn ?? null,
      label: r.customerName ?? "No customer",
    };
  });
}
