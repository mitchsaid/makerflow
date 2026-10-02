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
  deliveryAddress: string | null;
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

  const deliveryAddress = optionalMultiline(form.get("deliveryAddress"), 400, "Delivery address");
  if (!deliveryAddress.ok) errors.deliveryAddress = deliveryAddress.error;

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
      deliveryAddress: deliveryAddress.ok ? deliveryAddress.value : null,
      vatNumber,
      companyRegistrationNumber,
      notes: notes.ok ? notes.value : null,
    },
  };
}

/** Keeps only the rows of the business the person is currently working in. */
export function forOrganisation<T extends { organisationId: string }>(
  rows: readonly T[],
  organisationId: string,
): T[] {
  return rows.filter((row) => row.organisationId === organisationId);
}

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
