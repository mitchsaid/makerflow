import {
  optionalChoice,
  optionalMultiline,
  optionalText,
  optionalValidated,
} from "../form-values";
import type { LocalePack } from "../locale";
import { validateEmail, validatePhone, type ValidationResult } from "../validation";

export const CUSTOMER_NAME_MAX = 120;

export type CustomerKind = "individual" | "business";

/** Everything a person can fill in about a customer. Optional values are null, never "". */
export type CustomerFields = {
  name: string;
  kind: CustomerKind;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  /**
   * Where deliveries go. By default the main address ("same as above"); otherwise the parts below, shaped like the
   * main address. They are all null while it is the same.
   */
  deliverySameAsMain: boolean;
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryCity: string | null;
  deliveryRegion: string | null;
  deliveryPostalCode: string | null;
  vatNumber: string | null;
  companyRegistrationNumber: string | null;
  notes: string | null;
};

export type Customer = CustomerFields & { id: string; organisationId: string; archived: boolean };

/** A row of the customers list: just what the list shows and searches. */
export type CustomerSummary = {
  id: string;
  /** The business it belongs to. Callers show only their current business's customers. */
  organisationId: string;
  name: string;
  kind: CustomerKind;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  archived: boolean;
};

/** A summary with the address details a quote offers as "deliver to" (see savedAddresses). */
export type CustomerSummaryWithAddress = CustomerSummary & CustomerAddresses;

/** The address details of a customer: the main address and where deliveries go. */
export type CustomerAddresses = Pick<
  CustomerFields,
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postalCode"
  | "deliverySameAsMain"
  | "deliveryAddressLine1"
  | "deliveryAddressLine2"
  | "deliveryCity"
  | "deliveryRegion"
  | "deliveryPostalCode"
>;

export type CustomerFieldName = keyof CustomerFields;
export type CustomerFieldErrors = Partial<Record<CustomerFieldName, string>>;

export type ParsedCustomerForm =
  | { ok: true; value: CustomerFields }
  | { ok: false; errors: CustomerFieldErrors };

/** The customer's name. The only required detail. */
export function validateCustomerName(input: unknown): ValidationResult<string> {
  const value = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (value.length === 0) {
    return { ok: false, error: "Enter the customer's name so you can find them again." };
  }
  if (value.length > CUSTOMER_NAME_MAX) {
    return { ok: false, error: `Names can be up to ${CUSTOMER_NAME_MAX} characters.` };
  }
  return { ok: true, value };
}

/**
 * A customer's tax number is only recorded, never checked against the business's own
 * country rules: a customer can be a business in another country, and refusing a real number
 * is worse than keeping a typo. Letters, digits, spaces and a few separators.
 */
function validateCustomerTaxNumber(label: string) {
  return (input: unknown): ValidationResult<string> => {
    const value = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
    if (value.length > 32 || !/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/.test(value)) {
      return { ok: false, error: `${label} can only have letters, numbers and spaces (up to 32).` };
    }
    return { ok: true, value };
  };
}

/**
 * Turns the customer form into validated values. Business-only details (contact person, tax
 * number, registration number) are kept only when "this is a business" is ticked, matching
 * the database rule.
 */
export function parseCustomerForm(form: FormData, locale: LocalePack): ParsedCustomerForm {
  const errors: CustomerFieldErrors = {};
  const isBusiness = form.get("kind") === "business";

  const name = validateCustomerName(form.get("name"));
  if (!name.ok) errors.name = name.error;

  const phone = optionalValidated(form.get("phone"), validatePhone);
  if (!phone.ok) errors.phone = phone.error;

  const email = optionalValidated(form.get("email"), validateEmail);
  if (!email.ok) errors.email = email.error;

  const addressLine1 = optionalText(form.get("addressLine1"), 120, "Address");
  if (!addressLine1.ok) errors.addressLine1 = addressLine1.error;
  const addressLine2 = optionalText(form.get("addressLine2"), 120, "Address");
  if (!addressLine2.ok) errors.addressLine2 = addressLine2.error;
  const city = optionalText(form.get("city"), 80, "City");
  if (!city.ok) errors.city = city.error;

  const region = optionalChoice(
    form.get("region"),
    locale.address.regions,
    `Please choose a ${locale.address.regionLabel.toLowerCase()} from the list.`,
  );
  if (!region.ok) errors.region = region.error;

  const postalCode = optionalValidated(form.get("postalCode"), locale.address.validatePostalCode);
  if (!postalCode.ok) errors.postalCode = postalCode.error;

  // Delivery: the same address by default; otherwise its own parts, shaped like the main address.
  const deliverySameAsMain = form.get("deliverySameAsMain") !== "no";
  const delivery = {
    line1: null as string | null,
    line2: null as string | null,
    city: null as string | null,
    region: null as string | null,
    postalCode: null as string | null,
  };
  if (!deliverySameAsMain) {
    const dLine1 = optionalText(form.get("deliveryAddressLine1"), 120, "Address");
    if (dLine1.ok) delivery.line1 = dLine1.value;
    else errors.deliveryAddressLine1 = dLine1.error;
    const dLine2 = optionalText(form.get("deliveryAddressLine2"), 120, "Address");
    if (dLine2.ok) delivery.line2 = dLine2.value;
    else errors.deliveryAddressLine2 = dLine2.error;
    const dCity = optionalText(form.get("deliveryCity"), 80, "City");
    if (dCity.ok) delivery.city = dCity.value;
    else errors.deliveryCity = dCity.error;
    const dRegion = optionalChoice(
      form.get("deliveryRegion"),
      locale.address.regions,
      `Please choose a ${locale.address.regionLabel.toLowerCase()} from the list.`,
    );
    if (dRegion.ok) delivery.region = dRegion.value;
    else errors.deliveryRegion = dRegion.error;
    const dPostal = optionalValidated(form.get("deliveryPostalCode"), locale.address.validatePostalCode);
    if (dPostal.ok) delivery.postalCode = dPostal.value;
    else errors.deliveryPostalCode = dPostal.error;
    // Unticked with nothing typed would save a delivery address that is empty: say how to fix it.
    if (Object.values(delivery).every((v) => v === null) && !errors.deliveryAddressLine1 && !errors.deliveryAddressLine2 && !errors.deliveryCity && !errors.deliveryRegion && !errors.deliveryPostalCode) {
      errors.deliveryAddressLine1 = "Enter the delivery address, or tick “Same as the address above”.";
    }
  }

  const notes = optionalMultiline(form.get("notes"), 2000, "Notes");
  if (!notes.ok) errors.notes = notes.error;

  let contactPerson: string | null = null;
  let vatNumber: string | null = null;
  let companyRegistrationNumber: string | null = null;
  if (isBusiness) {
    const contact = optionalText(form.get("contactPerson"), 120, "Contact person");
    if (contact.ok) contactPerson = contact.value;
    else errors.contactPerson = contact.error;

    const vat = optionalValidated(
      form.get("vatNumber"),
      validateCustomerTaxNumber(locale.tax.registrationNumberLabel),
    );
    if (vat.ok) vatNumber = vat.value;
    else errors.vatNumber = vat.error;

    const registration = optionalText(
      form.get("companyRegistrationNumber"),
      40,
      "Company registration number",
    );
    if (registration.ok) companyRegistrationNumber = registration.value;
    else errors.companyRegistrationNumber = registration.error;
  }

  if (Object.keys(errors).length > 0 || !name.ok) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name: name.value,
      kind: isBusiness ? "business" : "individual",
      contactPerson,
      email: email.ok ? email.value : null,
      phone: phone.ok ? phone.value : null,
      addressLine1: addressLine1.ok ? addressLine1.value : null,
      addressLine2: addressLine2.ok ? addressLine2.value : null,
      city: city.ok ? city.value : null,
      region: region.ok ? region.value : null,
      postalCode: postalCode.ok ? postalCode.value : null,
      deliverySameAsMain,
      deliveryAddressLine1: delivery.line1,
      deliveryAddressLine2: delivery.line2,
      deliveryCity: delivery.city,
      deliveryRegion: delivery.region,
      deliveryPostalCode: delivery.postalCode,
      vatNumber,
      companyRegistrationNumber,
      notes: notes.ok ? notes.value : null,
    },
  };
}

export { forOrganisation } from "../scope";

/** Phone numbers compare by digits only, so "021 123 4567" and "(021) 123-4567" match. */
function phoneDigits(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Existing customers that look like the one being added: the same name (ignoring case and
 * spacing) or the same phone number. Used to warn, never to block.
 */
export function findPossibleDuplicates<T extends { id: string; name: string; phone: string | null }>(
  candidate: { name: string; phone: string | null },
  existing: readonly T[],
  ignoreId?: string,
): T[] {
  const name = candidate.name.trim().replace(/\s+/g, " ").toLowerCase();
  const digits = phoneDigits(candidate.phone);
  return existing.filter((c) => {
    if (c.id === ignoreId) return false;
    if (c.name.trim().replace(/\s+/g, " ").toLowerCase() === name) return true;
    return digits.length >= 7 && phoneDigits(c.phone) === digits;
  });
}

/** A short line that tells two customers apart: contact, phone or email, town. */
export function customerDetail(c: {
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
}): string {
  return [c.contactPerson, c.phone ?? c.email, c.city].filter(Boolean).join(" · ");
}

/** An address a customer has on file that a quote can be delivered to. */
export type SavedAddress = {
  kind: "delivery" | "main";
  /** How to name it to the maker: "Delivery address on file". */
  label: string;
  /** Plain text, one line per line break. */
  text: string;
};

const sameText = (a: string, b: string) => a.replace(/\s+/g, " ").trim().toLowerCase() === b.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The addresses a quote can use for "deliver to": the customer's own delivery address first, then
 * their main address, written the way their country writes it. Only the ones they have, and the
 * main address is left out when it is the same as the delivery address.
 */
export function savedAddresses(c: CustomerAddresses, locale: LocalePack): SavedAddress[] {
  const out: SavedAddress[] = [];
  if (!c.deliverySameAsMain) {
    const delivery = locale.address
      .formatLines({
        line1: c.deliveryAddressLine1,
        line2: c.deliveryAddressLine2,
        city: c.deliveryCity,
        region: c.deliveryRegion,
        postalCode: c.deliveryPostalCode,
      })
      .join("\n");
    if (delivery) out.push({ kind: "delivery", label: "Delivery address on file", text: delivery });
  }
  const main = locale.address
    .formatLines({ line1: c.addressLine1, line2: c.addressLine2, city: c.city, region: c.region, postalCode: c.postalCode })
    .join("\n");
  if (main && !out.some((a) => sameText(a.text, main))) out.push({ kind: "main", label: "Address on file", text: main });
  return out;
}

/** What the quote's customer picker needs to know about a customer. */
export type CustomerOption = {
  id: string;
  name: string;
  /** See customerDetail(). */
  detail: string;
  archived: boolean;
  /** The addresses on file, for "deliver to". */
  addresses: SavedAddress[];
};

/** Does a list row match what the person typed in the search box? */
export function matchesSearch(customer: CustomerSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  const qDigits = q.replace(/\D/g, "");
  const haystack = [customer.name, customer.contactPerson, customer.email, customer.city]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes(q)) return true;
  return qDigits.length >= 3 && phoneDigits(customer.phone).includes(qDigits);
}
