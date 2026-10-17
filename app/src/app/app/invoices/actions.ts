"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { customerParty } from "@/lib/quotes/snapshot";
import { invoiceProblems, parseInvoiceForm, type InvoiceFormErrors, type InvoiceFormValues, type InvoiceProblem } from "@/lib/invoices";
import { buildInvoiceSnapshot } from "@/lib/invoices/snapshot";
import { findStoredQuote } from "@/lib/quotes/data";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Issuing an invoice from an accepted quote. Like sending a quote, it runs ONLY here, on the server: the database
 * function that gives the number and freezes the invoice can be called by the server's own key and nobody else
 * (migration 20261115100000_invoices.sql). The person's own session proves the quote is theirs first.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "Invoices aren't switched on for this version of MakerFlow yet, so nothing was issued. We've been told.";

export type IssueInvoiceResult =
  | { status: "error"; message: string }
  | { status: "invalid"; errors: InvoiceFormErrors }
  | { status: "problems"; problems: InvoiceProblem[] };

/** Issues the invoice for an accepted quote and opens it. Returns only when something stopped it. */
export async function issueInvoice(quoteId: string, values: InvoiceFormValues): Promise<IssueInvoiceResult> {
  const workspace = await requireOrganisation();
  const { organisation, profile, user } = workspace;
  if (!UUID.test(quoteId)) return { status: "error", message: "That quote could not be found." };

  const parsed = parseInvoiceForm(values);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const stored = await findStoredQuote(quoteId);
  if (!stored || stored.organisationId !== organisation.id) return { status: "error", message: "That quote could not be found." };
  if (stored.invoice) return { status: "error", message: "This quote already has an invoice. Refresh the page to see it." };
  const version = stored.versions[0];
  if (stored.status !== "accepted" || !version) {
    return { status: "error", message: "Only an accepted quote can be invoiced. Refresh the page to see where it stands." };
  }

  const locale = getLocalePack(profile.countryCode);
  const customer = stored.customer && stored.customer.organisationId === organisation.id ? stored.customer : null;
  const problems = invoiceProblems({
    business: profile,
    customer: customer ? customerParty(customer, locale) : version.snapshot.customer,
    grossCents: version.snapshot.totals.grossCents,
    taxRegistered: version.snapshot.vat.registered,
    locale,
  });
  if (problems.length > 0) return { status: "problems", problems };

  const { snapshot, referenceLabel } = buildInvoiceSnapshot({
    version: version.snapshot,
    issueDate: parsed.issueDate,
    dueDate: parsed.dueDate,
    note: parsed.note,
    locale,
    business: { name: organisation.name, ...profile },
    customer,
    bank: workspace.bankDetails,
  });

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("the server key for invoices is missing:", (error as Error).message);
    return { status: "error", message: NOT_SET_UP };
  }
  const { data, error } = await admin.rpc("issue_invoice", {
    p_org: organisation.id,
    p_quote_id: stored.id,
    p_actor: user.id,
    p_issue_date: parsed.issueDate,
    p_due_date: parsed.dueDate,
    p_note: parsed.note,
    p_snapshot: snapshot,
    p_reference_label: referenceLabel,
  });
  if (error?.code === "23505") {
    return { status: "error", message: "This quote already has an invoice. Refresh the page to see it." };
  }
  if (error?.code === "P0002") {
    return { status: "error", message: "This quote has changed since you opened it. Refresh the page to see where it stands." };
  }
  if (error?.code === "22023") {
    return { status: "error", message: "This invoice could not be made: check the dates and that the quote has a customer." };
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (error || typeof id !== "string") {
    console.error("could not issue the invoice:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/invoices");
  revalidatePath(`/app/quotes/${stored.id}`);
  redirect(`/app/invoices/${id}`);
}
