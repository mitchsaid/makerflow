import { addDays, daysBetween, isIsoDay } from "../quotes/dates";
import { parseInvoiceDraft, type InvoiceDraftErrors, type InvoiceDraftForm } from "../invoices/draft";
import type { VatSettings } from "../money";

/**
 * What a repeat does on the day it is due, apart from the database (docs/plans/recurring.md): the new draft's form is the
 * repeat's form with today's date and the same gap to the due day, and it is checked as an invoice first, so a repeat
 * that can no longer make a good invoice is paused with the reason rather than filling the Drafts list with broken ones.
 */

/** The days from the invoice date to the due date that the form carries; the business's usual gap when it carries none. */
export function dueGap(form: Pick<InvoiceDraftForm, "issueDate" | "dueDate">, usualDays: number): number {
  if (!isIsoDay(form.issueDate) || !isIsoDay(form.dueDate)) return usualDays;
  const gap = daysBetween(form.issueDate, form.dueDate);
  return gap >= 0 && gap <= 365 ? gap : usualDays;
}

/** The form for the draft made today. */
export function formForToday(form: InvoiceDraftForm, today: string, usualDays: number): InvoiceDraftForm {
  const gap = dueGap(form, usualDays);
  return { ...form, issueDate: today, dueDate: addDays(today, gap) };
}

/** The first thing wrong with an invoice form, in a sentence a maker can act on. */
export function firstProblem(errors: InvoiceDraftErrors): string {
  const field = Object.values(errors.fields).find((m) => typeof m === "string" && m !== "");
  const line = Object.values(errors.lines)
    .map((e) => e && Object.values(e).find((m) => typeof m === "string" && m !== ""))
    .find(Boolean);
  const text = (field ?? line ?? "It could not be checked.") as string;
  return text;
}

/** The reason a repeat is paused when its form no longer makes a good invoice. */
export function pauseReasonFor(errors: InvoiceDraftErrors): string {
  return `It could not make an invoice: ${firstProblem(errors)} Open "Edit what it repeats" to fix it, then resume.`.slice(0, 300);
}

/** Checks the form for today's draft; the problem is the reason to pause with. */
export function checkForToday(
  form: InvoiceDraftForm,
  today: string,
  usualDays: number,
  vat: VatSettings,
): { ok: true; form: InvoiceDraftForm } | { ok: false; reason: string; problem: string } {
  const made = formForToday(form, today, usualDays);
  const parsed = parseInvoiceDraft(made, vat);
  return parsed.ok ? { ok: true, form: made } : { ok: false, reason: pauseReasonFor(parsed.errors), problem: firstProblem(parsed.errors) };
}
