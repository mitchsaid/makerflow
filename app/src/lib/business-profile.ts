import type { BusinessType } from "./business-types";
import { optionalChoice, optionalText, optionalValidated } from "./form-values";
import type { ContactFacts, LocalePack } from "./locale";
import {
  validateBusinessName,
  validateEmail,
  validatePhone,
} from "./validation";

export type BusinessProfile = {
  /** What the business makes or sells (see lib/business-types): null = never asked, empty = skipped. */
  businessTypes: BusinessType[] | null;
  /** What a new quote starts with for its deposit: 'none', a percentage (basis points) or an amount (cents). */
  defaultDepositKind: "none" | "percent" | "fixed";
  defaultDepositValue: number;
  /** What a new quote starts with for delivery or collection (null: nothing chosen). */
  usualFulfilment: "collection" | "delivery" | null;
  /** When an owner or admin answered or skipped the first-quote questions (null: not asked yet). */
  quoteSetupAt: string | null;
  /** ISO country code (business_profiles.country_code): selects the locale pack. Not editable. */
  countryCode: string;
  /** ISO currency code. Not editable yet. */
  currencyCode: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  vatRegistered: boolean;
  vatNumber: string | null;
  /** Does the business type its prices including VAT? Only matters when VAT registered. */
  pricesIncludeVat: boolean;
  /** What a new quote starts with for its sign-off, terms and "how to pay". Edited under Quote wording. */
  defaultSignOff: string | null;
  defaultTerms: string | null;
  paymentInstructions: string | null;
  /** The logo (an id from lib/images), printed at the top of documents. Null for none. Set under Quotes and invoices. */
  logoImageId: string | null;
};

/** What the Business details form edits (the quote wording has its own form). */
export type BusinessDetails = Omit<BusinessProfile, "defaultSignOff" | "defaultTerms" | "paymentInstructions" | "businessTypes" | "defaultDepositKind" | "defaultDepositValue" | "usualFulfilment" | "quoteSetupAt" | "logoImageId">;

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
  | { ok: true; name: string; profile: BusinessDetails }
  | { ok: false; errors: FieldErrors };

const MAX = { addressLine1: 120, addressLine2: 120, city: 80 } as const;

/**
 * Turns the settings form into validated values. Empty optional fields become
 * null (the database stores NULL, never empty strings). VAT number is required
 * when "registered for VAT" is ticked and dropped when it is not.
 */
export function parseBusinessProfileForm(
  form: FormData,
  locale: LocalePack,
): ParsedBusinessProfileForm {
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

  const regionResult = optionalChoice(
    form.get("region"),
    locale.address.regions,
    `Please choose a ${locale.address.regionLabel.toLowerCase()} from the list.`,
  );
  if (!regionResult.ok) errors.region = regionResult.error;
  const region = regionResult.ok ? regionResult.value : null;

  const postalCode = optionalValidated(form.get("postalCode"), locale.address.validatePostalCode);
  if (!postalCode.ok) errors.postalCode = postalCode.error;

  const vatRegistered = form.get("vatRegistered") === "on";
  let vatNumber: string | null = null;
  if (vatRegistered) {
    const vat = locale.tax.validateRegistrationNumber(form.get("vatNumber"));
    if (vat.ok) vatNumber = vat.value;
    else errors.vatNumber = vat.error;
  }

  // Price entry mode: only asked of VAT-registered businesses. Anything but an explicit
  // "exclusive" means including VAT, the safe default (quoted prices must include VAT).
  const pricesIncludeVat = !(vatRegistered && form.get("pricesIncludeVat") === "exclusive");

  if (Object.keys(errors).length > 0 || !name.ok) return { ok: false, errors };

  return {
    ok: true,
    name: name.value,
    profile: {
      countryCode: locale.countryCode,
      currencyCode: locale.currencyCode,
      phone: phone.ok ? phone.value : null,
      email: email.ok ? email.value : null,
      addressLine1: addressLine1.ok ? addressLine1.value : null,
      addressLine2: addressLine2.ok ? addressLine2.value : null,
      city: city.ok ? city.value : null,
      region,
      postalCode: postalCode.ok ? postalCode.value : null,
      vatRegistered,
      vatNumber,
      pricesIncludeVat,
    },
  };
}

/**
 * What is still missing before the business can send a QUOTE or issue an INVOICE. The rules
 * differ by country, so they come from the business's locale pack (for South Africa: a quote
 * needs only a way to be contacted; an invoice also needs the address of the premises).
 */
export function missingForQuote(profile: ContactFacts, locale: LocalePack): FieldName[] {
  return locale.documents.missingForQuote(profile);
}

export function missingForInvoice(profile: ContactFacts, locale: LocalePack): FieldName[] {
  return locale.documents.missingForInvoice(profile);
}

export function canEditBusinessProfile(role: string | null): boolean {
  return role === "owner" || role === "admin";
}
