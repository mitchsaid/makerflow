import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomers } from "@/lib/customers/data";
import { CustomerList } from "./customer-list";

export default async function CustomersPage({ searchParams }: PageProps<"/app/customers">) {
  // The customers query runs beside the workspace check, not after it.
  const [customers, , params] = await Promise.all([
    getCustomers(),
    requireOrganisation(),
    searchParams,
  ]);
  const added = typeof params.added === "string" ? params.added : undefined;
  const addedName = customers.find((c) => c.id === added)?.name;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Customers</h1>
        {customers.length > 0 && (
          <Link href="/app/customers/new" className={buttonVariants()}>
            Add customer
          </Link>
        )}
      </div>
      <CustomerList customers={customers} addedName={addedName} />
    </main>
  );
}
