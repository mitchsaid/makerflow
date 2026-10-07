import { customerDetail, savedAddresses, type CustomerOption, type CustomerSummary } from "@/lib/customers";
import type { LocalePack } from "@/lib/locale";

/** What the picker shows beside a name, to tell two people apart, and the addresses a delivery can go to. */
export function customerOptions(customers: readonly CustomerSummary[], locale: LocalePack): CustomerOption[] {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    detail: customerDetail(c),
    archived: c.archived,
    addresses: savedAddresses(c, locale),
  }));
}
