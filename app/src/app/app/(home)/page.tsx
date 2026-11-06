import Link from "@/components/app-link";
import { AddLink } from "@/components/add-button";
import { CreateNew } from "./create-new";
import { InstallCard } from "../install-card";
import { isNewBusiness } from "@/lib/install";
import {
  CalendarClock as CalendarClockIcon,
  CircleAlert as CircleAlertIcon,
  CircleCheck as CircleCheckIcon,
  FileText as FileTextIcon,
  HandCoins as HandCoinsIcon,
  Hammer as HammerIcon,
  Hourglass as HourglassIcon,
  ListTodo as ListTodoIcon,
  PackageCheck as PackageCheckIcon,
  PencilLine as PencilLineIcon,
  Repeat as RepeatIcon,
  TriangleAlert as TriangleAlertIcon,
  Wallet as WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoThumb } from "@/components/photo-thumb";
import { requireOrganisation } from "@/lib/auth/dal";
import { getActiveJobDates } from "@/lib/jobs/data";
import { jobDueCounts } from "@/lib/jobs";
import { getOwedTotals } from "@/lib/invoices/data";
import { getQuoteStatuses } from "@/lib/quotes/data";
import { getRepeatNotices } from "@/lib/recurrence/data";
import { getLocalePack } from "@/lib/locale";
import { formatMoney } from "@/lib/money";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";

export default async function WorkspacePage() {
  // The jobs query runs beside the workspace check, not after it; what is owed needs the business, so it follows.
  const [activeJobs, quoteStatuses, repeatNotices, { organisation, profile, demo }] = await Promise.all([getActiveJobDates(), getQuoteStatuses(), getRepeatNotices(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const owed = await getOwedTotals(organisation.id, today);
  const counts = jobDueCounts(forOrganisation(activeJobs, organisation.id), today);
  const quotes = forOrganisation(quoteStatuses, organisation.id);
  const waiting = quotes.filter((q) => q.status === "sent").length;
  const drafts = quotes.filter((q) => q.status === "draft").length;
  // Invoice drafts a repeat made that are waiting to be checked, and repeats that paused themselves (docs/plans/recurring.md).
  const repeatReady = repeatNotices.readyOrganisationIds.filter((id) => id === organisation.id).length;
  const repeatPaused = repeatNotices.pausedOrganisationIds.filter((id) => id === organisation.id).length;
  const showRepeats = repeatReady > 0 || repeatPaused > 0;

  const firstRun = quotes.length === 0 && counts.active === 0 && owed.count === 0 && owed.paidThisMonthCents === 0;
  // What needs the maker, money first (docs/ux-review-2026-10-25.md, N7). A count of nothing is left out.
  // Owing and overdue as before, and what came in this month; each only when it is more than nothing.
  const showMoney = owed.count > 0 || owed.paidThisMonthCents > 0;
  const showQuotes = waiting > 0 || drafts > 0;
  const showJobs = counts.active > 0;
  // Money paid this month is good news, not a thing to do: only what is owed, waiting or due keeps Home from being caught up.
  const caughtUp = !firstRun && owed.count === 0 && !showQuotes && !showJobs && !showRepeats;
  const money = (cents: number) => formatMoney(cents, profile.currencyCode, locale.numberStyle);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* The business's own logo, when it has one. */}
          <PhotoThumb imageId={profile.logoImageId} size="lg" className="rounded-xl" />
          <h1 className="min-w-0 text-3xl leading-tight font-semibold" data-testid="business-name">
            {organisation.name}
          </h1>
        </div>
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

      {/* One time, just after signing up, on a phone that can add it to the home screen; below the first quote, which stays the main thing to do. */}
      <InstallCard newBusiness={!demo && isNewBusiness(organisation.createdAt)} />

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
            <SectionTitle icon={WalletIcon}>Your money</SectionTitle>
            <CardDescription className="text-base">What your customers owe you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {/* Overdue first, and only when something is. */}
              {owed.overdueCents > 0 && (
                <li className="col-span-2">
                  <Tile href="/app/invoices?show=overdue" icon={CircleAlertIcon} label="Overdue" hint="Late payments owed to you" text={money(owed.overdueCents)} tone="late" testId="home-overdue" />
                </li>
              )}
              {owed.count > 0 && (
                <li>
                  <Tile href="/app/invoices?show=unpaid" icon={HandCoinsIcon} label="Owed to you" text={money(owed.owingCents)} tone="calm" testId="home-owing" />
                </li>
              )}
              {owed.paidThisMonthCents > 0 && (
                <li>
                  <Tile href="/app/invoices" icon={CircleCheckIcon} label="Paid this month" text={money(owed.paidThisMonthCents)} tone="good" testId="home-paid" />
                </li>
              )}
            </ul>
            <Link href="/app/invoices" className="inline-flex min-h-11 items-center font-medium underline">
              {owed.count === 0 ? "See your invoices" : owed.count === 1 ? "See the invoice owed to you" : `See all ${owed.count} invoices owed to you`}
            </Link>
          </CardContent>
        </Card>
      )}

      {showRepeats && (
        <Card data-testid="home-repeats">
          <CardHeader>
            <SectionTitle icon={RepeatIcon}>Your repeats</SectionTitle>
            <CardDescription className="text-base">Invoices that make themselves, as drafts for you to check.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {repeatReady > 0 && (
                <li>
                  <Tile href="/app/invoices?show=drafts" icon={PencilLineIcon} label={repeatReady === 1 ? "Repeat ready to check" : "Repeats ready to check"} text={String(repeatReady)} tone="calm" big testId="home-repeats-ready" />
                </li>
              )}
              {repeatPaused > 0 && (
                <li>
                  <Tile href="/app/invoices?show=repeating" icon={TriangleAlertIcon} label={repeatPaused === 1 ? "Repeat paused" : "Repeats paused"} hint="It needs a look" text={String(repeatPaused)} tone="late" big testId="home-repeats-paused" />
                </li>
              )}
            </ul>
            <Link href="/app/invoices?show=repeating" className="inline-flex min-h-11 items-center font-medium underline">
              See your repeats
            </Link>
          </CardContent>
        </Card>
      )}

      {showQuotes && (
        <Card data-testid="home-quotes">
          <CardHeader>
            <SectionTitle icon={FileTextIcon}>Your quotes</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {waiting > 0 && (
                <li>
                  <Tile href="/app/quotes?status=sent" icon={HourglassIcon} label="Waiting for an answer" text={String(waiting)} tone="calm" big testId="home-quotes-waiting" />
                </li>
              )}
              {drafts > 0 && (
                <li>
                  <Tile href="/app/quotes?status=draft" icon={PencilLineIcon} label={drafts === 1 ? "Draft" : "Drafts"} text={String(drafts)} tone="calm" big testId="home-quotes-drafts" />
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
            <SectionTitle icon={HammerIcon}>Your jobs</SectionTitle>
            <CardDescription className="text-base">Where the work you have taken on stands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid grid-cols-2 gap-3">
              {counts.late > 0 && (
                <li>
                  <Tile href="/app/jobs?show=late" icon={TriangleAlertIcon} label="Late" text={String(counts.late)} tone="late" big testId="home-count-late" />
                </li>
              )}
              {counts.thisWeek > 0 && (
                <li>
                  <Tile href="/app/jobs?show=week" icon={CalendarClockIcon} label="Needed this week" text={String(counts.thisWeek)} tone="calm" big testId="home-count-week" />
                </li>
              )}
              {counts.inProgress > 0 && (
                <li>
                  <Tile href="/app/jobs" icon={HammerIcon} label="In progress" text={String(counts.inProgress)} tone="calm" big testId="home-count-in-progress" />
                </li>
              )}
              {counts.ready > 0 && (
                <li>
                  <Tile href="/app/jobs" icon={PackageCheckIcon} label="Ready" text={String(counts.ready)} tone="good" big testId="home-count-ready" />
                </li>
              )}
              {counts.notStarted > 0 && (
                <li>
                  <Tile href="/app/jobs" icon={ListTodoIcon} label="Not started" text={String(counts.notStarted)} tone="calm" big testId="home-count-not-started" />
                </li>
              )}
            </ul>
            <Link href="/app/jobs" className="inline-flex min-h-11 items-center font-medium underline">
              {counts.active === 1 ? "See the job to do" : `See all ${counts.active} jobs to do`}
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

/** A card's title, with a small icon in a tinted square so the cards are told apart at a glance. */
function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <CardTitle className="text-lg">{children}</CardTitle>
    </div>
  );
}

const TONE_TEXT = { late: "text-destructive", good: "text-success", calm: "" } as const;
const TONE_ICON = { late: "text-destructive", good: "text-success", calm: "text-muted-foreground" } as const;

/**
 * An amount or a count that opens the list already narrowed to it. Every tile in a row is the same height (the tile
 * fills its grid cell), whatever its label needs, so a label that wraps never makes one tile taller than the next.
 */
function Tile({
  href,
  icon: Icon,
  label,
  hint,
  text,
  tone,
  big,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
  text: string;
  tone: keyof typeof TONE_TEXT;
  /** A count (3xl) rather than an amount (2xl). */
  big?: boolean;
  testId: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-full min-h-11 flex-col gap-1 rounded-xl px-4 py-3 ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex items-center gap-2 text-base text-muted-foreground">
        <Icon aria-hidden="true" className={`size-5 shrink-0 ${TONE_ICON[tone]}`} />
        {label}
      </span>
      <span className={`mt-auto block ${big ? "text-3xl" : "text-2xl"} font-bold ${TONE_TEXT[tone]}`} data-testid={testId}>
        {text}
      </span>
      {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
    </Link>
  );
}
