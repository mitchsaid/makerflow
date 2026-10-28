import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getMaterials } from "@/lib/materials/data";
import { getProducts } from "@/lib/products/data";
import { forOrganisation } from "@/lib/scope";
import { customerOptions } from "../../quotes/builder-data";
import { productCosting } from "../../products/product-costing";
import { NewJobForm } from "./new-job-form";
import { PageHeader } from "@/components/page-header";

export default async function NewJobPage({ searchParams }: PageProps<"/app/jobs/new">) {
  // The customers and products load beside the workspace check, not after it.
  const [allCustomers, allProducts, allMaterials, { organisation, profile }, query] = await Promise.all([
    getCustomersWithAddresses(),
    getProducts(),
    getMaterials(),
    requireOrganisation(),
    searchParams,
  ]);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  // "New job" on a customer's page arrives with that customer chosen (only one of this business's, not archived).
  const wanted = typeof query.customer === "string" ? query.customer : "";
  const startCustomerId = customers.some((c) => c.id === wanted && !c.archived) ? wanted : "";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader close={{ href: "/app/jobs", label: "Jobs" }}>
        <h1 className="text-xl font-semibold">New job</h1>
        <p className="text-sm text-muted-foreground">
          For work without a quote: a walk-in, a repeat, something agreed on WhatsApp.
        </p>
      </PageHeader>
      <NewJobForm
        customers={customerOptions(customers, locale)}
        initialCustomerId={startCustomerId}
        products={forOrganisation(allProducts, organisation.id)}
        countryCode={profile.countryCode}
        numberStyle={locale.numberStyle}
        currencyCode={profile.currencyCode}
        vat={vatSettingsFor(profile, locale)}
        taxName={locale.tax.name}
        vatStatuses={locale.tax.statuses}
        businessTypes={profile.businessTypes}
        costing={productCosting(allMaterials, organisation.id, profile, locale)}
      />
    </main>
  );
}
