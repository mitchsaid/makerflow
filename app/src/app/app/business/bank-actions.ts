"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { bankFromRow, canEditBankDetails, parseBankForm, type BankDetails, type BankRow, type BankFieldErrors, type BankFormValues } from "@/lib/bank";
import { getLocalePack } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

export type BankSaveState =
  | { status: "saved"; bank: BankDetails }
  | { status: "error"; message?: string; errors?: BankFieldErrors };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const ROW = "country_code, details, use_reference, updated_at";
const NOT_ALLOWED = "Only the owner can change the bank details. Ask them.";

function isValues(v: unknown): v is BankFormValues {
  const x = v as { fields?: unknown; useReference?: unknown } | null;
  if (!x || typeof x.useReference !== "boolean" || typeof x.fields !== "object" || x.fields === null) return false;
  return Object.values(x.fields as Record<string, unknown>).every((value) => typeof value === "string");
}

/**
 * Saves the business's bank details (adds them the first time). Owners only (the database checks
 * too). Documents that were already sent keep the details they showed.
 */
export async function saveBankDetails(values: BankFormValues): Promise<BankSaveState> {
  const { organisation, role, profile } = await requireOrganisation();
  if (!canEditBankDetails(role)) return { status: "error", message: NOT_ALLOWED };
  if (!isValues(values)) return { status: "error", message: GENERIC_ERROR };

  const locale = getLocalePack(profile.countryCode);
  const parsed = parseBankForm(values, locale);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("business_bank_details")
    .select("id")
    .eq("organisation_id", organisation.id)
    .maybeSingle();
  if (readError) {
    console.error("could not read bank details:", readError.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  let row: BankRow | null;
  if (existing) {
    const { data, error } = await supabase
      .from("business_bank_details")
      .update({ country_code: locale.countryCode, details: parsed.details, use_reference: parsed.useReference })
      .eq("id", existing.id)
      .eq("organisation_id", organisation.id)
      .select(ROW);
    row = data?.length === 1 ? data[0] : null;
    if (error || !row) {
      console.error("could not save bank details:", error?.message);
      return { status: "error", message: GENERIC_ERROR };
    }
  } else {
    const { data, error } = await supabase
      .from("business_bank_details")
      .insert({
        organisation_id: organisation.id,
        country_code: locale.countryCode,
        details: parsed.details,
        use_reference: parsed.useReference,
      })
      .select(ROW)
      .single();
    row = data;
    if (error || !row) {
      console.error("could not add bank details:", error?.message);
      return { status: "error", message: GENERIC_ERROR };
    }
  }
  const bank = bankFromRow(row, locale);
  if (!bank) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/app", "layout");
  return { status: "saved", bank };
}
