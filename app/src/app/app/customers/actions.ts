"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import {
  findPossibleDuplicates,
  parseCustomerForm,
  type CustomerFieldErrors,
  type CustomerFields,
} from "@/lib/customers";
import { getLocalePack } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

export type CustomerSaveState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message?: string; errors?: CustomerFieldErrors }
  /** Looks like someone already on the list: ask before adding, never block. */
  | { status: "duplicate"; matches: { id: string; name: string }[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";

function toRow(c: CustomerFields) {
  return {
    name: c.name,
    kind: c.kind,
    contact_person: c.contactPerson,
    email: c.email,
    phone: c.phone,
    address_line1: c.addressLine1,
    address_line2: c.addressLine2,
    city: c.city,
    region: c.region,
    postal_code: c.postalCode,
    delivery_address: c.deliveryAddress,
    vat_number: c.vatNumber,
    company_registration_number: c.companyRegistrationNumber,
    notes: c.notes,
  };
}

/** Adds a customer. Any member of the business can. */
export async function createCustomer(
  _previous: CustomerSaveState,
  formData: FormData,
): Promise<CustomerSaveState> {
  const { organisation, profile } = await requireOrganisation();

  const parsed = parseCustomerForm(formData, getLocalePack(profile.countryCode));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();

  // A warning, not a block: the same name or phone number may well be a different person.
  if (formData.get("confirmDuplicate") !== "yes") {
    const { data: existing, error: lookupError } = await supabase
      .from("customers")
      .select("id, name, phone")
      .limit(5000);
    if (lookupError) {
      console.error("could not check for duplicate customers:", lookupError.message);
      return { status: "error", message: GENERIC_ERROR };
    }
    const matches = findPossibleDuplicates(parsed.value, existing ?? []);
    if (matches.length > 0) {
      return {
        status: "duplicate",
        matches: matches.slice(0, 3).map(({ id, name }) => ({ id, name })),
      };
    }
  }

  const { data: created, error } = await supabase
    .from("customers")
    .insert({ organisation_id: organisation.id, ...toRow(parsed.value) })
    .select("id")
    .single();
  if (error || !created) {
    console.error("could not add customer:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/customers");
  redirect(`/app/customers?added=${created.id}`);
}

/** Saves changes to a customer. Any member of the business can. */
export async function updateCustomer(
  id: string,
  _previous: CustomerSaveState,
  formData: FormData,
): Promise<CustomerSaveState> {
  const { profile } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };

  const parsed = parseCustomerForm(formData, getLocalePack(profile.countryCode));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("customers")
    .update(toRow(parsed.value))
    .eq("id", id)
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not save customer:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/customers");
  return { status: "saved" };
}

export type ArchiveState = { status: "idle" } | { status: "error"; message: string };

/**
 * Archives or restores a customer. Customers are never deleted: documents will refer to them.
 * Archiving returns to the list; restoring stays on the customer.
 */
export async function setCustomerArchived(
  id: string,
  archived: boolean,
): Promise<ArchiveState> {
  await requireOrganisation();
  if (!UUID.test(id)) redirect("/app/customers");

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("customers")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not archive or restore customer:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/customers");
  if (archived) redirect("/app/customers");
  return { status: "idle" };
}
