import { SettingsLink } from "@/components/settings-link";
import { AddLink } from "@/components/add-button";
import { requireOrganisation } from "@/lib/auth/dal";
import { draftRowsOf } from "@/lib/invoices/draft";
import { getInvoiceDrafts } from "@/lib/invoices/draft-data";
import { getInvoices } from "@/lib/invoices/data";
import { getRecurrences } from "@/lib/recurrence/data";
import { repeatRowsOf } from "@/lib/recurrence/rows";
import { getLocalePack, vatSettingsFor } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { parseInvoiceFilter } from "@/lib/invoices";
import { InvoiceList } from "./invoice-list";

export default async function InvoicesPage({ searchParams }: PageProps<"/app/invoices">) {
  // The invoices query runs beside the workspace check, not after it.
  const [allInvoices, allDrafts, allRepeats, { organisation, profile }, query] = await Promise.all([getInvoices(), getInvoiceDrafts(), getRecurrences(), requireOrganisation(), searchParams]);
  const locale = getLocalePack(profile.countryCode);
  const invoices = forOrganisation(allInvoices, organisation.id);
  const today = todayIn(locale.timeZone);
  const drafts = draftRowsOf(forOrganisation(allDrafts, organisation.id), vatSettingsFor(profile, locale));
  const repeats = repeatRowsOf(forOrganisation(allRepeats, organisation.id), vatSettingsFor(profile, locale), locale.formatLocale, today);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-2">
          {(invoices.length > 0 || drafts.length > 0 || repeats.length > 0) && (
            <AddLink href="/app/invoices/new" variant="default">
              New invoice
            </AddLink>
          )}
          <SettingsLink href="/app/invoices/settings" label="Invoice settings" />
        </div>
      </div>
      <InvoiceList key={parseInvoiceFilter(query.show) ?? "all"} initialFilter={parseInvoiceFilter(query.show) ?? "all"} invoices={invoices} drafts={drafts} repeats={repeats} currencyCode={profile.currencyCode} today={today} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} />
    </main>
  );
}
