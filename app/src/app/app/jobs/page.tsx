import { AddLink } from "@/components/add-button";
import { requireOrganisation } from "@/lib/auth/dal";
import { getJobs } from "@/lib/jobs/data";
import { getLocalePack } from "@/lib/locale";
import { todayIn } from "@/lib/quotes/dates";
import { forOrganisation } from "@/lib/scope";
import { JobList } from "./job-list";

export default async function JobsPage() {
  // The jobs query runs beside the workspace check, not after it.
  const [allJobs, { organisation, profile }] = await Promise.all([getJobs(), requireOrganisation()]);
  const locale = getLocalePack(profile.countryCode);
  const jobs = forOrganisation(allJobs, organisation.id);

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
      <JobList jobs={jobs} today={todayIn(locale.timeZone)} formatLocale={locale.formatLocale} numberStyle={locale.numberStyle} />
    </main>
  );
}
