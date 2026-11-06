import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isInvoiceDraftForm, type InvoiceDraftForm } from "../invoices/draft";
import { isStarterKey } from "../quotes/themes";
import { isSchedule, type Ending, type Schedule } from "./schedule";

/**
 * Repeat reads (docs/plans/recurring.md). Row-level security limits every query to businesses the signed-in person belongs
 * to; the pages keep only the current business's rows (see customers/data.ts for why this is done after the queries).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  customer_id: string | null;
  form: unknown;
  theme_id: string | null;
  theme_starter: string | null;
  frequency: string;
  every: number;
  starts_on: string;
  last_day: boolean;
  ends_on: string | null;
  max_runs: number | null;
  next_run_on: string | null;
  paused_at: string | null;
  paused_reason: string | null;
  run_count: number;
  last_run_on: string | null;
  last_skipped: number;
  customers: { name: string } | { name: string }[] | null;
};

export type RecurrenceSummary = {
  id: string;
  organisationId: string;
  customerId: string | null;
  customerName: string | null;
  /** The form it repeats, or null when what is stored cannot be read as an invoice form (it can then only be stopped). */
  form: InvoiceDraftForm | null;
  /** Null when what is stored cannot be read as a schedule. */
  schedule: Schedule | null;
  ending: Ending;
  nextRunOn: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
  runCount: number;
  lastRunOn: string | null;
  lastSkipped: number;
  theme: { id: string | null; starter: string | null };
};

const COLUMNS =
  "id, organisation_id, customer_id, form, theme_id, theme_starter, frequency, every, starts_on, last_day, ends_on, max_runs, next_run_on, paused_at, paused_reason, run_count, last_run_on, last_skipped, customers ( name )";

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

export function recurrenceOf(row: Row): RecurrenceSummary {
  const schedule = { frequency: row.frequency, every: row.every, startsOn: row.starts_on, ...(row.last_day ? { lastDay: true } : {}) };
  return {
    id: row.id,
    organisationId: row.organisation_id,
    customerId: row.customer_id,
    customerName: one(row.customers)?.name ?? null,
    form: isInvoiceDraftForm(row.form) ? row.form : null,
    schedule: isSchedule(schedule) ? schedule : null,
    ending: { endsOn: row.ends_on, maxRuns: row.max_runs },
    nextRunOn: row.next_run_on,
    pausedAt: row.paused_at,
    pausedReason: row.paused_reason,
    runCount: row.run_count,
    lastRunOn: row.last_run_on,
    lastSkipped: row.last_skipped,
    theme: { id: row.theme_id, starter: isStarterKey(row.theme_starter) ? row.theme_starter : null },
  };
}

/** Every repeat of the business, the next one due first (finished ones last). One query. */
export async function getRecurrences(): Promise<RecurrenceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").select(COLUMNS).order("next_run_on", { ascending: true, nullsFirst: false }).limit(25);
  if (error) throw new Error(`Could not load repeats: ${error.message}`);
  return (data as unknown as Row[]).map(recurrenceOf);
}

/** One repeat, or null for a bad id or one this person cannot see. */
export async function findRecurrence(id: string): Promise<RecurrenceSummary | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the repeat: ${error.message}`);
  return data ? recurrenceOf(data as unknown as Row) : null;
}

/** One repeat. Shows the "not found" page for a bad or foreign id. */
export async function getRecurrence(id: string): Promise<RecurrenceSummary> {
  const found = await findRecurrence(id);
  if (!found) notFound();
  return found;
}

/**
 * What Home says about repeats (docs/plans/recurring.md): the invoice drafts a repeat made that are still waiting to be
 * checked, and the repeats that paused themselves. Two small queries side by side; the page keeps its own business's rows.
 */
export async function getRepeatNotices(): Promise<{ readyOrganisationIds: string[]; pausedOrganisationIds: string[] }> {
  const supabase = await createClient();
  const [ready, paused] = await Promise.all([
    supabase.from("invoice_drafts").select("organisation_id").not("recurrence_id", "is", null).limit(100),
    supabase.from("recurrences").select("organisation_id").not("paused_reason", "is", null).limit(25),
  ]);
  if (ready.error) throw new Error(`Could not load the drafts repeats made: ${ready.error.message}`);
  if (paused.error) throw new Error(`Could not load the paused repeats: ${paused.error.message}`);
  return {
    readyOrganisationIds: (ready.data as { organisation_id: string }[]).map((r) => r.organisation_id),
    pausedOrganisationIds: (paused.data as { organisation_id: string }[]).map((r) => r.organisation_id),
  };
}
