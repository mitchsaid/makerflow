"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { isDesignKey, normaliseColour, parseDesignOptions } from "@/lib/quotes/designs";
import { createClient } from "@/lib/supabase/server";

export type LookState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Saves the business's brand colour ("" removes it) and its usual quote design with the changes made
 * to it. Quotes that follow the usual look pick this up while they are drafts; sent versions keep
 * the look they were sent with. Owners and admins only.
 */
export async function saveLook(brandColour: string, design: string, options: unknown): Promise<LookState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change the look of your quotes. Ask one of them." };
  }
  const colour = brandColour === "" ? null : normaliseColour(brandColour);
  if (typeof brandColour !== "string" || (brandColour !== "" && !colour) || !isDesignKey(design)) {
    return { status: "error", message: "That colour isn't one we can use. Pick one from the colour picker." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ brand_color: colour, default_design: design, default_design_options: parseDesignOptions(options) })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the look:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
