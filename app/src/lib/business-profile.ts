import { ZA_PROVINCES, validatePostalCode, validateVatNumber } from "./locale/za";
import {
  validateBusinessName,
  validateEmail,
  validatePhone,
  type ValidationResult,
} from "./validation";

export type BusinessProfile = {
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
};

export type FieldName =
  | "name"
  | "phone"
  | "email"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postalCode"
  | "vatNumber";

export type FieldErrors = Partial<Record<FieldName, string>>;

export type ParsedBusinessProfileForm =
  | { ok: true; name: string; profile: BusinessProfile }
  | { ok: false; errors: FieldErrors };

const MAX = { addressLine1: 120, addressLine2: 120, city: 80 } as const;

/** Empty becomes null. Over-long is an error. */
function optionalText(
  raw: FormDataEntryValue | null,
  max: number,
  label: string,
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (value === "") return { ok: true, value: null };
  if (value.length > max) {
    return { ok: false, error: `${label} can be up to ${max} characters.` };
  }
  return { ok: true, value };
}

/** Same, but runs a stricter validator when something was entered. */
function optionalValidated(
  raw: FormDataEntryValue | null,
  validate: (input: unknown) => ValidationResult<string>,
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { ok: true, value: null };
  return validate(value);
}

/**
 * Turns the settings form into validated values. Empty optional fields become
 * null (the database stores NULL, never empty strings). VAT number is required
 * when "registered for VAT" is ticked and dropped when it is not.
 */
export function parseBusinessProfileForm(form: FormData): ParsedBusinessProfileForm {
  const errors: FieldErrors = {};

  const name = validateBusinessName(form.get("name"));
  if (!name.ok) errors.name = name.error;

  const phone = optionalValidated(form.get("phone"), validatePhone);
  if (!phone.ok) errors.phone = phone.error;

  const email = optionalValidated(form.get("email"), validateEmail);
  if (!email.ok) errors.email = email.error;

  const addressLine1 = optionalText(form.get("addressLine1"), MAX.addressLine1, "Address");
  if (!addressLine1.ok) errors.addressLine1 = addressLine1.error;

  const addressLine2 = optionalText(form.get("addressLine2"), MAX.addressLine2, "Address");
  if (!addressLine2.ok) errors.addressLine2 = addressLine2.error;

  const city = optionalText(form.get("city"), MAX.city, "City");
  if (!city.ok) errors.city = city.error;

  const regionRaw = typeof form.get("region") === "string" ? String(form.get("region")).trim() : "";
  let region: string | null = null;
  if (regionRaw !== "") {
    if ((ZA_PROVINCES as readonly string[]).includes(regionRaw)) {
      region = regionRaw;
    } else {
      errors.region = "Please choose a province from the list.";
    }
  }

  const postalCode = optionalValidated(form.get("postalCode"), validatePostalCode);
  if (!postalCode.ok) errors.postalCode = postalCode.error;

  const vatRegistered = form.get("vatRegistered") === "on";
  let vatNumber: string | null = null;
  if (vatRegistered) {
    const vat = validateVatNumber(form.get("vatNumber"));
    if (vat.ok) vatNumber = vat.value;
    else errors.vatNumber = vat.error;
  }

  if (Object.keys(errors).length > 0 || !name.ok) return { ok: false, errors };

  return {
    ok: true,
    name: name.value,
    profile: {
      phone: phone.ok ? phone.value : null,
      email: email.ok ? email.value : null,
      addressLine1: addressLine1.ok ? addressLine1.value : null,
      addressLine2: addressLine2.ok ? addressLine2.value : null,
      city: city.ok ? city.value : null,
      region,
      postalCode: postalCode.ok ? postalCode.value : null,
      vatRegistered,
      vatNumber,
    },
  };
}

/** Enough for a quote header: an address and some way to get in touch. */
export function isBusinessProfileComplete(profile: BusinessProfile): boolean {
  return Boolean(
    profile.addressLine1 && profile.city && (profile.phone || profile.email),
  );
}

export const PROMPTS = {
  businessDetails: "business-details",
} as const;

export type PromptKey = (typeof PROMPTS)[keyof typeof PROMPTS];

export function canEditBusinessProfile(role: string | null): boolean {
  return role === "owner" || role === "admin";
}
