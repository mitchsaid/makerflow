import type { CustomerSummary } from "@/lib/customers";
import type { CustomerOption } from "./customer-picker";

/** What the picker shows beside a name, to tell two people apart. */
export function customerOptions(customers: readonly CustomerSummary[]): CustomerOption[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    detail: [c.contactPerson, c.phone ?? c.email, c.city].filter(Boolean).join(" · "),
    archived: c.archived,
  }));
}
