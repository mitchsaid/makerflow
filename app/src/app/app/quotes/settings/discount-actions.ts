"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { discountFrom } from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export type DiscountDefaultValues = { kind: "none" | "percent" | "fixed"; value: string };
export type DiscountDefaultState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: { discountValue?: string } };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Sets the discount on the whole quote that a new quote starts with (none, a percentage, or an amount): from Quotes
 * and invoices, or "Save as my usual" on a quote. Owners and admins only; each quote can change it or take it off.
 */
export async function saveDiscountDefault(values: DiscountDefaultValues): Promise<DiscountDefaultState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change what new quotes start with. Ask one of them." };
  }
  if (!values || (values.kind !== "none" && values.kind !== "percent" && values.kind !== "fixed") || typeof values.value !== "string") {
    return { status: "error", message: GENERIC_ERROR };
  }

  let columns: { default_discount_kind: string; default_discount_value: number };
  if (values.kind === "none") {
    columns = { default_discount_kind: "none", default_discount_value: 0 };
  } else {
    const parsed = discountFrom(values.kind, values.value);
    if (!parsed.ok) return { status: "error", errors: { discountValue: parsed.error } };
    const d = parsed.value;
    if (!d) return { status: "error", message: GENERIC_ERROR };
    columns = {
      default_discount_kind: d.kind,
      default_discount_value: d.kind === "percent" ? d.basisPoints : d.cents,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update(columns)
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the default discount:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
