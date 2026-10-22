"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parseTargetMargin } from "@/lib/costing/target";
import { createClient } from "@/lib/supabase/server";

export type TargetSaveState = { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves the margin the maker aims for (empty: not set). Owners and admins only (the database checks too). It is used to
 * say where a product or a quote stands and to suggest a price; it never changes a price or a sent quote.
 */
export async function saveTargetMargin(input: unknown): Promise<TargetSaveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change this. Ask one of them." };
  }
  const parsed = parseTargetMargin(input);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ target_margin_bp: parsed.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save target margin:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
