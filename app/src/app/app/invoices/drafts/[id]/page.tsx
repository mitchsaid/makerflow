import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { blankInvoiceForm } from "@/lib/invoices/draft";
import { getInvoiceDraft } from "@/lib/invoices/draft-data";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getMaterials } from "@/lib/materials/data";
import { getProducts } from "@/lib/products/data";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { customerOptions } from "../../../quotes/builder-data";
import { productCosting } from "../../../products/product-costing";
import { InvoiceDraftForm } from "../../invoice-draft-form";

/** An invoice draft: opened for changes, kept, discarded or issued. */
export default async function InvoiceDraftPage({ params, searchParams }: PageProps<"/app/invoices/drafts/[id]">) {
  const { id } = await params;
  // The draft, the customers and the products load beside the workspace check, not after it.
  const [draft, allCustomers, allProducts, allMaterials, { organisation, profile }, query] = await Promise.all([
    getInvoiceDraft(id),
    getCustomersWithAddresses(),
    getProducts(),
    getMaterials(),
    requireOrganisation(),
    searchParams,
  ]);
  // Another business of the same person is not this workspace's draft.
  if (draft.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  // What is stored should always be an invoice form; if it somehow is not, the draft opens empty rather than not at all
  // (it could never be discarded otherwise), and says so.
  const unreadable = draft.form === null;
  const initial = draft.form ?? blankInvoiceForm({ today: todayIn(locale.timeZone), dueDays: locale.documents.invoice.dueDays });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/invoices?show=drafts", label: "Invoices" }}>
        <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
          <span>Invoice draft</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Not sent</span>
        </h1>
      </PageHeader>
      {unreadable && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>This draft could not be read, so it starts empty. Saving replaces it, or you can discard it.</AlertDescription>
        </Alert>
      )}
      <InvoiceDraftForm
        key={draft.id}
        draftId={draft.id}
        initial={initial}
        quote={draft.quoteId && draft.quoteNumber ? { id: draft.quoteId, number: draft.quoteNumber } : null}
        justSaved={query.saved === "1"}
        customers={customerOptions(customers, locale)}
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
