"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { isInvoiceDraftForm, type InvoiceDraftForm } from "@/lib/invoices/draft";
import { findInvoiceDraft } from "@/lib/invoices/draft-data";
import { formFromInvoice } from "@/lib/invoices/form-from-invoice";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { firstDue, parseRepeatForm, repeatStatus, type RepeatFormErrors, type RepeatFormValues } from "@/lib/recurrence";
import { checkForToday } from "@/lib/recurrence/make";
import { findRecurrence } from "@/lib/recurrence/data";
import { todayIn } from "@/lib/quotes/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Repeating invoices (docs/plans/recurring.md): starting a repeat from an invoice or a draft, changing its schedule or what
 * it repeats, pausing, resuming and stopping it. All of it runs under the person's own session (row-level security); the
 * daily run that makes the drafts is separate and server-only (lib/recurrence/run.ts). A repeat only ever makes a DRAFT.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";

export type RepeatResult =
  | { status: "saved"; id: string }
  | { status: "invalid"; errors: RepeatFormErrors }
  | { status: "error"; message: string };

type Plain = { status: "ok" } | { status: "error"; message: string };

/** Starts a repeat from an issued invoice or from an invoice draft, with the schedule the maker chose. */
export async function startRepeat(source: { kind: "invoice" | "draft"; id: string }, values: RepeatFormValues): Promise<RepeatResult> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(source.id)) return { status: "error", message: GENERIC_ERROR };
  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const parsed = parseRepeatForm(values, today);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  let form: InvoiceDraftForm;
  let theme: { id: string | null; starter: string | null } = { id: null, starter: null };
  if (source.kind === "invoice") {
    const copied = await formFromInvoice(source.id, organisation.id, profile.countryCode);
    if (!copied.ok) return { status: "error", message: copied.notFound ? copied.message : `${copied.message} Start a repeat from a draft instead.` };
    form = copied.form;
  } else {
    const draft = await findInvoiceDraft(source.id);
    if (!draft || draft.organisationId !== organisation.id || !draft.form) return { status: "error", message: "That draft can't be found any more. It may have been sent or discarded." };
    form = draft.form;
    theme = draft.theme;
  }

  // What it repeats must make a good invoice now, so it is not paused on its first day.
  const checked = checkForToday(form, today, locale.documents.invoice.dueDays, vatSettingsFor(profile, locale));
  if (!checked.ok) return { status: "error", message: `Fix this first: ${checked.problem}` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .insert({
      organisation_id: organisation.id,
      kind: "invoice",
      customer_id: checked.form.customerId === "" ? null : checked.form.customerId,
      form: checked.form,
      theme_id: theme.id,
      theme_starter: theme.starter,
      frequency: parsed.schedule.frequency,
      every: parsed.schedule.every,
      starts_on: parsed.schedule.startsOn,
      last_day: parsed.schedule.lastDay === true,
      ends_on: parsed.ending.endsOn,
      max_runs: parsed.ending.maxRuns,
      next_run_on: firstDue(parsed.schedule, today),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "54000") return { status: "error", message: "You can keep up to 25 repeats. Stop one first." };
    if (error?.code === "23503") return { status: "error", message: "That customer isn't on your list any more." };
    console.error("could not start a repeat:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "saved", id: (data as { id: string }).id };
}

/** Changes how often it repeats, from when and until when. What was already made is not touched. */
export async function changeRepeatSchedule(id: string, values: RepeatFormValues): Promise<RepeatResult> {
  const { organisation, profile } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const found = await findRecurrence(id);
  if (!found || found.organisationId !== organisation.id) return { status: "error", message: "That repeat can't be found any more. It may have been stopped." };
  const today = todayIn(getLocalePack(profile.countryCode).timeZone);
  const parsed = parseRepeatForm(values, today, { keepStartsOn: found.schedule?.startsOn });
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .update({
      frequency: parsed.schedule.frequency,
      every: parsed.schedule.every,
      starts_on: parsed.schedule.startsOn,
      last_day: parsed.schedule.lastDay === true,
      ends_on: parsed.ending.endsOn,
      max_runs: parsed.ending.maxRuns,
      next_run_on: firstDue(parsed.schedule, today),
    })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (!error) return { status: "error", message: "That repeat can't be found any more. It may have been stopped." };
    console.error("could not change a repeat's schedule:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "saved", id };
}

/** Changes what it repeats (the items, the customer, the note), for the invoices it makes from now on. */
export async function saveRepeatForm(id: string, form: unknown): Promise<Plain> {
  const { organisation, profile } = await requireOrganisation();
  if (!UUID.test(id) || !isInvoiceDraftForm(form)) return { status: "error", message: GENERIC_ERROR };
  if (form.customerId !== "" && !UUID.test(form.customerId)) return { status: "error", message: "Choose a customer from the list." };
  const locale = getLocalePack(profile.countryCode);
  const checked = checkForToday(form, todayIn(locale.timeZone), locale.documents.invoice.dueDays, vatSettingsFor(profile, locale));
  if (!checked.ok) return { status: "error", message: `Fix this first: ${checked.problem}` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .update({ form, customer_id: form.customerId === "" ? null : form.customerId })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (error?.code === "23503") return { status: "error", message: "That customer isn't on your list. Choose one again." };
    if (!error) return { status: "error", message: "That repeat can't be found any more. It may have been stopped." };
    console.error("could not save what a repeat repeats:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  revalidatePath(`/app/invoices/repeats/${id}`);
  return { status: "ok" };
}

/** Pauses it: nothing is made until it is resumed. */
export async function pauseRepeat(id: string): Promise<Plain> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .update({ paused_at: new Date().toISOString(), paused_reason: null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .is("paused_at", null)
    .select("id");
  if (error || !data) {
    if (error) console.error("could not pause a repeat:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "ok" };
}

/** Resumes it, after checking that what it repeats still makes a good invoice (else it would only pause itself again). */
export async function resumeRepeat(id: string): Promise<Plain> {
  const { organisation, profile } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const found = await findRecurrence(id);
  if (!found || found.organisationId !== organisation.id) return { status: "error", message: "That repeat can't be found any more. It may have been stopped." };
  if (repeatStatus(found) === "finished") return { status: "error", message: "This repeat has finished. Change its schedule to start it again." };
  const locale = getLocalePack(profile.countryCode);
  if (!found.form) return { status: "error", message: "What it repeats can't be read. Open \"Edit what it repeats\" and save it again." };
  const checked = checkForToday(found.form, todayIn(locale.timeZone), locale.documents.invoice.dueDays, vatSettingsFor(profile, locale));
  if (!checked.ok) return { status: "error", message: `Fix this first: ${checked.problem} Open "Edit what it repeats".` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurrences")
    .update({ paused_at: null, paused_reason: null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (error) console.error("could not resume a repeat:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "ok" };
}

/** Stops it for good. The drafts and invoices it already made are left exactly as they are. */
export async function stopRepeat(id: string): Promise<Plain> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurrences").delete().eq("id", id).eq("organisation_id", organisation.id).select("id");
  if (error || !data || data.length !== 1) {
    if (error) console.error("could not stop a repeat:", error.message);
    return { status: "error", message: "Couldn't stop that repeat. It may already be gone." };
  }
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "ok" };
}
