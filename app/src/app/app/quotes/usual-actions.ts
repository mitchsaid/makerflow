"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { optionalMultiline } from "@/lib/form-values";
import {
  QUOTE_DESCRIPTION_MAX,
  QUOTE_DESCRIPTION_MAX_LINES,
  QUOTE_PAYMENT_MAX,
  QUOTE_PAYMENT_MAX_LINES,
  QUOTE_SIGN_OFF_MAX,
  QUOTE_SIGN_OFF_MAX_LINES,
} from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

/**
 * "Save as my usual", from a quote: what is on the quote becomes what every new quote starts with
 * (docs/plans/quote-form-feedback.md). The same columns as Quotes and invoices; owners and admins only (the
 * database checks too). Quotes that exist are never changed.
 */

export type UsualResult = { status: "saved"; value: string } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const NOT_ALLOWED = "Only owners and admins can change what new quotes start with. Ask one of them.";

async function saveColumn(column: "default_description" | "default_sign_off" | "payment_instructions", value: string | null): Promise<UsualResult> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ [column]: value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save a usual:", column, error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved", value: value ?? "" };
}

export async function saveUsualDescription(value: string): Promise<UsualResult> {
  if (typeof value !== "string") return { status: "error", message: GENERIC_ERROR };
  const parsed = optionalMultiline(value, QUOTE_DESCRIPTION_MAX, "The description", QUOTE_DESCRIPTION_MAX_LINES);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  return saveColumn("default_description", parsed.value);
}

export async function saveUsualSignOff(value: string): Promise<UsualResult> {
  if (typeof value !== "string") return { status: "error", message: GENERIC_ERROR };
  const parsed = optionalMultiline(value, QUOTE_SIGN_OFF_MAX, "The sign-off", QUOTE_SIGN_OFF_MAX_LINES);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  return saveColumn("default_sign_off", parsed.value);
}

export async function saveUsualPayment(value: string): Promise<UsualResult> {
  if (typeof value !== "string") return { status: "error", message: GENERIC_ERROR };
  const parsed = optionalMultiline(value, QUOTE_PAYMENT_MAX, "Notes about paying", QUOTE_PAYMENT_MAX_LINES);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  return saveColumn("payment_instructions", parsed.value);
}
