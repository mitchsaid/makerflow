import { AddLink } from "@/components/add-button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getJobs } from "@/lib/jobs/data";
import { jobNumberText, parseJobFilter } from "@/lib/jobs";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { CancelledNotice } from "./cancelled-notice";
import { JobList } from "./job-list";

export default async function JobsPage({ searchParams }: PageProps<"/app/jobs">) {
  // The jobs query runs beside the workspace check, not after it.
  const [allJobs, { organisation, profile }, query] = await Promise.all([getJobs(), requireOrganisation(), searchParams]);
  const locale = getLocalePack(profile.countryCode);
  const jobs = forOrganisation(allJobs, organisation.id);
  // Just cancelled: say so, with an Undo (the list is already loaded, so this costs nothing).
  const cancelled = typeof query.cancelled === "string" ? jobs.find((j) => j.id === query.cancelled && j.status === "cancelled") : undefined;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Jobs</h1>
        {jobs.length > 0 && (
          <AddLink href="/app/jobs/new" variant="default">
            New job
          </AddLink>
        )}
      </div>
      {cancelled && <CancelledNotice key={cancelled.id} jobId={cancelled.id} jobLabel={`Job ${jobNumberText(cancelled.number)}`} />}
      <JobList key={parseJobFilter(query.show) ?? "active"} jobs={jobs} today={todayIn(locale.timeZone)} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} initialFilter={parseJobFilter(query.show) ?? "active"} />
    </main>
  );
}
