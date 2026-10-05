"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { optionalMultiline, optionalText } from "@/lib/form-values";
import {
  QUOTE_PAYMENT_MAX,
  QUOTE_PAYMENT_MAX_LINES,
  QUOTE_SIGN_OFF_MAX,
  QUOTE_TERMS_MAX,
  QUOTE_TERMS_MAX_LINES,
} from "@/lib/quotes";
import { createClient } from "@/lib/supabase/server";

export type WordingValues = { signOff: string; terms: string; paymentInstructions: string };
export type WordingErrors = Partial<Record<keyof WordingValues, string>>;
export type WordingState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: WordingErrors };

/** Sets what new quotes start with: sign-off, terms and how to pay. Owners and admins only. */
export async function saveQuoteWording(values: WordingValues): Promise<WordingState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change the wording of your quotes." };
  }
  if (
    typeof values?.signOff !== "string" ||
    typeof values?.terms !== "string" ||
    typeof values?.paymentInstructions !== "string"
  ) {
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }

  const errors: WordingErrors = {};
  const signOff = optionalText(values.signOff, QUOTE_SIGN_OFF_MAX, "The sign-off");
  if (!signOff.ok) errors.signOff = signOff.error;
  const terms = optionalMultiline(values.terms, QUOTE_TERMS_MAX, "The terms", QUOTE_TERMS_MAX_LINES);
  if (!terms.ok) errors.terms = terms.error;
  const payment = optionalMultiline(values.paymentInstructions, QUOTE_PAYMENT_MAX, "Other ways to pay", QUOTE_PAYMENT_MAX_LINES);
  if (!payment.ok) errors.paymentInstructions = payment.error;
  if (Object.keys(errors).length > 0 || !signOff.ok || !terms.ok || !payment.ok) {
    return { status: "error", errors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({
      default_sign_off: signOff.value,
      default_terms: terms.value,
      payment_instructions: payment.value,
    })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save quote wording:", error?.message);
    return { status: "error", message: "Something went wrong saving that. Please try again." };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
