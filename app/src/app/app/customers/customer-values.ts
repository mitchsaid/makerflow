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
  deliveryAddress: string;
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
  deliveryAddress: "",
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
    deliveryAddress: c.deliveryAddress ?? "",
    vatNumber: c.vatNumber ?? "",
    companyRegistrationNumber: c.companyRegistrationNumber ?? "",
    notes: c.notes ?? "",
  };
}
