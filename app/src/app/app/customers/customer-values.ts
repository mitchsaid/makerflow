import type { Customer } from "@/lib/customers";

/** What the customer form holds while it is being filled in: every field is text or a switch. */
export type CustomerFormValues = {
  name: string;
  isBusiness: boolean;
  contactPerson: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  /** Deliveries go to the address above (the default). The parts below are used when this is off. */
  deliverySameAsMain: boolean;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string;
  deliveryCity: string;
  deliveryRegion: string;
  deliveryPostalCode: string;
  vatNumber: string;
  companyRegistrationNumber: string;
  notes: string;
};

export const EMPTY_CUSTOMER: CustomerFormValues = {
  name: "",
  isBusiness: false,
  contactPerson: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  deliverySameAsMain: true,
  deliveryAddressLine1: "",
  deliveryAddressLine2: "",
  deliveryCity: "",
  deliveryRegion: "",
  deliveryPostalCode: "",
  vatNumber: "",
  companyRegistrationNumber: "",
  notes: "",
};

export function valuesFromCustomer(c: Customer): CustomerFormValues {
  return {
    name: c.name,
    isBusiness: c.kind === "business",
    contactPerson: c.contactPerson ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    region: c.region ?? "",
    postalCode: c.postalCode ?? "",
    deliverySameAsMain: c.deliverySameAsMain,
    deliveryAddressLine1: c.deliveryAddressLine1 ?? "",
    deliveryAddressLine2: c.deliveryAddressLine2 ?? "",
    deliveryCity: c.deliveryCity ?? "",
    deliveryRegion: c.deliveryRegion ?? "",
    deliveryPostalCode: c.deliveryPostalCode ?? "",
    vatNumber: c.vatNumber ?? "",
    companyRegistrationNumber: c.companyRegistrationNumber ?? "",
    notes: c.notes ?? "",
  };
}
