import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import type { Customer, CustomerKind, CustomerSummary } from "./index";

/**
 * Customer reads. Row-level security limits every query to businesses the signed-in person
 * belongs to (and a signed-out session sees nothing), but a person can belong to more than
 * one. The current business is only known once the workspace has loaded, and the pages load
 * both at the same time to stay fast, so these return the business of each row and the page
 * keeps only the current one: see forOrganisation() in ./index.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SummaryRow = {
  id: string;
  organisation_id: string;
  name: string;
  kind: CustomerKind;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  archived_at: string | null;
};

/** Every customer of the business, archived ones included, A to Z. One query. */
export async function getCustomers(): Promise<CustomerSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, organisation_id, name, kind, contact_person, phone, email, city, archived_at")
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`Could not load customers: ${error.message}`);
  return (data as SummaryRow[]).map((row) => ({
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    kind: row.kind,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    city: row.city,
    archived: row.archived_at !== null,
  }));
}

type FullRow = SummaryRow & {
  address_line1: string | null;
  address_line2: string | null;
  region: string | null;
  postal_code: string | null;
  delivery_address: string | null;
  vat_number: string | null;
  company_registration_number: string | null;
  notes: string | null;
};

/** One customer with every detail, or null for a bad id or one that is not visible to this person. */
export async function findCustomer(id: string): Promise<Customer | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      `id, organisation_id, name, kind, contact_person, phone, email, city, archived_at,
       address_line1, address_line2, region, postal_code, delivery_address,
       vat_number, company_registration_number, notes`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the customer: ${error.message}`);
  if (!data) return null;
  const row = data as FullRow;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    name: row.name,
    kind: row.kind,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    deliveryAddress: row.delivery_address,
    vatNumber: row.vat_number,
    companyRegistrationNumber: row.company_registration_number,
    notes: row.notes,
    archived: row.archived_at !== null,
  };
}

/** One customer with every detail. Shows the "not found" page for a bad or foreign id. */
export async function getCustomer(id: string): Promise<Customer> {
  const customer = await findCustomer(id);
  if (!customer) notFound();
  return customer;
}
