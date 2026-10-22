import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { blankInvoiceForm } from "@/lib/invoices/draft";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getProducts } from "@/lib/products/data";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { customerOptions } from "../../quotes/builder-data";
import { InvoiceDraftForm } from "../invoice-draft-form";

/** A new invoice with no quote (docs/plans/invoice-i3.md). Nothing is kept until Save draft or Issue invoice is pressed. */
export default async function NewInvoicePage({ searchParams }: PageProps<"/app/invoices/new">) {
  // The customers and products load beside the workspace check, not after it.
  const [allCustomers, allProducts, { organisation, profile }, query] = await Promise.all([
    getCustomersWithAddresses(),
    getProducts(),
    requireOrganisation(),
    searchParams,
  ]);
  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  // "New invoice" on a customer's page arrives with that customer chosen (only one of this business's, not archived).
  const wanted = typeof query.customer === "string" ? query.customer : "";
  const customerId = customers.some((c) => c.id === wanted && !c.archived) ? wanted : "";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader close={{ href: "/app/invoices", label: "Invoices" }}>
        <h1 className="text-xl font-semibold">New invoice</h1>
        <p className="text-sm text-muted-foreground">For work with no quote. It can be kept as a draft until you issue it.</p>
      </PageHeader>
      <InvoiceDraftForm
        draftId={null}
        initial={blankInvoiceForm({ today: todayIn(locale.timeZone), dueDays: locale.documents.invoice.dueDays, customerId })}
        quote={null}
        customers={customerOptions(customers, locale)}
        products={forOrganisation(allProducts, organisation.id)}
        countryCode={profile.countryCode}
        numberStyle={locale.numberStyle}
        currencyCode={profile.currencyCode}
        vat={vatSettingsFor(profile, locale)}
        taxName={locale.tax.name}
        vatStatuses={locale.tax.statuses}
        businessTypes={profile.businessTypes}
      />
    </main>
  );
}
