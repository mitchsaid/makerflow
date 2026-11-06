import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { getCustomersWithAddresses } from "@/lib/customers/data";
import { blankInvoiceForm } from "@/lib/invoices/draft";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { getMaterials } from "@/lib/materials/data";
import { getProducts } from "@/lib/products/data";
import { todayIn } from "@/lib/quotes/dates";
import { getRecurrence } from "@/lib/recurrence/data";
import { describeSchedule } from "@/lib/recurrence/schedule";
import { forOrganisation } from "@/lib/scope";
import { notFound } from "next/navigation";
import { customerOptions } from "../../../quotes/builder-data";
import { productCosting } from "../../../products/product-costing";
import { InvoiceDraftForm } from "../../invoice-draft-form";

/** What a repeat makes: the invoice it starts each new draft as, changed for the ones made from now on. */
export default async function RepeatPage({ params }: PageProps<"/app/invoices/repeats/[id]">) {
  const { id } = await params;
  const [repeat, allCustomers, allProducts, allMaterials, { organisation, profile }] = await Promise.all([
    getRecurrence(id),
    getCustomersWithAddresses(),
    getProducts(),
    getMaterials(),
    requireOrganisation(),
  ]);
  // Another business of the same person is not this workspace's repeat.
  if (repeat.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const customers = forOrganisation(allCustomers, organisation.id);
  const unreadable = repeat.form === null;
  const initial = repeat.form ?? blankInvoiceForm({ today: todayIn(locale.timeZone), dueDays: locale.documents.invoice.dueDays });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/invoices?show=repeating", label: "Invoices" }}>
        <h1 className="text-2xl font-semibold">What this repeats</h1>
        {repeat.schedule && <p className="text-base text-muted-foreground">{describeSchedule(repeat.schedule, locale.formatLocale)}</p>}
      </PageHeader>
      {unreadable && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>This could not be read, so it starts empty. Saving replaces it, or you can stop the repeat from the list.</AlertDescription>
        </Alert>
      )}
      <InvoiceDraftForm
        key={repeat.id}
        repeat={{ id: repeat.id }}
        usualDueDays={locale.documents.invoice.dueDays}
        draftId={null}
        initial={initial}
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
        costing={productCosting(allMaterials, organisation.id, profile, locale)}
      />
    </main>
  );
}
