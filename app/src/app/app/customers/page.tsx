import { requireOrganisation } from "@/lib/auth/dal";
import { forOrganisation } from "@/lib/customers";
import { getCustomers } from "@/lib/customers/data";
import { CustomerList } from "./customer-list";
import { AddLink } from "@/components/add-button";
import { SettingsLink } from "@/components/settings-link";

export default async function CustomersPage({ searchParams }: PageProps<"/app/customers">) {
  // The customers query runs beside the workspace check, not after it.
  const [allCustomers, { organisation }, params] = await Promise.all([
    getCustomers(),
    requireOrganisation(),
    searchParams,
  ]);
  const customers = forOrganisation(allCustomers, organisation.id);
  const added = typeof params.added === "string" ? params.added : undefined;
  const addedName = customers.find((c) => c.id === added)?.name;
  const imported = typeof params.imported === "string" && /^\d{1,3}$/.test(params.imported) ? Number(params.imported) : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Customers</h1>
        <div className="flex items-center gap-2">
          {customers.length > 0 && (
            <AddLink href="/app/customers/new" variant="default">
              Add customer
            </AddLink>
          )}
          {/* Customer settings: for now, bringing in a list. */}
          <SettingsLink href="/app/customers/settings" label="Customer settings" />
        </div>
      </div>
      <CustomerList customers={customers} addedName={addedName} importedCount={imported} />
    </main>
  );
}
