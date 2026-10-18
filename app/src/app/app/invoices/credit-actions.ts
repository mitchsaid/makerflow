"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import {
  creditItemsOf,
  parseCreditForm,
  remainingItems,
  type CreditFormErrors,
  type CreditFormValues,
} from "@/lib/credit-notes";
import { buildCreditNoteSnapshot } from "@/lib/credit-notes/snapshot";
import { findInvoice } from "@/lib/invoices/data";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
import { quantityText } from "@/lib/quotes/units";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Issuing a credit note on an invoice. Like issuing the invoice, it runs ONLY here, on the server: the database function
 * that gives the number and freezes the credit note can be called by the server's own key and nobody else (migration
 * 20261117100000_credit_notes.sql). The person's own session proves the invoice is theirs first.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "Credit notes aren't switched on for this version of MakerFlow yet, so nothing was issued. We've been told.";

export type IssueCreditNoteResult =
  | { status: "error"; message: string }
  | { status: "invalid"; errors: CreditFormErrors };

/** Issues the credit note and opens it. Returns only when something stopped it. */
export async function issueCreditNote(invoiceId: string, values: CreditFormValues): Promise<IssueCreditNoteResult> {
  const { organisation, profile, user } = await requireOrganisation();
  if (!UUID.test(invoiceId)) return { status: "error", message: "That invoice could not be found." };

  // Read under the person's own session: it proves the invoice is theirs, and gives what the earlier notes took off.
  const invoice = await findInvoice(invoiceId);
  if (!invoice || invoice.organisationId !== organisation.id) return { status: "error", message: "That invoice could not be found." };

  const locale = getLocalePack(profile.countryCode);
  const style = invoice.snapshot.numberStyle ?? locale.numberStyle;
  const items = creditItemsOf(invoice.snapshot);
  const prior = invoice.creditNotes.flatMap((c) => c.lines);
  const remaining = remainingItems(items, prior);
  if (remaining.every((r) => r.amountLeftCents <= 0) || invoice.creditNotes.reduce((s, c) => s + c.grossCents, 0) >= invoice.grossCents) {
    return { status: "error", message: "Everything on this invoice has been credited already." };
  }

  const parsed = parseCreditForm(values, {
    remaining,
    invoiceDate: invoice.issueDate,
    today: todayIn(locale.timeZone),
    money: (cents) => formatMoney(cents, invoice.currencyCode, style),
    quantity: (milli, unit) => quantityText(milli, unit, style, " "),
  });
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  const { snapshot } = buildCreditNoteSnapshot({
    invoice: invoice.snapshot,
    invoiceNumber: invoice.number,
    invoiceDate: invoice.issueDate,
    issueDate: parsed.issueDate,
    reason: parsed.reason,
    explanation: parsed.explanation,
    items,
    lines: parsed.lines,
    priorGroups: invoice.creditNotes.flatMap((c) => c.groups),
    locale,
  });

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("the server key for credit notes is missing:", (error as Error).message);
    return { status: "error", message: NOT_SET_UP };
  }
  const { data, error } = await admin.rpc("issue_credit_note", {
    p_org: organisation.id,
    p_invoice_id: invoice.id,
    p_actor: user.id,
    p_issue_date: parsed.issueDate,
    p_reason: parsed.reason,
    p_explanation: parsed.explanation,
    p_lines: parsed.lines.map((l) => {
      const item = items.find((i) => i.index === l.index)!;
      return {
        index: l.index,
        quantityMilli: l.quantityMilli,
        amountCents: l.amountCents,
        limitQuantityMilli: item.quantityMilli,
        limitAmountCents: item.amountCents,
      };
    }),
    p_snapshot: snapshot,
  });
  if (error?.code === "22003") {
    return { status: "invalid", errors: { lines: "That is more than is left to credit. Refresh the page to see what is left." } };
  }
  if (error?.code === "P0002") return { status: "error", message: "That invoice could not be found." };
  if (error?.code === "22023") {
    return { status: "error", message: "This credit note could not be made: check the day and the items, then try again." };
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (error || typeof id !== "string") {
    console.error("could not issue the credit note:", error?.code, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath(`/app/invoices/${invoice.id}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app");
  redirect(`/app/credit-notes/${id}`);
}
