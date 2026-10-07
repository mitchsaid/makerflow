"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganisation } from "@/lib/auth/dal";
import {
  customerDetail,
  savedAddresses,
  type SavedAddress,
  findPossibleDuplicates,
  parseCustomerForm,
  type CustomerFieldErrors,
  type CustomerFields,
} from "@/lib/customers";
import { getLocalePack, type LocalePack } from "@/lib/locale";
import { findCustomer } from "@/lib/customers/data";
import { createClient } from "@/lib/supabase/server";

/** What the quote's customer picker needs back after a customer is added or changed. */
export type CustomerSummaryOption = { id: string; name: string; detail: string; addresses: SavedAddress[] };

export type CustomerSaveState =
  | { status: "idle" }
  | { status: "saved"; option: CustomerSummaryOption }
  /** Added from inside a quote: nothing is redirected, the quote keeps what was typed. */
  | { status: "created"; option: CustomerSummaryOption }
  | { status: "error"; message?: string; errors?: CustomerFieldErrors }
  /** Looks like someone already on the list: ask before adding, never block. */
  | { status: "duplicate"; matches: CustomerSummaryOption[] };

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

function optionFor(id: string, c: CustomerFields, locale: LocalePack): CustomerSummaryOption {
  return { id, name: c.name, detail: customerDetail(c), addresses: savedAddresses(c, locale) };
}

/**
 * Checks, warns about likely duplicates (never blocks), and inserts. Returns the new
 * customer, or the state to show (errors, or the duplicate warning).
 */
async function insertCustomer(
  formData: FormData,
): Promise<{ ok: true; option: CustomerSummaryOption } | { ok: false; state: CustomerSaveState }> {
  const { organisation, profile } = await requireOrganisation();

  const parsed = parseCustomerForm(formData, getLocalePack(profile.countryCode));
  if (!parsed.ok) return { ok: false, state: { status: "error", errors: parsed.errors } };

  const supabase = await createClient();

  // A warning, not a block: the same name or phone number may well be a different person.
  if (formData.get("confirmDuplicate") !== "yes") {
    const { data: existing, error: lookupError } = await supabase
      .from("customers")
      .select("id, name, phone, address_line1, address_line2, city, region, postal_code, delivery_address")
      .eq("organisation_id", organisation.id)
      .limit(5000);
    if (lookupError) {
      console.error("could not check for duplicate customers:", lookupError.message);
      return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
    }
    const matches = findPossibleDuplicates(parsed.value, existing ?? []);
    if (matches.length > 0) {
      return {
        ok: false,
        state: {
          status: "duplicate",
          matches: matches
            .slice(0, 3)
            .map((c) => ({
              id: c.id,
              name: c.name,
              detail: c.phone ?? "",
              // So that choosing "use this one" still offers their addresses for a delivery.
              addresses: savedAddresses(
                {
                  addressLine1: c.address_line1,
                  addressLine2: c.address_line2,
                  city: c.city,
                  region: c.region,
                  postalCode: c.postal_code,
                  deliveryAddress: c.delivery_address,
                },
                getLocalePack(profile.countryCode),
              ),
            })),
        },
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
    return { ok: false, state: { status: "error", message: GENERIC_ERROR } };
  }

  revalidatePath("/app/customers");
  return { ok: true, option: optionFor(created.id, parsed.value, getLocalePack(profile.countryCode)) };
}

/** Adds a customer from the Customers screen, then shows the list. Any member can. */
export async function createCustomer(
  _previous: CustomerSaveState,
  formData: FormData,
): Promise<CustomerSaveState> {
  const result = await insertCustomer(formData);
  if (!result.ok) return result.state;
  redirect(`/app/customers?added=${result.option.id}`);
}

/** Adds a customer from inside a quote and hands it back, so the quote can use it right away. */
export async function createCustomerInQuote(
  _previous: CustomerSaveState,
  formData: FormData,
): Promise<CustomerSaveState> {
  const result = await insertCustomer(formData);
  return result.ok ? { status: "created", option: result.option } : result.state;
}

export type CustomerLoadState =
  | { status: "ok"; customer: import("@/lib/customers").Customer }
  | { status: "error"; message: string };

/** Loads one customer's full details, for editing from inside a quote. */
export async function loadCustomerForEdit(id: string): Promise<CustomerLoadState> {
  const { organisation } = await requireOrganisation();
  const customer = await findCustomer(id);
  if (!customer || customer.organisationId !== organisation.id) {
    return { status: "error", message: "Couldn't open that customer. Please try again." };
  }
  return { status: "ok", customer };
}

/** Saves changes to a customer. Any member of the business can. */
export async function updateCustomer(
  id: string,
  _previous: CustomerSaveState,
  formData: FormData,
): Promise<CustomerSaveState> {
  const { organisation, profile } = await requireOrganisation();
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };

  const parsed = parseCustomerForm(formData, getLocalePack(profile.countryCode));
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("customers")
    .update(toRow(parsed.value))
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not save customer:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/customers");
  return { status: "saved", option: optionFor(id, parsed.value, getLocalePack(profile.countryCode)) };
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
  const { organisation } = await requireOrganisation();
  if (!UUID.test(id)) redirect("/app/customers");

  const supabase = await createClient();
  const { data: saved, error } = await supabase
    .from("customers")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !saved || saved.length !== 1) {
    console.error("could not archive or restore customer:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  revalidatePath("/app/customers");
  if (archived) redirect("/app/customers");
  return { status: "idle" };
}
