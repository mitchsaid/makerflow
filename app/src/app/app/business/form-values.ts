import type { BusinessProfile } from "@/lib/business-profile";
import type { FormValues } from "./business-profile-form";

/** The Business details form's starting values: what the business has saved. */
export function businessFormValues(businessName: string, profile: BusinessProfile): FormValues {
  return {
    name: businessName,
    ownerName: profile.ownerName ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    region: profile.region ?? "",
    postalCode: profile.postalCode ?? "",
    vatRegistered: profile.vatRegistered,
    vatNumber: profile.vatNumber ?? "",
    pricesIncludeVat: profile.pricesIncludeVat ? "inclusive" : "exclusive",
    businessTypes: [...(profile.businessTypes ?? [])],
  };
}
