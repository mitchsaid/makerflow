import Link from "next/link";
import { AddLink } from "@/components/add-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { getQuotes } from "@/lib/quotes/data";
import { quoteStatusKey, type QuoteStatusKey } from "@/lib/quotes/status";
import { forOrganisation } from "@/lib/scope";
import { QuoteList } from "./quote-list";

export default async function QuotesPage({ searchParams }: PageProps<"/app/quotes">) {
  // The quotes query runs beside the workspace check, not after it.
  const [allQuotes, { organisation, profile }, query] = await Promise.all([
    getQuotes(),
    requireOrganisation(),
    searchParams,
  ]);
  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const quotes = forOrganisation(allQuotes, organisation.id).map((q) => ({
    ...q,
    key: quoteStatusKey({ status: q.status, version: q.version, validUntil: q.validUntil, today }),
  }));

  const wanted = typeof query.status === "string" ? (query.status as QuoteStatusKey) : "all";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Quotes</h1>
        <div className="flex items-center gap-2">
          {/* Numbering, wording, terms, themes and defaults for quotes. */}
          <Link href="/app/quotes/settings" className={buttonVariants({ variant: "outline" })}>
            Quote settings
          </Link>
          {quotes.length > 0 && (
            <AddLink href="/app/quotes/new" variant="default">
              New quote
            </AddLink>
          )}
        </div>
      </div>

      {quotes.length === 0 ? (
        <EmptyState title="No quotes yet" line="Pick a customer, add items and prices, then send a PDF.">
          <Link href="/app/quotes/new" className={buttonVariants()}>
            Start your first quote
          </Link>
        </EmptyState>
      ) : (
        <QuoteList quotes={quotes} today={today} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} initialFilter={wanted} />
      )}
    </main>
  );
}
