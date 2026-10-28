"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation, type Workspace } from "@/lib/auth/dal";
import { blankInvoiceForm, differsFromQuote, isInvoiceDraftForm, type InvoiceDraftErrors } from "@/lib/invoices/draft";
import { findInvoiceDraft } from "@/lib/invoices/draft-data";
import { parseInvoiceForm, type InvoiceFormErrors, type InvoiceFormValues, type InvoiceProblem } from "@/lib/invoices";
import { prepareInvoiceDraft } from "@/lib/invoices/prepare-draft";
import { findJob } from "@/lib/jobs/data";
import { findStoredQuote } from "@/lib/quotes/data";
import { toFormValues } from "@/lib/quotes/form-values";
import { getLocalePack } from "@/lib/locale";
import { quantityToInput } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Invoice drafts (docs/plans/invoice-i3.md): keeping one, discarding it, and issuing it. A draft is private working
 * state that any member of the business can keep under their own session; ISSUING runs only here, on the server: the
 * database function that gives the number and freezes the invoice can be called by the server's own key and nobody else
 * (migration 20261119100000_invoice_drafts.sql). Every total is worked out here from the saved form, never taken from
 * the browser.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "Invoices aren't switched on for this version of MakerFlow yet, so nothing was issued. We've been told.";

export type SaveDraftResult =
  | { status: "saved"; draftId: string; savedAt: number }
  | { status: "error"; message: string };

type Saved = { ok: true; id: string } | { ok: false; message: string };

/** Writes the form to the draft (a new one when there is no id yet), under the person's own session. */
async function writeDraft(draftId: string | null, form: unknown): Promise<Saved> {
  const { organisation, user } = await requireOrganisation();
  if (draftId !== null && !UUID.test(draftId)) return { ok: false, message: GENERIC_ERROR };
  if (!isInvoiceDraftForm(form)) return { ok: false, message: GENERIC_ERROR };
  if (form.customerId !== "" && !UUID.test(form.customerId)) return { ok: false, message: "Choose a customer from the list." };

  const supabase = await createClient();
  const customerId = form.customerId === "" ? null : form.customerId;
  if (draftId === null) {
    const { data, error } = await supabase
      .from("invoice_drafts")
      .insert({ organisation_id: organisation.id, customer_id: customerId, form, created_by: user.id })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "54000") return { ok: false, message: "You can keep up to 100 invoice drafts. Issue or discard one first." };
      if (error?.code === "23503") return { ok: false, message: "That customer isn't on your list. Choose one again." };
      console.error("could not save invoice draft:", error?.code, error?.message);
      return { ok: false, message: GENERIC_ERROR };
    }
    return { ok: true, id: (data as { id: string }).id };
  }
  const { data, error } = await supabase
    .from("invoice_drafts")
    .update({ customer_id: customerId, form })
    .eq("id", draftId)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    if (error?.code === "23503") return { ok: false, message: "That customer isn't on your list. Choose one again." };
    if (!error) return { ok: false, message: "This draft can't be found any more. It may have been issued or discarded." };
    console.error("could not save invoice draft:", error.code, error.message);
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true, id: draftId };
}

/** Saves the draft. The items may still be incomplete: a draft is for parking work. Issuing is what checks everything. */
export async function saveInvoiceDraft(draftId: string | null, form: unknown, options: { stay?: boolean } = {}): Promise<SaveDraftResult> {
  const saved = await writeDraft(draftId, form);
  if (!saved.ok) return { status: "error", message: saved.message };
  // A new draft opens on its own page; one that is already open stays where it is (and so does one made as the first
  // step of issuing, which carries on from the id it gets back).
  if (draftId === null && !options.stay) {
    revalidatePath("/app/invoices");
    redirect(`/app/invoices/drafts/${saved.id}?saved=1`);
  }
  // The first step of issuing renews nothing: the page is about to be given the draft's address without leaving, and a
  // refreshed page arriving after that would start it over and lose what the issuing step is about to say.
  if (draftId === null) return { status: "saved", draftId: saved.id, savedAt: Date.now() };
  revalidatePath("/app/invoices");
  revalidatePath(`/app/invoices/drafts/${saved.id}`);
  return { status: "saved", draftId: saved.id, savedAt: Date.now() };
}

export type DiscardResult = { status: "error"; message: string };

/** Discards a draft (a draft is not a tax document). An issued invoice can never be discarded. */
export async function discardInvoiceDraft(draftId: string): Promise<DiscardResult> {
  const { organisation } = await requireOrganisation();
  if (!UUID.test(draftId)) redirect("/app/invoices");
  const supabase = await createClient();
  const { data, error } = await supabase.from("invoice_drafts").delete().eq("id", draftId).eq("organisation_id", organisation.id).select("id");
  if (error || !data || data.length !== 1) {
    console.error("could not discard invoice draft:", error?.message);
    return { status: "error", message: "Couldn't discard that draft. It may already be gone, or it was issued." };
  }
  revalidatePath("/app/invoices");
  redirect("/app/invoices?show=drafts");
}

export type IssueDraftResult =
  | { status: "error"; message: string; draftId?: string }
  | { status: "invalid"; errors: InvoiceDraftErrors; draftId: string }
  | { status: "problems"; problems: InvoiceProblem[]; draftId: string };

/**
 * Checks the kept draft as an invoice and issues it: the next number, a document that never changes. Returns only when
 * something stopped it; success opens the invoice. It is the preview's button: what the maker has just looked at is what
 * is issued, because the preview is drawn from the same kept draft (`prepareInvoiceDraft`), and a draft that exists
 * before it is issued means trying again after a lost reply cannot issue a second invoice.
 */
export async function issueStoredInvoiceDraft(draftId: string): Promise<IssueDraftResult> {
  const workspace = await requireOrganisation();
  if (!UUID.test(draftId)) return { status: "error", message: GENERIC_ERROR };
  return issueStored(workspace, draftId);
}

async function issueStored(workspace: Workspace, id: string): Promise<IssueDraftResult> {
  const { organisation, user } = workspace;

  // Read back under the person's own session: it proves the draft is theirs, and notes when it was last changed.
  const stored = await findInvoiceDraft(id);
  if (!stored || stored.organisationId !== organisation.id || !stored.form) {
    return { status: "error", message: "This draft can't be found any more. It may have been issued or discarded.", draftId: id };
  }

  const prepared = await prepareInvoiceDraft(
    stored.form,
    workspace,
    stored.quoteNumber ? { number: stored.quoteNumber, theme: stored.quoteTheme } : null,
  );
  if (!prepared.ok) return { status: "invalid", errors: prepared.errors, draftId: id };
  if (prepared.value.problems.length > 0) return { status: "problems", problems: prepared.value.problems, draftId: id };

  // Made from a quote: is it still the quote as agreed, or changed? (Said on the invoice, truthfully.)
  let adjusted = true;
  if (stored.quoteId) {
    const quote = await findStoredQuote(stored.quoteId);
    const agreed = quote?.versions[0];
    if (!quote || quote.organisationId !== organisation.id || quote.status !== "accepted" || !agreed || agreed.version !== stored.quoteVersion) {
      return { status: "error", message: "The quote has changed since this draft was started, so it can't be issued. Discard the draft and start again from the quote.", draftId: id };
    }
    adjusted = differsFromQuote(prepared.value.snapshot, agreed.snapshot);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("the server key for invoices is missing:", (error as Error).message);
    return { status: "error", message: NOT_SET_UP, draftId: id };
  }
  const { data, error } = await admin.rpc("issue_invoice_from_draft", {
    p_org: organisation.id,
    p_draft_id: id,
    p_actor: user.id,
    p_customer_id: prepared.value.customerId,
    p_adjusted: adjusted,
    p_expected_updated_at: stored.stamp,
    p_issue_date: prepared.value.issueDate,
    p_due_date: prepared.value.dueDate,
    p_note: prepared.value.note,
    p_snapshot: prepared.value.snapshot,
    p_reference_label: prepared.value.referenceLabel,
  });
  if (error?.code === "40001") {
    return { status: "error", message: "This draft was changed while it was being issued. Check it and issue it again.", draftId: id };
  }
  if (error?.code === "23505") {
    return { status: "error", message: "This quote already has an invoice. Discard this draft and open that invoice.", draftId: id };
  }
  if (error?.code === "P0002") {
    return { status: "error", message: "This draft can't be issued any more: it was issued or discarded, or its quote is no longer accepted or has changed. Refresh the page.", draftId: id };
  }
  if (error?.code === "22023" || error?.code === "23514") {
    return { status: "error", message: "This invoice could not be made: check the items, the customer and the dates.", draftId: id };
  }
  const invoiceId = (data as { id?: unknown } | null)?.id;
  if (error || typeof invoiceId !== "string") {
    console.error("could not issue the invoice from a draft:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR, draftId: id };
  }

  revalidatePath("/app/invoices");
  revalidatePath("/app", "layout");
  if (stored.quoteId) revalidatePath(`/app/quotes/${stored.quoteId}`);
  redirect(`/app/invoices/${invoiceId}`);
}

/**
 * Starts an invoice for a finished job that was made by hand: the customer and the items (names, quantities and
 * details; no prices), ready for the prices to be filled in. Opens the new draft.
 */
export async function startInvoiceFromJob(jobId: string): Promise<{ status: "error"; message: string }> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(jobId)) return { status: "error", message: "That job could not be found." };
  const job = await findJob(jobId);
  if (!job || job.organisationId !== organisation.id) return { status: "error", message: "That job could not be found." };
  if (job.quoteId) return { status: "error", message: "This job was made from a quote. Invoice the quote instead." };
  if (job.status !== "done") return { status: "error", message: "Finish the job first, then start its invoice." };

  const locale = getLocalePack(profile.countryCode);
  const form = {
    ...blankInvoiceForm({ today: todayIn(locale.timeZone), dueDays: locale.documents.invoice.dueDays, customerId: job.customerId ?? "" }),
    lines: job.fullItems.map((item) => ({
      key: crypto.randomUUID(),
      kind: "custom" as const,
      productId: "",
      name: item.name,
      description: item.description ?? "",
      quantity: quantityToInput(item.quantityMilli, locale.numberStyle),
      unit: item.unit ?? "",
      unitPrice: "",
      discountKind: "none" as const,
      discountValue: "",
    })),
  };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoice_drafts")
    .insert({ organisation_id: organisation.id, customer_id: job.customerId, form, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "54000") return { status: "error", message: "You can keep up to 100 invoice drafts. Issue or discard one first." };
    console.error("could not start an invoice from a job:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  redirect(`/app/invoices/drafts/${(data as { id: string }).id}`);
}

type Started = { ok: true; id: string } | { ok: false; message: string };

/**
 * A draft invoice that starts as the accepted quote was agreed (its customer, items, delivery, discount and note). A quote
 * has at most one draft, so asking again reopens the one in progress. With `chosen` (what the Create invoice sheet
 * asked: the dates and a note) those go into the draft, new or reopened; the items stay as they are.
 */
async function draftFromQuote(quoteId: string, chosen?: { issueDate: string; dueDate: string; note: string | null }): Promise<Started> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(quoteId)) return { ok: false, message: "That quote could not be found." };
  const stored = await findStoredQuote(quoteId);
  if (!stored || stored.organisationId !== organisation.id) return { ok: false, message: "That quote could not be found." };
  if (stored.invoice) return { ok: false, message: "This quote already has an invoice. Refresh the page to see it." };
  if (stored.status !== "accepted" || stored.versions.length === 0) {
    return { ok: false, message: "Only an accepted quote can be invoiced. Refresh the page to see where it stands." };
  }

  const supabase = await createClient();
  const version = stored.versions[0].version;
  const { data: existing } = await supabase.from("invoice_drafts").select("id, quote_version, form").eq("quote_id", quoteId).eq("organisation_id", organisation.id).maybeSingle();
  if (existing) {
    const draft = existing as { id: string; quote_version: number | null; form: unknown };
    // A draft that started from an older version of the quote (it was reopened and sent again) is stale: start afresh.
    if (draft.quote_version === version) {
      if (chosen && isInvoiceDraftForm(draft.form)) {
        const form = { ...draft.form, issueDate: chosen.issueDate, dueDate: chosen.dueDate, notes: chosen.note ?? draft.form.notes };
        const { error } = await supabase.from("invoice_drafts").update({ form }).eq("id", draft.id).eq("organisation_id", organisation.id);
        if (error) {
          console.error("could not update the invoice draft:", error.code, error.message);
          return { ok: false, message: GENERIC_ERROR };
        }
      }
      return { ok: true, id: draft.id };
    }
    await supabase.from("invoice_drafts").delete().eq("id", draft.id).eq("organisation_id", organisation.id);
  }

  const locale = getLocalePack(profile.countryCode);
  const asQuoted = toFormValues(stored, locale.numberStyle);
  const blank = blankInvoiceForm({ today: todayIn(locale.timeZone), dueDays: locale.documents.invoice.dueDays, customerId: stored.customerId ?? "" });
  const form = {
    ...blank,
    issueDate: chosen?.issueDate ?? blank.issueDate,
    dueDate: chosen?.dueDate ?? blank.dueDate,
    lines: asQuoted.lines,
    fulfilment: asQuoted.fulfilment,
    deliveryFee: asQuoted.deliveryFee,
    deliveryAddress: asQuoted.deliveryAddress,
    discountKind: asQuoted.discountKind,
    discountValue: asQuoted.discountValue,
    notes: chosen?.note ?? asQuoted.notes,
    showPhotos: asQuoted.showPhotos,
  };
  const { data, error } = await supabase
    .from("invoice_drafts")
    .insert({ organisation_id: organisation.id, quote_id: quoteId, quote_version: version, customer_id: stored.customerId ?? null, form, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, message: "This quote already has an invoice draft. Refresh the page." };
    if (error?.code === "54000") return { ok: false, message: "You can keep up to 100 invoice drafts. Issue or discard one first." };
    console.error("could not start an invoice from a quote:", error?.code, error?.message);
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/app/invoices");
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * "Adjust before issuing" on an accepted quote: a draft invoice that starts as the quote was agreed, to change before it
 * is issued. The quote itself is left as it is. Opens the draft.
 */
export async function startInvoiceFromQuote(quoteId: string): Promise<{ status: "error"; message: string }> {
  const started = await draftFromQuote(quoteId);
  if (!started.ok) return { status: "error", message: started.message };
  redirect(`/app/invoices/drafts/${started.id}`);
}

export type PreviewFromQuoteResult = { status: "error"; message: string } | { status: "invalid"; errors: InvoiceFormErrors };

/**
 * "Continue to preview" on an accepted quote's Create invoice sheet: the dates and the note are checked, a draft is made
 * from the quote as agreed (or the one in progress is given those dates and note), and the preview opens. Nothing is
 * issued here: the preview is where that happens, so the maker sees the invoice first.
 */
export async function previewInvoiceFromQuote(quoteId: string, values: InvoiceFormValues): Promise<PreviewFromQuoteResult> {
  const parsed = parseInvoiceForm(values);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
  const started = await draftFromQuote(quoteId, { issueDate: parsed.issueDate, dueDate: parsed.dueDate, note: parsed.note });
  if (!started.ok) return { status: "error", message: started.message };
  redirect(`/app/invoices/drafts/${started.id}/preview`);
}
