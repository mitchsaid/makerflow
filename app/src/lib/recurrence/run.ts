import "server-only";
import { isInvoiceDraftForm } from "../invoices/draft";
import { getLocalePack, vatSettingsFor } from "../locale";
import { addDays, todayIn } from "../quotes/dates";
import { createAdminClient } from "../supabase/admin";
import { checkForToday } from "./make";
import { afterRun, isSchedule, type Schedule } from "./schedule";

/**
 * The daily run (docs/plans/recurring.md): finds the repeats that are due, each in its own business's time zone, and
 * makes one invoice DRAFT for each, never an issued invoice. Runs as the server (the secret key): it reads only what
 * is due and writes only through run_recurrence / pause_recurrence_with_reason, which are callable by the server alone.
 * A repeat that cannot make a good invoice is paused with the reason, and one failing never stops the others.
 */

type DueRow = {
  id: string;
  organisation_id: string;
  form: unknown;
  frequency: string;
  every: number;
  starts_on: string;
  last_day: boolean;
  ends_on: string | null;
  max_runs: number | null;
  next_run_on: string;
  run_count: number;
};

type ProfileRow = { organisation_id: string; country_code: string; vat_registered: boolean; prices_include_vat: boolean };

export type RunResult = { checked: number; made: number; paused: number; failed: number };

/** How many repeats one run looks at. A business has at most 25, so this is far more than a day brings. */
const BATCH = 500;

export async function runDueRecurrences(now: Date = new Date()): Promise<RunResult> {
  const supabase = createAdminClient();
  const result: RunResult = { checked: 0, made: 0, paused: 0, failed: 0 };

  // Anything due somewhere on earth today: a day ahead of UTC covers every time zone, and each repeat is then checked
  // against its own business's today.
  const horizon = addDays(now.toISOString().slice(0, 10), 1);
  const { data, error } = await supabase
    .from("recurrences")
    .select("id, organisation_id, form, frequency, every, starts_on, last_day, ends_on, max_runs, next_run_on, run_count")
    .is("paused_at", null)
    .not("next_run_on", "is", null)
    .lte("next_run_on", horizon)
    .order("next_run_on", { ascending: true })
    .limit(BATCH);
  if (error) throw new Error(`could not read the repeats that are due: ${error.message}`);
  const rows = (data ?? []) as DueRow[];
  if (rows.length === 0) return result;

  const { data: profiles, error: profileError } = await supabase
    .from("business_profiles")
    .select("organisation_id, country_code, vat_registered, prices_include_vat")
    .in("organisation_id", [...new Set(rows.map((r) => r.organisation_id))]);
  if (profileError) throw new Error(`could not read the businesses: ${profileError.message}`);
  const profileOf = new Map((profiles as ProfileRow[]).map((p) => [p.organisation_id, p]));

  const pause = async (row: DueRow, reason: string) => {
    const { error: pauseError } = await supabase.rpc("pause_recurrence_with_reason", { p_org: row.organisation_id, p_id: row.id, p_reason: reason });
    if (pauseError) throw new Error(pauseError.message);
    result.paused += 1;
  };

  for (const row of rows) {
    try {
      const profile = profileOf.get(row.organisation_id);
      if (!profile) continue;
      const locale = getLocalePack(profile.country_code);
      const today = todayIn(locale.timeZone, now);
      if (row.next_run_on > today) continue;
      result.checked += 1;

      const schedule: Schedule = { frequency: row.frequency as Schedule["frequency"], every: row.every, startsOn: row.starts_on, lastDay: row.last_day };
      if (!isSchedule(schedule) || !isInvoiceDraftForm(row.form)) {
        await pause(row, "This repeat could not be read. Open it, check the schedule and what it repeats, then resume.");
        continue;
      }
      const checked = checkForToday(row.form, today, locale.documents.invoice.dueDays, vatSettingsFor({ vatRegistered: profile.vat_registered, pricesIncludeVat: profile.prices_include_vat }, locale));
      if (!checked.ok) {
        await pause(row, checked.reason);
        continue;
      }
      const after = afterRun(schedule, { endsOn: row.ends_on, maxRuns: row.max_runs }, { dueOn: row.next_run_on, today, runCount: row.run_count });
      const { data: draftId, error: runError } = await supabase.rpc("run_recurrence", {
        p_org: row.organisation_id,
        p_id: row.id,
        p_today: today,
        p_expected_due: row.next_run_on,
        p_form: checked.form,
        p_next: after.nextRunOn,
        p_skipped: after.skipped,
      });
      if (runError) throw new Error(runError.message);
      if (draftId) result.made += 1;
    } catch (error) {
      // One repeat's trouble must not stop the rest; it is tried again tomorrow.
      result.failed += 1;
      console.error(`repeat ${row.id} could not run:`, error instanceof Error ? error.message : error);
    }
  }
  return result;
}
