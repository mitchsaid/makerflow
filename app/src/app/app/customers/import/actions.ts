"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomers } from "@/lib/customers/data";
import { forOrganisation } from "@/lib/customers";
import { IMPORT_MAX_CUSTOMERS, readCustomers } from "@/lib/import/customers";
import { nameKey } from "@/lib/import/products";
import { getLocalePack } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";

/** One customer to add, as the preview sends it. Everything is checked again here: the browser is not trusted. */
export type ImportCustomerItem = {
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  notes: string | null;
};

export type ImportCustomersResult = { status: "done"; added: number; skipped: number } | { status: "error"; message: string };

const GENERIC = "Something went wrong adding those. Please try again.";

/**
 * Adds the customers of an imported list (docs/plans/import-onboarding.md, slice 3). Each is checked again with the
 * same reader the preview used, then inserted under the person's own access like a customer added by hand. A name the
 * business already has, or that repeats, is skipped (never updated).
 */
export async function importCustomers(items: ImportCustomerItem[]): Promise<ImportCustomersResult> {
  const { organisation, profile } = await requireOrganisation();
  if (!Array.isArray(items) || items.length === 0) return { status: "error", message: "There is nothing to add. Tick at least one row." };
  if (items.length > IMPORT_MAX_CUSTOMERS) {
    return { status: "error", message: `Add up to ${IMPORT_MAX_CUSTOMERS} at a time. Split the list and import it in parts.` };
  }
  const locale = getLocalePack(profile.countryCode);

  const existing = new Set(forOrganisation(await getCustomers(), organisation.id).map((c) => nameKey(c.name)));
  const fresh: ImportCustomerItem[] = [];
  let skipped = 0;
  for (const item of items) {
    const key = typeof item?.name === "string" ? nameKey(item.name) : "";
    if (key !== "" && existing.has(key)) {
      skipped++;
      continue;
    }
    existing.add(key);
    fresh.push(item);
  }

  // The same reader the preview used, over the rows as sent: anything it would have left out is refused.
  const cells = (c: ImportCustomerItem) => [c?.name, c?.email, c?.phone, c?.addressLine1, c?.city, c?.region, c?.postalCode, c?.notes].map((v) => (typeof v === "string" ? v : ""));
  const read = readCustomers(fresh.map(cells), false, { name: 0, email: 1, phone: 2, address: 3, city: 4, region: 5, postalCode: 6, notes: 7 }, { locale, existingNames: new Set() });
  if (read.some((r) => r.problem || r.note)) return { status: "error", message: "Some of those rows could not be read. Go back to the check and try again." };
  if (read.length === 0) return { status: "done", added: 0, skipped };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert(
    read.map((r) => ({
      organisation_id: organisation.id,
      name: r.name,
      kind: "individual" as const,
      email: r.email,
      phone: r.phone,
      address_line1: r.addressLine1,
      city: r.city,
      region: r.region,
      postal_code: r.postalCode,
      notes: r.notes,
      delivery_same_as_main: true,
    })),
  );
  if (error) {
    console.error("could not import customers:", error.code, error.message);
    return { status: "error", message: GENERIC };
  }
  revalidatePath("/app/customers");
  return { status: "done", added: read.length, skipped };
}

