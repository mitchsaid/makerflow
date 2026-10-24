"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export type HandoverDefaultState = { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const NOT_ALLOWED = "Only owners and admins can change how new quotes start. Ask one of them.";

/** Quote settings > "Delivery or collection": what a new quote starts with. Owners and admins only. */
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
