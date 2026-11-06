import "server-only";
import { getLocalePack } from "../locale";
import type { LocalePack } from "../locale";
import { createClient } from "../supabase/server";
import { todayIn } from "../quotes/dates";
import type { QuoteSnapshot } from "../quotes/snapshot";
import type { InvoiceDraftForm } from "./draft";
import { invoiceFormFromSnapshot } from "./duplicate";

/**
 * An issued invoice turned back into a form to copy (Duplicate, and Repeat: docs/plans/duplicate.md, docs/plans/recurring.md):
 * read under the person's own session, so another business's invoice is never found, and worked back to a form by the one
 * function that is tested to total what the original did. Money is checked again by the server whenever the copy is used.
 */
export async function formFromInvoice(
  invoiceId: string,
  organisationId: string,
  countryCode: string,
): Promise<{ ok: true; form: InvoiceDraftForm; customerId: string | null } | { ok: false; notFound: boolean; message: string }> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("invoices").select("organisation_id, customer_id, snapshot").eq("id", invoiceId).maybeSingle();
  const found = row as { organisation_id: string; customer_id: string | null; snapshot: QuoteSnapshot } | null;
  if (!found || found.organisation_id !== organisationId) return { ok: false, notFound: true, message: "That invoice could not be found." };
  const locale: LocalePack = getLocalePack(countryCode);
  const copied = invoiceFormFromSnapshot(found.snapshot, {
    customerId: found.customer_id ?? "",
    today: todayIn(locale.timeZone),
    dueDays: locale.documents.invoice.dueDays,
    numberStyle: locale.numberStyle,
  });
  if (!copied.ok) return { ok: false, notFound: false, message: copied.reason };
  return { ok: true, form: copied.form, customerId: found.customer_id };
}
