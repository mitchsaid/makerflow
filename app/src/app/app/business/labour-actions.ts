"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parseLabourRate } from "@/lib/costing/labour-rate";
import { createClient } from "@/lib/supabase/server";

export type LabourSaveState = { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves what an hour of the maker's time is worth (empty: not set). Owners and admins only (the database checks too).
 * Used to cost "Your time" lines on products; changing it changes drafts, never a quote that was sent.
 */
export async function saveLabourRate(input: unknown): Promise<LabourSaveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change this. Ask one of them." };
  }
  const parsed = parseLabourRate(input);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ labour_rate_cents: parsed.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save hourly rate:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
