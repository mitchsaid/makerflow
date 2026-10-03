import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { formatDay, todayIn } from "@/lib/quotes/dates";
import { getQuotes } from "@/lib/quotes/data";
import { quoteStatusKey, STATUS_FILTERS, type QuoteStatusKey } from "@/lib/quotes/status";
import { forOrganisation } from "@/lib/scope";
import { StatusChip } from "./status-chip";

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

  const counts = new Map<string, number>([["all", quotes.length]]);
  for (const q of quotes) counts.set(q.key, (counts.get(q.key) ?? 0) + 1);
  // Only filters with something in them, and "All" always.
  const filters = STATUS_FILTERS.filter((f) => f.key === "all" || (counts.get(f.key) ?? 0) > 0);
  const wanted = typeof query.status === "string" ? (query.status as QuoteStatusKey) : "all";
  const active = filters.some((f) => f.key === wanted) ? wanted : "all";
  const shown = active === "all" ? quotes : quotes.filter((q) => q.key === active);

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
              the price, then send it as a PDF.
            </p>
            <Link href="/app/quotes/new" className={buttonVariants()}>
              Start your first quote
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {filters.length > 2 && (
            <nav aria-label="Filter quotes">
              <ul className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <li key={f.key}>
                    <Link
                      href={f.key === "all" ? "/app/quotes" : `/app/quotes?status=${f.key}`}
                      aria-current={f.key === active ? "page" : undefined}
                      className={buttonVariants({ variant: f.key === active ? "default" : "outline" })}
                    >
                      {f.label} ({counts.get(f.key) ?? 0})
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <ul className="space-y-2">
            {shown.map((q) => (
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
                    <span className="shrink-0 font-medium">
                      {q.number}
                      {q.version > 1 ? ` · v${q.version}` : ""}
                    </span>
                    <StatusChip status={q.status} version={q.version} validUntil={q.validUntil} today={today} />
                    <span className="truncate">
                      {formatDay(q.issueDate, locale.formatLocale)} · valid until{" "}
                      {formatDay(q.validUntil, locale.formatLocale)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
