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
import { isSignOffAs, parseSignOffOther, type SignOffAs } from "@/lib/quotes/sign-off";
import { createClient } from "@/lib/supabase/server";

/**
 * The "Use this … on new quotes" ticks on a quote (docs/plans/use-on-new-quotes.md): what is on the quote becomes what every new quote starts with
 * (docs/plans/quote-form-feedback.md). The same columns as Quote settings; owners and admins only (the
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
  const parsed = optionalMultiline(value, QUOTE_PAYMENT_MAX, "Other ways to pay", QUOTE_PAYMENT_MAX_LINES);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  return saveColumn("payment_instructions", parsed.value);
}

/**
 * The sign-off as a whole, from a quote: the message and who signs (with the name typed for "Another name"). Saving
 * nothing ("", the business) clears it: new quotes then start with the country's generic message, signed by the business.
 */
export async function saveUsualSignOffChoice(values: { signOff: string; signOffAs: SignOffAs; signOffOther: string }): Promise<UsualResult> {
  if (typeof values?.signOff !== "string" || !isSignOffAs(values?.signOffAs) || typeof values?.signOffOther !== "string") {
    return { status: "error", message: GENERIC_ERROR };
  }
  const message = optionalMultiline(values.signOff, QUOTE_SIGN_OFF_MAX, "The sign-off", QUOTE_SIGN_OFF_MAX_LINES);
  if (!message.ok) return { status: "error", message: message.error };
  const other = parseSignOffOther(values.signOffAs, values.signOffOther);
  if (!other.ok) return { status: "error", message: other.error };

  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ default_sign_off: message.value, sign_off_as: values.signOffAs, sign_off_other: other.value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the usual sign-off:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved", value: message.value ?? "" };
}
