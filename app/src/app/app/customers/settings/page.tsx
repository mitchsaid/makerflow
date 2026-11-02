import { ImportCard } from "@/components/import-card";
import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";

/**
 * Customer settings: for now, bringing in a list of customers from a spreadsheet or file. Like the other lists, the
 * header of the Customers page holds the create button and the settings gear; the rest lives here.
 */
export default async function CustomerSettingsPage() {
  await requireOrganisation();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/customers", label: "Customers" }}>
        <h1 className="text-xl font-semibold">Customer settings</h1>
      </PageHeader>
      <ImportCard title="Import" line="Bring in customers from a spreadsheet or file." href="/app/customers/import" label="Import a list" />
    </main>
  );
}
