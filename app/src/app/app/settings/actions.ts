"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import {
  canEditBusinessProfile,
  parseBusinessProfileForm,
  type FieldErrors,
} from "@/lib/business-profile";
import { createClient } from "@/lib/supabase/server";

export type SaveState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: FieldErrors };

export async function saveBusinessProfile(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const { organisation, role } = await requireOrganisation();

  // The database enforces this too. Checking here gives a clear message.
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change these details." };
  }

  const parsed = parseBusinessProfileForm(formData);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();

  const { data: renamed, error: nameError } = await supabase
    .from("organisations")
    .update({ name: parsed.name })
    .eq("id", organisation.id)
    .select("id");
  if (nameError || !renamed || renamed.length !== 1) {
    console.error("could not save business name:", nameError?.message);
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  const p = parsed.profile;
  const { data: saved, error: profileError } = await supabase
    .from("business_profiles")
    .update({
      phone: p.phone,
      email: p.email,
      address_line1: p.addressLine1,
      address_line2: p.addressLine2,
      city: p.city,
      region: p.region,
      postal_code: p.postalCode,
      vat_registered: p.vatRegistered,
      vat_number: p.vatNumber,
    })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (profileError || !saved || saved.length !== 1) {
    console.error("could not save business profile:", profileError?.message);
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  revalidatePath("/app", "layout");
  return { status: "saved" };
}
