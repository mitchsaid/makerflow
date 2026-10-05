"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { bankFromRow, canEditBankDetails, parseBankForm, type BankDetails, type BankFieldErrors, type BankRow, type BankFormValues } from "@/lib/bank";
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
  const changes = { country_code: locale.countryCode, details: parsed.details, use_reference: parsed.useReference };
  // One row per business. An upsert would also try to set organisation_id, which nobody may change,
  // so: change the row if there is one, else add it. If another tab added it first (the unique
  // rule says so), change that one instead.
  const change = () =>
    supabase.from("business_bank_details").update(changes).eq("organisation_id", organisation.id).select(ROW);
  const first = await change();
  let row: BankRow | null = first.data?.[0] ?? null;
  let failure = first.error;
  if (!failure && !row) {
    const added = await supabase
      .from("business_bank_details")
      .insert({ organisation_id: organisation.id, ...changes })
      .select(ROW)
      .single();
    if (added.error?.code === "23505") {
      const again = await change();
      row = again.data?.[0] ?? null;
      failure = again.error;
    } else {
      row = added.data;
      failure = added.error;
    }
  }
  if (failure || !row) {
    console.error("could not save bank details:", failure?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  const bank = bankFromRow(row, locale);
  if (!bank) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/app", "layout");
  return { status: "saved", bank };
}
