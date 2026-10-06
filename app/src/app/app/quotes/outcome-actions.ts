"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { parseOutcome, type OutcomeErrors, type OutcomeFormValues, type OutcomeKind } from "@/lib/quotes/outcome";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Writing down what happened to a sent quote: the customer said yes or no, the maker withdrew
 * it, or the maker changes their mind about the answer. Like sending, the status change runs
 * ONLY here, on the server: the database function can be called by the server's own key and
 * nobody else (migration 20261011100000_quote_outcomes.sql). The person's own session proves
 * the quote is theirs first.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_SET_UP = "This version of MakerFlow can't record that yet, so nothing was changed. We've been told.";
const KINDS: readonly string[] = ["accepted", "declined", "withdrawn"];

export type OutcomeResult =
  | { status: "done" }
  | { status: "error"; message?: string; errors?: OutcomeErrors };

async function applyOutcome(
  quoteId: string,
  outcome: OutcomeKind | "reopened",
  details: { on: string | null; how: string | null; note: string | null },
): Promise<OutcomeResult> {
  const { organisation, user } = await requireOrganisation();

  // Reading it under the person's own access proves it is a quote of theirs.
  const supabase = await createClient();
  const { data: own } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("organisation_id", organisation.id)
    .maybeSingle();
  if (!own) return { status: "error", message: "That quote could not be found." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("the server key for quote outcomes is missing:", (error as Error).message);
    return { status: "error", message: NOT_SET_UP };
  }
  const { error } = await admin.rpc("record_quote_outcome", {
    p_org: organisation.id,
    p_quote_id: quoteId,
    p_actor: user.id,
    p_outcome: outcome,
    p_on: details.on,
    p_how: details.how,
    p_note: details.note,
  });
  if (error) {
    if (error.code === "P0002") {
      return {
        status: "error",
        message: "This quote has changed since you opened it. Refresh the page to see where it stands.",
      };
    }
    console.error("could not record quote outcome:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/quotes");
  revalidatePath(`/app/quotes/${quoteId}`);
  return { status: "done" };
}

/** They accepted, they declined, or I'm withdrawing it. Only a sent quote can be any of these. */
export async function recordOutcome(
  quoteId: string,
  outcome: OutcomeKind,
  values: OutcomeFormValues,
): Promise<OutcomeResult> {
  const { profile } = await requireOrganisation();
  if (
    !UUID.test(quoteId) ||
    !KINDS.includes(outcome) ||
    typeof values?.on !== "string" ||
    typeof values?.how !== "string" ||
    typeof values?.note !== "string"
  ) {
    return { status: "error", message: GENERIC_ERROR };
  }
  const today = todayIn(getLocalePack(profile.countryCode).timeZone);
  const parsed = parseOutcome(outcome, values, today);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  return applyOutcome(quoteId, outcome, parsed.value);
}

/** Changes an answer: an accepted or declined quote goes back to sent. The earlier answer stays in the log. */
export async function reopenQuote(quoteId: string): Promise<OutcomeResult> {
  if (!UUID.test(quoteId)) return { status: "error", message: GENERIC_ERROR };
  return applyOutcome(quoteId, "reopened", { on: null, how: null, note: null });
}
