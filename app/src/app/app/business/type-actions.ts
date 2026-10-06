"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { BUSINESS_TYPE_PROMPT, parseBusinessTypes } from "@/lib/business-types";
import { createClient } from "@/lib/supabase/server";

export type TypesSaveState = { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves what the business makes or sells (an empty list means "skipped"). Owners and admins only
 * (the database checks too). Only used to order examples; nothing else reads it.
 */
export async function saveBusinessTypes(types: unknown): Promise<TypesSaveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change this. Ask one of them." };
  }
  const parsed = parseBusinessTypes(types);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ business_types: parsed.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save business types:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}

/** "Not now" on the prompt that asks what the business makes. Remembered for this person. */
export async function dismissBusinessTypePrompt(): Promise<TypesSaveState> {
  const { organisation, user } = await requireOrganisation();
  const supabase = await createClient();
  const { error } = await supabase.from("prompt_dismissals").insert({
    user_id: user.id,
    organisation_id: organisation.id,
    prompt_key: BUSINESS_TYPE_PROMPT,
  });
  // Already dismissed (a second tab): that is what was asked for.
  if (error && error.code !== "23505") {
    console.error("could not dismiss prompt:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
