import { requireOrganisation } from "@/lib/auth/dal";
import { getInvoices } from "@/lib/invoices/data";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { parseInvoiceFilter } from "@/lib/invoices";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage({ searchParams }: PageProps<"/app/invoices">) {
  // The invoices query runs beside the workspace check, not after it.
  const [allInvoices, { organisation, profile }, query] = await Promise.all([getInvoices(), requireOrganisation(), searchParams]);
  const locale = getLocalePack(profile.countryCode);
  const invoices = forOrganisation(allInvoices, organisation.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Invoices</h1>
      <InvoiceList key={parseInvoiceFilter(query.show) ?? "all"} initialFilter={parseInvoiceFilter(query.show) ?? "all"} invoices={invoices} today={todayIn(locale.timeZone)} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} />
    </main>
  );
}
