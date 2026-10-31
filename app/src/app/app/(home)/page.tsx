import Link from "@/components/app-link";
import { AddLink } from "@/components/add-button";
import { CreateNew } from "./create-new";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getActiveJobDates } from "@/lib/jobs/data";
import { jobDueCounts } from "@/lib/jobs";
import { getOwedTotals } from "@/lib/invoices/data";
import { getQuoteStatuses } from "@/lib/quotes/data";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";

export default async function WorkspacePage() {
  // The jobs query runs beside the workspace check, not after it; what is owed needs the business, so it follows.
  const [activeJobs, quoteStatuses, { organisation, profile }] = await Promise.all([getActiveJobDates(), getQuoteStatuses(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const owed = await getOwedTotals(organisation.id, today);
  const counts = jobDueCounts(forOrganisation(activeJobs, organisation.id), today);
  const quotes = forOrganisation(quoteStatuses, organisation.id);
  const waiting = quotes.filter((q) => q.status === "sent").length;
  const drafts = quotes.filter((q) => q.status === "draft").length;

  const firstRun = quotes.length === 0 && counts.active === 0 && owed.count === 0 && owed.paidThisMonthCents === 0;
  // What needs the maker, money first (docs/ux-review-2026-10-25.md, N7). A count of nothing is left out.
  // Owing and overdue as before, and what came in this month; each only when it is more than nothing.
  const showMoney = owed.count > 0 || owed.paidThisMonthCents > 0;
  const showQuotes = waiting > 0 || drafts > 0;
  const showJobs = counts.active > 0;
  // Money paid this month is good news, not a thing to do: only what is owed, waiting or due keeps Home from being caught up.
  const caughtUp = !firstRun && owed.count === 0 && !showQuotes && !showJobs;
  const money = (cents: number) => formatMoney(cents, profile.currencyCode, locale.numberStyle);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold" data-testid="business-name">
          {organisation.name}
        </h1>
        <CreateNew />
      </div>

      {firstRun && (
        // Nothing yet: the first thing a maker does is a quote, so say so.
        <Card data-testid="home-first-quote">
          <CardHeader>
            <CardTitle className="text-lg">Make your first quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base text-muted-foreground">Pick a customer, add items and prices, then send a PDF.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AddLink href="/app/quotes/new" variant="default">
                New quote
              </AddLink>
              <AddLink href="/app/jobs/new" variant="outline">
                New job
              </AddLink>
            </div>
          </CardContent>
        </Card>
      )}

      {caughtUp && (
        <Card data-testid="home-caught-up">
          <CardHeader>
            <CardTitle className="text-lg">You&apos;re all caught up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base text-muted-foreground">Nothing is owed, waiting for an answer or due to be made.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <AddLink href="/app/quotes/new" variant="default">
                New quote
              </AddLink>
              <AddLink href="/app/jobs/new" variant="outline">
                New job
              </AddLink>
            </div>
          </CardContent>
        </Card>
      )}

      {showMoney && (
        <Card data-testid="home-money">
          <CardHeader>
            <CardTitle className="text-lg">Your money</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {/* Overdue first, and only when something is. */}
              {owed.overdueCents > 0 && (
                <li>
                  <MoneyLink href="/app/invoices?show=overdue" label="Overdue" text={money(owed.overdueCents)} tone="late" testId="home-overdue" />
                </li>
              )}
              {owed.count > 0 && (
                <li>
                  <MoneyLink href="/app/invoices?show=unpaid" label="Owing" text={money(owed.owingCents)} tone="calm" testId="home-owing" />
                </li>
              )}
              {owed.paidThisMonthCents > 0 && (
                <li>
                  <MoneyLink href="/app/invoices" label="Paid this month" text={money(owed.paidThisMonthCents)} tone="calm" testId="home-paid" />
                </li>
              )}
            </ul>
            <Link href="/app/invoices" className="inline-flex min-h-11 items-center font-medium underline">
              {owed.count === 0 ? "See your invoices" : owed.count === 1 ? "See the invoice" : `See all ${owed.count} invoices owing`}
            </Link>
          </CardContent>
        </Card>
      )}

      {showQuotes && (
        <Card data-testid="home-quotes">
          <CardHeader>
            <CardTitle className="text-lg">Your quotes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {waiting > 0 && (
                <li>
                  <CountLink href="/app/quotes?status=sent" label="Waiting for an answer" count={waiting} testId="home-quotes-waiting" />
                </li>
              )}
              {drafts > 0 && (
                <li>
                  <CountLink href="/app/quotes?status=draft" label={drafts === 1 ? "Draft" : "Drafts"} count={drafts} testId="home-quotes-drafts" />
                </li>
              )}
            </ul>
            <AddLink href="/app/quotes/new" variant="outline">
              New quote
            </AddLink>
          </CardContent>
        </Card>
      )}

      {showJobs && (
        <Card data-testid="home-jobs">
          <CardHeader>
            <CardTitle className="text-lg">Your jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {counts.late > 0 || counts.thisWeek > 0 ? (
              <ul className="grid grid-cols-2 gap-3">
                {counts.late > 0 && (
                  <li>
                    <DueLink href="/app/jobs?show=late" label="Late" count={counts.late} tone="late" />
                  </li>
                )}
                {counts.thisWeek > 0 && (
                  <li>
                    <DueLink href="/app/jobs?show=week" label="Needed this week" count={counts.thisWeek} tone="calm" />
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-base text-muted-foreground">Nothing is due in the next week.</p>
            )}
            <Link href="/app/jobs" className="inline-flex min-h-11 items-center font-medium underline">
              {counts.active === 1 ? "See the job to do" : `See all ${counts.active} jobs to do`}
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

/** An amount that opens the Invoices list already narrowed to those invoices. */
function MoneyLink({ href, label, text, tone, testId }: { href: string; label: string; text: string; tone: "late" | "calm"; testId: string }) {
  return (
    <Link
      href={href}
      className="block min-h-11 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={`block text-2xl font-semibold ${tone === "late" ? "text-destructive" : ""}`} data-testid={testId}>
        {text}
      </span>
      <span className="block text-base text-muted-foreground">{label}</span>
    </Link>
  );
}

/** A count that opens the Jobs list already narrowed to those jobs. */
function DueLink({ href, label, count, tone }: { href: string; label: string; count: number; tone: "late" | "calm" }) {
  return (
    <Link
      href={href}
      className="block min-h-11 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={`block text-3xl font-semibold ${tone === "late" ? "text-destructive" : ""}`} data-testid={`home-count-${label === "Late" ? "late" : "week"}`}>
        {count}
      </span>
      <span className="block text-base text-muted-foreground">{label}</span>
    </Link>
  );
}

/** A count that opens a list already narrowed to it. */
function CountLink({ href, label, count, testId }: { href: string; label: string; count: number; testId: string }) {
  return (
    <Link
      href={href}
      className="block min-h-11 rounded-xl px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="block text-3xl font-semibold" data-testid={testId}>
        {count}
      </span>
      <span className="block text-base text-muted-foreground">{label}</span>
    </Link>
  );
}
