"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile, missingForQuote } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { prepareQuote } from "@/lib/quotes/prepare";
import type { SendProblem } from "@/lib/quotes/send-checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { optionalValidated } from "@/lib/form-values";
import { validateEmail, validatePhone } from "@/lib/validation";

/**
 * Sending and revising quotes. Sending runs ONLY here, on the server: the database function
 * that freezes a quote can be called by the server's own key and by nobody else (see migration
 * 20261004100000_quote_issuing.sql). The person's own session proves they may do it (the draft
 * is read under their row-level security) before the server key is used.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "Sending isn't switched on for this version of MakerFlow yet, so nothing was sent. We've been told.";

/** The server's own database access, or null (logged) when this server has not been given its key. */
function serverClient() {
  try {
    return createAdminClient();
  } catch (error) {
    console.error("the server key for sending quotes is missing:", (error as Error).message);
    return null;
  }
}

export type ContactDetails = { canEdit: boolean; phone: string; email: string };

/** What the send sheet shows: what is missing, or the quote ready to send. */
export type SendSheetState =
  | { status: "problems"; problems: SendProblem[]; contact: ContactDetails }
  | {
      status: "ready";
      number: string;
      version: number;
      customerName: string;
      totalText: string;
    }
  | { status: "error"; message: string };

export type SendResult =
  | { status: "sent"; number: string; version: number }
  | { status: "problems"; problems: SendProblem[]; contact: ContactDetails }
  | { status: "error"; message: string };

/** Looks at the SAVED draft and says what stops it being sent, or that it is ready. */
export async function checkQuoteForSending(quoteId: string): Promise<SendSheetState> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };

  const prepared = await prepareQuote(quoteId, workspace);
  if (!prepared.ok) {
    return {
      status: "error",
      message:
        prepared.reason === "not-found"
          ? "That quote could not be found."
          : "This quote could not be read. Save it again and try once more.",
    };
  }
  const { stored, problems, snapshot, customerName } = prepared.value;
  if (stored.status !== "draft") {
    return { status: "error", message: "This quote has already been sent." };
  }
  const { profile, role } = workspace;
  if (problems.length > 0) {
    return {
      status: "problems",
      problems,
      contact: {
        canEdit: canEditBusinessProfile(role),
        phone: profile.phone ?? "",
        email: profile.email ?? "",
      },
    };
  }
  const locale = getLocalePack(profile.countryCode);
  return {
    status: "ready",
    number: stored.number,
    version: stored.version,
    customerName: customerName ?? "",
    totalText: formatMoney(snapshot.totals.grossCents, profile.currencyCode, locale.numberStyle),
  };
}

/**
 * Sends the saved draft: checks it again, freezes it as the next version with its snapshot,
 * and records how it was sent. "shared" means the person is sharing or downloading the PDF
 * from the app; "marked" means they sent it some other way.
 */
export async function sendQuote(quoteId: string, via: "shared" | "marked"): Promise<SendResult> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId) || (via !== "shared" && via !== "marked")) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const prepared = await prepareQuote(quoteId, workspace);
  if (!prepared.ok) return { status: "error", message: "That quote could not be found." };
  const { stored, parsed, snapshot, problems } = prepared.value;
  if (stored.status !== "draft") return { status: "error", message: "This quote has already been sent." };
  if (problems.length > 0) {
    const { profile, role } = workspace;
    return {
      status: "problems",
      problems,
      contact: { canEdit: canEditBusinessProfile(role), phone: profile.phone ?? "", email: profile.email ?? "" },
    };
  }

  // The person's session has proved the draft is theirs to send. From here the server key acts.
  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("send_quote", {
    p_org: workspace.organisation.id,
    p_quote_id: stored.id,
    p_actor: workspace.user.id,
    p_via: via,
    p_expected_updated_at: stored.updatedAt,
    p_snapshot: snapshot,
    p_net_cents: parsed.totals.netCents,
    p_vat_cents: parsed.totals.vatCents,
    p_gross_cents: parsed.totals.grossCents,
  });
  if (error) {
    if (error.code === "40001") {
      return {
        status: "error",
        message: "This quote was changed while it was being sent. Check it and send it again.",
      };
    }
    if (error.code === "P0002") return { status: "error", message: "This quote has already been sent." };
    console.error("could not send quote:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${stored.id}`);
  return { status: "sent", number: stored.number, version: stored.version };
}

/** Turns a sent quote back into an editable draft: the next version, the same number. */
export async function reviseQuote(quoteId: string): Promise<{ status: "error"; message: string }> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };

  // Reading it under the person's own access proves it is a quote of theirs.
  const supabase = await createClient();
  const { data: own } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("organisation_id", workspace.organisation.id)
    .maybeSingle();
  if (!own) return { status: "error", message: "That quote could not be found." };

  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("revise_quote", {
    p_org: workspace.organisation.id,
    p_quote_id: quoteId,
    p_actor: workspace.user.id,
  });
  if (error) {
    if (error.code === "P0002") {
      return { status: "error", message: "Only a quote that has been sent can be revised." };
    }
    console.error("could not revise quote:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${quoteId}`);
}

export type ContactState =
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: { phone?: string; email?: string } };

/**
 * The send sheet's way to give the business a phone number or email. It updates the Business
 * profile (the one place these facts live) and only those two fields; owners and admins only.
 */
export async function saveBusinessContact(values: { phone: string; email: string }): Promise<ContactState> {
  const { organisation, role, profile } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change the business details. Ask one of them to add a phone number or email." };
  }
  if (typeof values?.phone !== "string" || typeof values?.email !== "string") {
    return { status: "error", message: GENERIC_ERROR };
  }

  const errors: { phone?: string; email?: string } = {};
  const phone = optionalValidated(values.phone, validatePhone);
  if (!phone.ok) errors.phone = phone.error;
  const email = optionalValidated(values.email, validateEmail);
  if (!email.ok) errors.email = email.error;
  if (Object.keys(errors).length > 0 || !phone.ok || !email.ok) return { status: "error", errors };

  const locale = getLocalePack(profile.countryCode);
  if (missingForQuote({ ...profile, phone: phone.value, email: email.value }, locale).length > 0) {
    return { status: "error", errors: { phone: "Add a phone number or an email so customers can reach you." } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ phone: phone.value, email: email.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save contact details:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
