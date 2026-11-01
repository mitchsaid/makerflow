import { optionalText, optionalValidated } from "../form-values";
import type { LocalePack } from "../locale";
import { validateEmail, validatePhone } from "../validation";
import { CUSTOMER_NAME_MAX } from "../customers";
import { nameKey, type Table } from "./products";

/**
 * Reading a pasted list or a CSV of customers (docs/plans/import-onboarding.md, slice 3), the way `products.ts` reads
 * products: columns guessed from their headings (Xero's contacts export, QuickBooks's customer list, plain sheets), each
 * row checked with the same rules the Add customer form uses. A bad email, phone number, province or postal code is
 * left out of that customer with a note (it does not stop the customer being added); a missing name does.
 */

/** How many customers one import takes. */
export const IMPORT_MAX_CUSTOMERS = 200;

export type CustomerColumn = "name" | "email" | "phone" | "address" | "city" | "region" | "postalCode" | "notes";
export type CustomerMapping = Partial<Record<CustomerColumn, number>>;

export const CUSTOMER_COLUMN_LABELS: Record<CustomerColumn, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  address: "Street address",
  city: "City or town",
  region: "Province",
  postalCode: "Postal code",
  notes: "Notes",
};

const HEADINGS: Record<CustomerColumn, string[]> = {
  name: ["name", "customer", "customername", "fullname", "contactname", "displayname", "company", "companyname", "client", "clientname"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "phonenumbers", "mobile", "mobilenumber", "cell", "cellphone", "telephone", "tel"],
  address: ["address", "address1", "addressline1", "street", "streetaddress", "poaddressline1", "billingaddress", "billingaddressline1"],
  city: ["city", "town", "pocity", "billingcity"],
  region: ["region", "province", "state", "poregion", "billingprovince"],
  postalCode: ["postalcode", "postcode", "zip", "zipcode", "popostalcode", "billingpostalcode"],
  notes: ["notes", "note", "comments", "comment"],
};
const KEYS = Object.keys(HEADINGS) as CustomerColumn[];
const squash = (heading: string) => heading.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which column holds which part, from the first row (headings are expected; a list of names alone has no heading). */
export function guessCustomerMapping(table: Table): { hasHeader: boolean; mapping: CustomerMapping } {
  const first = table[0] ?? [];
  const mapping: CustomerMapping = {};
  const taken = new Set<number>();
  for (const key of KEYS) {
    const at = first.findIndex((h, i) => !taken.has(i) && HEADINGS[key].includes(squash(h)));
    if (at !== -1) {
      mapping[key] = at;
      taken.add(at);
    }
  }
  if (Object.keys(mapping).length > 0) {
    if (mapping.name === undefined) {
      const at = first.findIndex((_, i) => !taken.has(i));
      if (at !== -1) mapping.name = at;
    }
    return { hasHeader: true, mapping };
  }
  // No heading words at all: a first row that has an "@" in it is a customer, not a heading.
  const looksLikeData = first.some((c) => c.includes("@"));
  return { hasHeader: !looksLikeData && table.length > 1 && first.length > 1, mapping: { name: 0, ...(first.length > 1 ? { email: 1 } : {}) } };
}

export type ImportCustomer = {
  line: number;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  notes: string | null;
  problem?: string;
  /** What was left out of this customer, and why. */
  note?: string;
};

export function readCustomers(
  table: Table,
  hasHeader: boolean,
  mapping: CustomerMapping,
  options: { locale: LocalePack; existingNames: ReadonlySet<string> },
): ImportCustomer[] {
  const data = hasHeader ? table.slice(1) : table;
  const seen = new Map<string, number>();
  return data.map((cells, index): ImportCustomer => {
    const line = index + 1;
    const cell = (key: CustomerColumn) => (mapping[key] === undefined ? "" : (cells[mapping[key]!] ?? "").trim());
    const name = cell("name").replace(/\s+/g, " ");
    const left: string[] = [];
    const row: ImportCustomer = { line, name, email: null, phone: null, addressLine1: null, city: null, region: null, postalCode: null, notes: null };

    const email = optionalValidated(cell("email"), validateEmail);
    if (email.ok) row.email = email.value;
    else left.push("the email address");
    const phone = optionalValidated(cell("phone"), validatePhone);
    if (phone.ok) row.phone = phone.value;
    else left.push("the phone number");
    const street = optionalText(cell("address"), 120, "Address");
    if (street.ok) row.addressLine1 = street.value;
    else left.push("the street address");
    const city = optionalText(cell("city"), 80, "City");
    if (city.ok) row.city = city.value;
    else left.push("the city");
    const regionText = cell("region").toLowerCase();
    if (regionText !== "") {
      const region = options.locale.address.regions.find((r) => r.toLowerCase() === regionText);
      if (region) row.region = region;
      else left.push("the province");
    }
    const postal = optionalValidated(cell("postalCode"), options.locale.address.validatePostalCode);
    if (postal.ok) row.postalCode = postal.value;
    else left.push("the postal code");
    const notes = optionalText(cell("notes"), 2000, "Notes");
    if (notes.ok) row.notes = notes.value;
    else left.push("the notes");
    if (left.length > 0) row.note = `Left out, as it could not be read: ${left.join(", ")}.`;

    if (name === "") row.problem = "No name. Add one, or leave this row out.";
    else if (name.length > CUSTOMER_NAME_MAX) row.problem = `The name is longer than ${CUSTOMER_NAME_MAX} characters. Shorten it.`;
    else if (options.existingNames.has(nameKey(name))) row.problem = "You already have a customer with this name, so it is left out.";
    else if (seen.has(nameKey(name))) row.problem = `Same name as row ${seen.get(nameKey(name))}, so it is left out.`;
    else seen.set(nameKey(name), line);
    return row;
  });
}
