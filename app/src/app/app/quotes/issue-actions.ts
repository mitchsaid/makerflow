"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import { missingForQuote } from "@/lib/business-profile";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { getProducts } from "@/lib/products/data";
import { isQuoteFormValues } from "@/lib/quotes";
import { findStoredQuote } from "@/lib/quotes/data";
import { toFormValues } from "@/lib/quotes/form-values";
import { costingForSending, prepareQuote } from "@/lib/quotes/prepare";
import type { SendProblem } from "@/lib/quotes/send-checks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { saveQuoteDraft } from "./actions";

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

/** What the send sheet shows: what is missing, or the quote ready to send. */
export type SendSheetState =
  | { status: "problems"; problems: SendProblem[] }
  | {
      status: "ready";
      number: string;
      version: number;
      customerName: string;
      totalText: string;
      /** The business has no phone number or email to show on the quote: said on the confirmation, not a blocker. */
      noContact: boolean;
    }
  | { status: "error"; message: string };

export type SendResult =
  | { status: "sent"; number: string; version: number }
  | { status: "problems"; problems: SendProblem[] }
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
  const { profile } = workspace;
  if (problems.length > 0) return { status: "problems", problems };
  const locale = getLocalePack(profile.countryCode);
  return {
    status: "ready",
    number: stored.number,
    version: stored.version,
    customerName: customerName ?? "",
    totalText: formatMoney(snapshot.totals.grossCents, profile.currencyCode, locale.numberStyle),
    noContact: missingForQuote(profile, locale).length > 0,
  };
}

/**
 * Marks the saved draft as sent: checks it again and freezes it as the next version with its snapshot. It is
 * recorded as "marked" (the person sent it some other way). Versions sent while the app still shared the PDF from
 * the send sheet are recorded as "shared", and are still read that way.
 */
export async function sendQuote(quoteId: string): Promise<SendResult> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const prepared = await prepareQuote(quoteId, workspace);
  if (!prepared.ok) return { status: "error", message: "That quote could not be found." };
  const { stored, parsed, snapshot, problems } = prepared.value;
  if (stored.status !== "draft") return { status: "error", message: "This quote has already been sent." };
  if (problems.length > 0) return { status: "problems", problems };

  // What it costs to make, worked out from the products and materials as they are now and frozen with the version.
  // (A private nicety must never stop a quote going out: without it the version just has no margin recorded.)
  const costing = await costingForSending(parsed, workspace).catch((error: unknown) => {
    console.error("could not work out what the quote costs to make:", (error as Error).message);
    return null;
  });

  // The person's session has proved the draft is theirs to send. From here the server key acts.
  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("send_quote", {
    p_org: workspace.organisation.id,
    p_quote_id: stored.id,
    p_actor: workspace.user.id,
    p_via: "marked",
    p_expected_updated_at: stored.updatedAt,
    p_snapshot: snapshot,
    p_net_cents: parsed.totals.netCents,
    p_vat_cents: parsed.totals.vatCents,
    p_gross_cents: parsed.totals.grossCents,
    // The maker's private figures, kept beside the snapshot and never inside it.
    p_costing: costing,
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

/**
 * Turns a sent quote back into an editable draft: the next version, the same number. The quote as it
 * was sent is kept with the "revised" entry in the activity log, so the revision can be discarded.
 */
export async function reviseQuote(quoteId: string): Promise<{ status: "error"; message: string }> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };

  // Reading it under the person's own access proves it is a quote of theirs.
  const own = await findStoredQuote(quoteId);
  if (!own || own.organisationId !== workspace.organisation.id) {
    return { status: "error", message: "That quote could not be found." };
  }
  // A sent quote's rows are exactly what was sent, so this is the copy to go back to.
  const base = own.status === "sent" ? toFormValues(own, getLocalePack(workspace.profile.countryCode).numberStyle) : null;

  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };
  const { error } = await admin.rpc("revise_quote", {
    p_org: workspace.organisation.id,
    p_quote_id: quoteId,
    p_actor: workspace.user.id,
    p_base: base,
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

/**
 * Drops a revision: the draft is put back exactly as the sent version was (saved the ordinary way,
 * so it is checked and priced like any save), then the quote returns to Sent at that version. The
 * sent versions are never touched.
 */
export async function discardRevision(quoteId: string): Promise<{ status: "error"; message: string }> {
  const workspace = await requireOrganisation();
  if (!UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };

  const quote = await findStoredQuote(quoteId);
  if (!quote || quote.organisationId !== workspace.organisation.id) {
    return { status: "error", message: "That quote could not be found." };
  }
  if (quote.status !== "draft" || quote.version < 2 || !quote.canDiscardRevision) {
    return { status: "error", message: "This quote has no revision that can be discarded." };
  }

  // The latest copy kept when this version was started.
  const supabase = await createClient();
  const { data: started } = await supabase
    .from("quote_events")
    .select("base")
    .eq("quote_id", quoteId)
    .eq("organisation_id", workspace.organisation.id)
    .eq("kind", "revised")
    .eq("version", quote.version)
    .not("base", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = started?.base as unknown;
  if (!isQuoteFormValues(base)) return { status: "error", message: "This revision can't be discarded." };

  // An item from a product that has since been removed stays as a one-off item.
  const products = new Set((await getProducts()).filter((p) => p.organisationId === workspace.organisation.id).map((p) => p.id));
  const restored = {
    ...base,
    lines: base.lines.map((l) => (l.productId && !products.has(l.productId) ? { ...l, productId: "", kind: "custom" as const } : l)),
  };

  // The server key first: nothing is put back unless the move back can follow.
  const admin = serverClient();
  if (!admin) return { status: "error", message: NOT_SET_UP };

  const saved = await saveQuoteDraft(quoteId, restored);
  if (saved.status !== "saved") {
    if (saved.status === "error" && saved.errors) console.error("could not restore a sent version:", JSON.stringify(saved.errors));
    return {
      status: "error",
      message: "Couldn't put version " + (quote.version - 1) + " back, so nothing was discarded. Your revision is still here.",
    };
  }

  // The draft as it stands right after the restore; the move back only happens if nobody saved it since.
  const after = await findStoredQuote(quoteId);
  if (!after) return { status: "error", message: GENERIC_ERROR };
  const { error } = await admin.rpc("discard_quote_revision", {
    p_org: workspace.organisation.id,
    p_quote_id: quoteId,
    p_actor: workspace.user.id,
    p_expected_updated_at: after.updatedAt,
  });
  if (error) {
    if (error.code === "40001") {
      return { status: "error", message: "This quote was changed while it was being discarded. Check it and try again." };
    }
    if (error.code === "P0002") return { status: "error", message: "This quote has no revision that can be discarded." };
    console.error("could not discard revision:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
  redirect(`/app/quotes/${quoteId}`);
}
