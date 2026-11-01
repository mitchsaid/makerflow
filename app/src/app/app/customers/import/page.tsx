import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { forOrganisation } from "@/lib/customers";
import { getCustomers } from "@/lib/customers/data";
import { nameKey } from "@/lib/import/products";
import { ImportCustomers } from "./import-customers";

/** Bring in a list of customers from a spreadsheet or a file (docs/plans/import-onboarding.md, slice 3). */
export default async function ImportCustomersPage() {
  const [{ organisation, profile }, allCustomers] = await Promise.all([requireOrganisation(), getCustomers()]);
  const existingNames = forOrganisation(allCustomers, organisation.id).map((c) => nameKey(c.name));
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader close={{ href: "/app/customers", label: "Customers" }}>
        <h1 className="text-xl font-semibold">Import customers</h1>
        <p className="text-muted-foreground">Bring in a list you already have.</p>
      </PageHeader>
      <ImportCustomers countryCode={profile.countryCode} existingNames={existingNames} />
    </main>
  );
}
