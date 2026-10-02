import { customerDetail, type CustomerOption, type CustomerSummary } from "@/lib/customers";

/** What the picker shows beside a name, to tell two people apart. */
export function customerOptions(customers: readonly CustomerSummary[]): CustomerOption[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    detail: customerDetail(c),
    archived: c.archived,
  }));
}
