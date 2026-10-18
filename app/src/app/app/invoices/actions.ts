"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { customerParty } from "@/lib/quotes/snapshot";
import { invoiceProblems, parseInvoiceForm, type InvoiceFormErrors, type InvoiceFormValues, type InvoiceProblem } from "@/lib/invoices";
import { buildInvoiceSnapshot } from "@/lib/invoices/snapshot";
import { findInvoice } from "@/lib/invoices/data";
import { owingCentsOf, paidCentsOf, parsePaymentForm, type PaymentFormErrors, type PaymentFormValues } from "@/lib/invoices/payments";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
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
    businessRegistered: profile.vatRegistered,
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

export type PaymentResult =
  | { status: "done" }
  | { status: "invalid"; errors: PaymentFormErrors }
  | { status: "error"; message: string };

/** Records a payment on an invoice. It can't be changed after; a mistake is reversed. */
export async function recordPayment(invoiceId: string, values: PaymentFormValues): Promise<PaymentResult> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(invoiceId)) return { status: "error", message: "That invoice could not be found." };
  // Read under the person's own session: it proves the invoice is theirs, and gives what is owing right now.
  const invoice = await findInvoice(invoiceId);
  if (!invoice || invoice.organisationId !== organisation.id) return { status: "error", message: "That invoice could not be found." };

  const locale = getLocalePack(profile.countryCode);
  const owingCents = owingCentsOf(invoice.grossCents, paidCentsOf(invoice.payments));
  const parsed = parsePaymentForm(values, {
    owingCents,
    owingText: formatMoney(owingCents, invoice.currencyCode, locale.numberStyle),
    today: todayIn(locale.timeZone),
  });
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("record_invoice_payment", {
    p_org: organisation.id,
    p_invoice_id: invoice.id,
    p_actor: user.id,
    p_amount_cents: parsed.amountCents,
    p_paid_on: parsed.paidOn,
    p_method: parsed.method,
    p_note: parsed.note,
  });
  if (error?.code === "22003") {
    return { status: "invalid", errors: { amount: "That is more than what is owing now. Refresh the page and check the payments." } };
  }
  if (error?.code === "P0002") return { status: "error", message: "That invoice could not be found." };
  if (error) {
    console.error("could not record the payment:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/app/invoices/${invoice.id}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "done" };
}

/** Undoes a payment that was recorded by mistake, with a new entry. The payment stays in the list, marked reversed. */
export async function reversePayment(invoiceId: string, paymentId: string): Promise<PaymentResult> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(invoiceId) || !UUID.test(paymentId)) return { status: "error", message: "That payment could not be found." };
  const invoice = await findInvoice(invoiceId);
  if (!invoice || invoice.organisationId !== organisation.id || !invoice.payments.some((p) => p.id === paymentId)) {
    return { status: "error", message: "That payment could not be found." };
  }

  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("reverse_invoice_payment", {
    p_org: organisation.id,
    p_payment_id: paymentId,
    p_actor: user.id,
    p_on: todayIn(getLocalePack(profile.countryCode).timeZone),
    p_note: null,
  });
  if (error?.code === "23505") return { status: "error", message: "This payment has already been reversed. Refresh the page." };
  if (error?.code === "22023") return { status: "error", message: "That entry can't be reversed. Record the payment again instead." };
  if (error) {
    console.error("could not reverse the payment:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath(`/app/invoices/${invoice.id}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  return { status: "done" };
}

/** The server's own database access, or null (logged) when this server has not been given its key. */
function serverClient() {
  try {
    return createAdminClient();
  } catch (error) {
    console.error("the server key for invoices is missing:", (error as Error).message);
    return null;
  }
}
