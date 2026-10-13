"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { isImageId } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export type LogoState = { status: "idle" } | { status: "saved" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Sets (or, with "", removes) the business's logo: the id of a picture that was uploaded as a logo.
 * Owners and admins only. The old picture is not deleted: quotes already sent keep using it.
 */
export async function saveLogo(imageId: string): Promise<LogoState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change the logo. Ask one of them." };
  }
  if (typeof imageId !== "string" || (imageId !== "" && !isImageId(imageId))) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ logo_image_id: imageId === "" ? null : imageId })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error?.code === "23503") {
    return { status: "error", message: "That picture could not be used. Choose it again." };
  }
  if (error || !data || data.length !== 1) {
    console.error("could not save the logo:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
