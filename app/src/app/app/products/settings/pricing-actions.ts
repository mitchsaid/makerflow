"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parseLabourRate } from "@/lib/costing/labour-rate";
import { parseTargetMargin } from "@/lib/costing/target";
import { createClient } from "@/lib/supabase/server";

export type PricingSaveState =
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: { labourRate?: string; targetMargin?: string } };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves the pricing preferences together: what an hour of the maker's time is worth (costs "Your time" lines on
 * products) and the margin they aim for (says where a price stands, suggests one). Either may be empty: not set.
 * Owners and admins only (the database checks too). Both are checked before either is saved. Changing them changes
 * drafts, never a quote that was sent.
 */
export async function savePricing(input: { labourRate: unknown; targetMargin: unknown }): Promise<PricingSaveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change these. Ask one of them." };
  }
  const rate = parseLabourRate(input.labourRate);
  const margin = parseTargetMargin(input.targetMargin);
  if (!rate.ok || !margin.ok) {
    return {
      status: "error",
      errors: { labourRate: rate.ok ? undefined : rate.error, targetMargin: margin.ok ? undefined : margin.error },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ labour_rate_cents: rate.value, target_margin_bp: margin.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save pricing preferences:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
