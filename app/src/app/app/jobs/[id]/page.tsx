import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { isOverdueJob, jobNumberText, jobStatusLabel, type JobDetail } from "@/lib/jobs";
import { getJob } from "@/lib/jobs/data";
import { getLocalePack } from "@/lib/locale";
import { quantityText } from "@/lib/quotes/units";
import { formatDay, formatMoment, todayIn } from "@/lib/quotes/dates";
import { JobNote } from "../job-note";
import { JobStatusChip } from "../job-status-chip";
import { JobSteps } from "../job-steps";

export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  // The job loads beside the workspace check, not after it.
  const [job, { organisation, profile }] = await Promise.all([getJob(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's job.
  if (job.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const overdue = isOverdueJob(job, today);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/app/jobs" className="text-sm text-muted-foreground underline">
          Jobs
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
          <span>Job {jobNumberText(job.number)}</span>
          <JobStatusChip status={job.status} fulfilment={job.fulfilment} />
        </h1>
      </div>

      <section className="space-y-3" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-base font-semibold">
          Where it stands
        </h2>
        <JobSteps jobId={job.id} status={job.status} fulfilment={job.fulfilment} />
      </section>

      <section className="space-y-2" aria-labelledby="make-heading">
        <h2 id="make-heading" className="text-base font-semibold">
          To make
        </h2>
        <Card>
          <CardContent>
            <ul className="space-y-3" data-testid="job-items">
              {job.fullItems.map((item, index) => (
                <li key={index} className="space-y-0.5">
                  <p className="text-base font-medium">
                    {quantityText(item.quantityMilli, item.unit, locale.numberStyle)} {item.name}
                  </p>
                  {(item.variationName || item.variationLabel) && (
                    <p className="text-sm text-muted-foreground">
                      {item.variationLabel ? `${item.variationLabel}: ` : ""}
                      {item.variationName}
                    </p>
                  )}
                  {item.options.map((o, i) => (
                    <p key={i} className="text-sm text-muted-foreground">
                      {optionText(o, locale.numberStyle)}
                    </p>
                  ))}
                  {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2" aria-labelledby="who-heading">
        <h2 id="who-heading" className="text-base font-semibold">
          {job.fulfilment === "delivery" ? "For delivery to" : "Customer"}
        </h2>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-base font-medium">
              {job.customerId ? (
                <Link href={`/app/customers/${job.customerId}`} className="inline-flex min-h-11 items-center underline">
                  {job.customerName}
                </Link>
              ) : (
                job.customerName
              )}
            </p>
            {job.customerContactPerson && <p className="text-sm text-muted-foreground">{job.customerContactPerson}</p>}
            {job.deliveryAddress && <p className="whitespace-pre-line text-sm">{job.deliveryAddress}</p>}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {job.customerPhone && (
                <a href={`tel:${job.customerPhone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center underline">
                  {job.customerPhone}
                </a>
              )}
              {job.customerEmail && (
                <a href={`mailto:${job.customerEmail}`} className="inline-flex min-h-11 items-center underline">
                  {job.customerEmail}
                </a>
              )}
            </p>
            <p className={`text-sm ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`} data-testid="job-needed-by">
              {job.neededBy
                ? `${overdue ? "Late: was needed " : "Needed "}${formatDay(job.neededBy, locale.formatLocale)}`
                : "No day set"}
              {job.fulfilment === "collection" && " · collection"}
              {job.fulfilment === "delivery" && " · delivery"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2" aria-labelledby="note-heading">
        <h2 id="note-heading" className="sr-only">
          Note
        </h2>
        <JobNote jobId={job.id} initial={job.note ?? ""} />
      </section>

      <section className="space-y-2" aria-labelledby="from-heading">
        <h2 id="from-heading" className="text-base font-semibold">
          From the quote
        </h2>
        <p className="text-sm text-muted-foreground">
          Made from{" "}
          <Link href={`/app/quotes/${job.quoteId}?version=${job.quoteVersion}`} className="inline-flex min-h-11 items-center font-medium underline">
            quote {job.quoteNumber}
            {job.quoteVersion > 1 ? `, version ${job.quoteVersion}` : ""}
          </Link>
          . Changes to the quote or the customer afterwards do not change this job.
        </p>
      </section>

      <Activity job={job} locale={locale.formatLocale} timeZone={locale.timeZone} />
    </main>
  );
}

function optionText(o: JobDetail["fullItems"][number]["options"][number], style: Parameters<typeof quantityText>[2]): string {
  const what = o.text ?? o.value ?? "";
  const count = o.quantityMilli && o.quantityMilli !== 1000 ? `${quantityText(o.quantityMilli, null, style)} × ` : "";
  return `${o.group ? `${o.group}: ` : ""}${count}${what}`;
}

function Activity({ job, locale, timeZone }: { job: JobDetail; locale: string; timeZone: string }) {
  return (
    <section className="space-y-2" aria-labelledby="activity-heading">
      <h2 id="activity-heading" className="text-base font-semibold">
        Activity
      </h2>
      <Card>
        <CardContent>
          <ol className="space-y-2" data-testid="job-activity">
            {job.events.map((e, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                <span>{e.kind === "created" ? "Job created" : `Moved to ${jobStatusLabel(e.toStatus, job.fulfilment).toLowerCase()}`}</span>
                <span className="text-sm text-muted-foreground">{formatMoment(e.createdAt, locale, timeZone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
