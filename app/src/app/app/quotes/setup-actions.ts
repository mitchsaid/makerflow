"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import type { DepositErrors } from "@/lib/quotes/deposit";
import { isSetupAnswers, parseSetupAnswers, type SetupAnswers } from "@/lib/quotes/setup";
import { createClient } from "@/lib/supabase/server";

export type QuoteSetupState =
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: DepositErrors };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const NOT_ALLOWED = "Only owners and admins can change how new quotes start. Ask one of them.";

/**
 * The two setup questions at the first New quote. One update writes the deposit default, the usual
 * hand-over and the "asked" stamp together. Owners and admins only (the database checks too).
 */
export async function saveQuoteSetup(answers: SetupAnswers): Promise<QuoteSetupState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  if (!isSetupAnswers(answers)) return { status: "error", message: GENERIC_ERROR };
  const parsed = parseSetupAnswers(answers);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_profiles")
    .update({ ...parsed.columns, quote_setup_at: new Date().toISOString() })
    .eq("organisation_id", organisation.id)
    // Only the first answer counts: someone who answered in another tab, or changed these under Quotes and
    // invoices, is never overwritten by a card that was open before that.
    .is("quote_setup_at", null);
  if (error) {
    console.error("could not save the quote setup:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  // No row changed: already set up elsewhere, which is what the card was for.
  revalidatePath("/app", "layout");
  return { status: "saved" };
}

/** "Skip for now": nothing changes except that the questions are not asked again. */
export async function skipQuoteSetup(): Promise<QuoteSetupState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const supabase = await createClient();
  const { error } = await supabase
    .from("business_profiles")
    .update({ quote_setup_at: new Date().toISOString() })
    .eq("organisation_id", organisation.id)
    .is("quote_setup_at", null);
  // Already answered in another tab: that is fine.
  if (error) {
    console.error("could not skip the quote setup:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}

export type HandoverDefaultState = { status: "saved" } | { status: "error"; message: string };

/** Quotes and invoices > "Delivery or collection": what a new quote starts with. Owners and admins only. */
export async function saveHandoverDefault(value: unknown): Promise<HandoverDefaultState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  if (value !== "none" && value !== "collection" && value !== "delivery") return { status: "error", message: GENERIC_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ usual_fulfilment: value === "none" ? null : value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the usual hand-over:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
