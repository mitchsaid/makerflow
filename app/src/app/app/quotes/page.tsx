import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { getQuotes } from "@/lib/quotes/data";
import { forOrganisation } from "@/lib/scope";

export default async function QuotesPage() {
  // The quotes query runs beside the workspace check, not after it.
  const [allQuotes, { organisation, profile }] = await Promise.all([getQuotes(), requireOrganisation()]);
  const quotes = forOrganisation(allQuotes, organisation.id);
  const locale = getLocalePack(profile.countryCode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Quotes</h1>
        {quotes.length > 0 && (
          <Link href="/app/quotes/new" className={buttonVariants()}>
            New quote
          </Link>
        )}
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-base font-medium">No quotes yet</p>
            <p className="text-muted-foreground">
              Build a quote in a couple of minutes: pick a customer, add what you are making and
              the price, and save it as a draft.
            </p>
            <Link href="/app/quotes/new" className={buttonVariants()}>
              Start your first quote
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/app/quotes/${q.id}`}
                className="block rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-medium">
                    {q.customerName ?? "No customer yet"}
                  </span>
                  <span className="shrink-0 text-base font-medium">
                    {formatMoney(q.grossCents, q.currencyCode, locale.numberStyle)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium capitalize">
                    {q.status}
                  </span>
                  <span className="truncate">
                    {formatDay(q.issueDate, locale.formatLocale)} · valid until{" "}
                    {formatDay(q.validUntil, locale.formatLocale)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
