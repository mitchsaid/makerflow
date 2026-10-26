"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import {
  MAX_PAYMENT_METHODS,
  canEditPaymentMethods,
  paymentMethodFromRow,
  parsePaymentMethodForm,
  type PaymentMethod,
  type PaymentMethodErrors,
  type PaymentMethodFormValues,
  type PaymentMethodRow,
} from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export type PaymentMethodSaveState =
  | { status: "saved"; method: PaymentMethod }
  | { status: "error"; message?: string; errors?: PaymentMethodErrors };

export type PaymentMethodRemoveState = { status: "removed" } | { status: "error"; message: string };

const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const ROW = "id, kind, name, details, on_new_quotes, sort_order, created_at, updated_at";
const NOT_ALLOWED = "Only the owner can change the ways to pay. Ask them.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValues(v: unknown): v is PaymentMethodFormValues {
  const x = v as Partial<PaymentMethodFormValues> | null;
  if (!x || typeof x.kind !== "string" || typeof x.name !== "string" || typeof x.onNewQuotes !== "boolean") return false;
  if (typeof x.fields !== "object" || x.fields === null) return false;
  return Object.values(x.fields).every((value) => typeof value === "string");
}

/**
 * Adds a way to pay (no `id`) or changes one. Owners only (the database checks too): where customers send money is how
 * invoice fraud happens. A document that was already sent keeps the way as it showed it.
 */
export async function savePaymentMethod(id: string | null, values: PaymentMethodFormValues): Promise<PaymentMethodSaveState> {
  const { organisation, role, profile } = await requireOrganisation();
  if (!canEditPaymentMethods(role)) return { status: "error", message: NOT_ALLOWED };
  if (!isValues(values) || (id !== null && (typeof id !== "string" || !UUID.test(id)))) return { status: "error", message: GENERIC_ERROR };

  const locale = getLocalePack(profile.countryCode);
  const parsed = parsePaymentMethodForm(values, locale);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const changes = { kind: parsed.kind, name: parsed.name, details: parsed.details, on_new_quotes: parsed.onNewQuotes };
  let row: PaymentMethodRow | null = null;
  if (id) {
    const { data, error } = await supabase.from("payment_methods").update(changes).eq("id", id).eq("organisation_id", organisation.id).select(ROW);
    if (error) console.error("could not change a way to pay:", error.message);
    row = (data?.[0] as PaymentMethodRow | undefined) ?? null;
  } else {
    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ organisation_id: organisation.id, ...changes })
      .select(ROW)
      .single();
    if (error?.code === "54000") {
      return { status: "error", message: `You can keep up to ${MAX_PAYMENT_METHODS} ways to pay. Remove one you no longer use first.` };
    }
    if (error) console.error("could not add a way to pay:", error.message);
    row = (data as PaymentMethodRow | null) ?? null;
  }
  const method = row ? paymentMethodFromRow(row, locale) : null;
  if (!method) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/app", "layout");
  return { status: "saved", method };
}

/** Removes a way to pay. Owners only. Documents that were already sent keep it as they showed it. */
export async function removePaymentMethod(id: string): Promise<PaymentMethodRemoveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditPaymentMethods(role)) return { status: "error", message: NOT_ALLOWED };
  if (typeof id !== "string" || !UUID.test(id)) return { status: "error", message: GENERIC_ERROR };
  const supabase = await createClient();
  const { data, error } = await supabase.from("payment_methods").delete().eq("id", id).eq("organisation_id", organisation.id).select("id");
  if (error || !data || data.length !== 1) {
    if (error) console.error("could not remove a way to pay:", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app", "layout");
  return { status: "removed" };
}
