"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { depositColumns, isDepositKind, parseDeposit, type DepositErrors, type DepositKind } from "@/lib/quotes/deposit";
import { createClient } from "@/lib/supabase/server";

export type DepositDefaultValues = { kind: DepositKind; value: string };
export type DepositDefaultState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: DepositErrors };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

/**
 * Sets the deposit a new quote starts with (none, a percentage or an amount). The balance always
 * starts as "on collection or delivery". Owners and admins only; each quote can change it.
 */
export async function saveDepositDefault(values: DepositDefaultValues): Promise<DepositDefaultState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) {
    return { status: "error", message: "Only owners and admins can change the default deposit. Ask one of them." };
  }
  if (!values || !isDepositKind(values.kind) || typeof values.value !== "string") {
    return { status: "error", message: GENERIC_ERROR };
  }

  const parsed = parseDeposit({ depositKind: values.kind, depositValue: values.value }, "");
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const columns = depositColumns(parsed.deposit);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .update({ default_deposit_kind: columns.deposit_kind, default_deposit_value: columns.deposit_value })
    .eq("organisation_id", organisation.id)
    .select("organisation_id");
  if (error || !data || data.length !== 1) {
    console.error("could not save the default deposit:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "saved" };
}
