import Link from "next/link";
import { AddLink } from "@/components/add-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { getActiveJobDates } from "@/lib/jobs/data";
import { jobDueCounts } from "@/lib/jobs";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";

export default async function WorkspacePage() {
  // The jobs query runs beside the workspace check, not after it.
  const [activeJobs, { organisation, profile }] = await Promise.all([getActiveJobDates(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const counts = jobDueCounts(forOrganisation(activeJobs, organisation.id), todayIn(locale.timeZone));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold" data-testid="business-name">
        {organisation.name}
      </h1>

      <Card data-testid="home-jobs">
        <CardHeader>
          <CardTitle className="text-lg">Your jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {counts.active === 0 ? (
            <>
              <p className="text-base text-muted-foreground">
                Nothing to make right now. When a customer accepts a quote, turn it into a job to follow it from making to
                collected or delivered.
              </p>
              <AddLink href="/app/jobs/new" variant="default">
                New job
              </AddLink>
            </>
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3">
                <li>
                  <DueLink href="/app/jobs?show=late" label="Late" count={counts.late} tone={counts.late > 0 ? "late" : "calm"} />
                </li>
                <li>
                  <DueLink href="/app/jobs?show=week" label="Needed this week" count={counts.thisWeek} tone="calm" />
                </li>
              </ul>
              {counts.late === 0 && counts.thisWeek === 0 && (
                <p className="text-base text-muted-foreground">Nothing is due in the next week.</p>
              )}
              <Link href="/app/jobs" className="inline-flex min-h-11 items-center font-medium underline">
                {counts.active === 1 ? "See the job to do" : `See all ${counts.active} jobs to do`}
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </main>
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
