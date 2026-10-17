import { requireOrganisation } from "@/lib/auth/dal";
import { getInvoices } from "@/lib/invoices/data";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage() {
  // The invoices query runs beside the workspace check, not after it.
  const [allInvoices, { organisation, profile }] = await Promise.all([getInvoices(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const invoices = forOrganisation(allInvoices, organisation.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold">Invoices</h1>
      <InvoiceList invoices={invoices} today={todayIn(locale.timeZone)} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} />
    </main>
  );
}
