import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { AddLink } from "@/components/add-button";
import { canDeleteJob, isOverdueJob, jobNumberText, jobProgress, jobStatusLabel, MAX_JOB_ITEMS, shouldNudgeInvoiceJob, takesCounts, takesNewItems, type JobDetail } from "@/lib/jobs";
import { getJob } from "@/lib/jobs/data";
import { getLocalePack } from "@/lib/locale";
import { PhotoThumb } from "@/components/photo-thumb";
import { quantityText } from "@/lib/quotes/units";
import { formatDay, formatMoment, todayIn } from "@/lib/quotes/dates";
import { ItemProgress } from "../item-progress";
import { ItemSteps } from "../item-steps";
import { StepsEditor } from "../steps-editor";
import { InvoiceJobCard } from "../invoice-job-card";
import { JobNote } from "../job-note";
import { StartInvoiceButton } from "../start-invoice-button";
import { JobProgressBar } from "../job-progress";
import { JobStatusChip } from "../job-status-chip";
import { JobSteps } from "../job-steps";
import { PageHeader } from "@/components/page-header";
import { Disclosure } from "@/components/disclosure";
import { DeleteJob } from "../delete-job";

export default async function JobPage({ params }: PageProps<"/app/jobs/[id]">) {
  const { id } = await params;
  // The job loads beside the workspace check, not after it.
  const [job, { organisation, profile, role, dismissedPrompts }] = await Promise.all([getJob(id), requireOrganisation()]);
  // Another business of the same person is not this workspace's job.
  if (job.organisationId !== organisation.id) notFound();

  const locale = getLocalePack(profile.countryCode);
  const today = todayIn(locale.timeZone);
  const overdue = isOverdueJob(job, today);
  const counting = takesCounts(job.status);
  const progress = jobProgress(job.fullItems);
  const nudgeInvoice = shouldNudgeInvoiceJob({ status: job.status, hasQuote: !!job.quoteId, hasInvoice: !!job.invoice, dismissedPrompts });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/jobs", label: "Jobs" }}>
        <h1 id="job-title" tabIndex={-1} className="flex flex-wrap items-center gap-3 text-xl font-semibold outline-none">
          <span>Job {jobNumberText(job.number)}</span>
          <JobStatusChip status={job.status} fulfilment={job.fulfilment} />
        </h1>
      </PageHeader>

      {job.status === "done" && (
        job.invoice ? (
          <section className="space-y-2" aria-labelledby="invoice-heading">
            <h2 id="invoice-heading" className="text-base font-semibold">
              Invoice
            </h2>
            <p className="text-base">
              Invoiced:{" "}
              <Link href={`/app/invoices/${job.invoice.id}`} className="inline-flex min-h-11 items-center font-medium underline">
                {job.invoice.number}
              </Link>
            </p>
          </section>
        ) : job.quoteId ? (
          <InvoiceJobCard quoteId={job.quoteId} quoteNumber={job.quoteNumber} offer={nudgeInvoice} />
        ) : (
          <section className="space-y-2" aria-labelledby="invoice-heading">
            <h2 id="invoice-heading" className="text-base font-semibold">
              Invoice
            </h2>
            <StartInvoiceButton jobId={job.id} />
          </section>
        )
      )}

      <section className="space-y-3" aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-base font-semibold">
          {job.status === "cancelled" ? "Cancelled" : "Where it stands"}
        </h2>
        {job.status === "cancelled" && (
          <p className="text-muted-foreground">This job was cancelled, so nothing is counted on it. Restore it to carry on.</p>
        )}
        <JobSteps jobId={job.id} jobLabel={`Job ${jobNumberText(job.number)} · ${job.customerName}`} status={job.status} fulfilment={job.fulfilment} allMade={progress.allMade} />
      </section>

      <section className="space-y-2" aria-labelledby="make-heading">
        <h2 id="make-heading" className="text-base font-semibold">
          To make
        </h2>
        {counting && <JobProgressBar progress={progress} />}
        <Card>
          <CardContent>
            <ul className="space-y-4" data-testid="job-items">
              {job.fullItems.map((item) => (
                <li key={item.id} className="space-y-3">
                  <div className="flex gap-3">
                  <PhotoThumb imageId={item.photoImageId} size="lg" className="self-start" />
                  <div className="min-w-0 space-y-0.5">
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
                  {item.addedLater && <p className="text-sm text-muted-foreground">Added later</p>}
                  </div>
                  </div>
                  {counting && item.steps.length > 0 && <ItemSteps jobId={job.id} item={item} numberStyle={locale.numberStyle} />}
                  {counting && item.steps.length === 0 && (
                    <ItemProgress
                      jobId={job.id}
                      itemId={item.id}
                      name={item.name}
                      quantityMilli={item.quantityMilli}
                      madeMilli={item.madeMilli}
                      unit={item.unit}
                      numberStyle={locale.numberStyle}
                    />
                  )}
                  {/* One editor for the item, whether or not it has steps yet, so it stays open as the first one is added. */}
                  {counting && item.fromProduct && (
                    <StepsEditor
                      key={item.id}
                      jobId={job.id}
                      itemId={item.id}
                      name={item.name}
                      madeMilli={item.madeMilli}
                      steps={item.steps}
                      stepsEdited={item.stepsEdited}
                    />
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        {takesNewItems(job.status) &&
          (job.fullItems.length < MAX_JOB_ITEMS ? (
            <AddLink href={`/app/jobs/${job.id}/add-item`}>Add an item</AddLink>
          ) : (
            <p className="text-sm text-muted-foreground">A job can have up to {MAX_JOB_ITEMS} items.</p>
          ))}
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

      {/* Where it came from and what happened are there when asked for. */}
      <Disclosure title="History" testId="job-history">
      <section className="space-y-2" aria-labelledby="from-heading">
        <h2 id="from-heading" className="text-base font-semibold">
          {job.quoteId ? "From the quote" : "Where it came from"}
        </h2>
        {job.quoteId ? (
          <p className="text-sm text-muted-foreground">
            Made from{" "}
            <Link href={`/app/quotes/${job.quoteId}?version=${job.quoteVersion}`} className="inline-flex min-h-11 items-center font-medium underline">
              quote {job.quoteNumber}
              {job.quoteVersion && job.quoteVersion > 1 ? `, version ${job.quoteVersion}` : ""}
            </Link>
            . Later changes to the quote or customer don&apos;t change this job.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Added by hand. Later changes to the customer don&apos;t change this job.
          </p>
        )}
      </section>

      <Activity job={job} locale={locale.formatLocale} timeZone={locale.timeZone} />
      </Disclosure>

      {/* Last and quiet: it cannot be undone, so it is not among the everyday buttons. */}
      {canEditBusinessProfile(role) && canDeleteJob(job.status) && (
        <div className="pt-2">
          <DeleteJob jobId={job.id} jobLabel={`Job ${jobNumberText(job.number)} · ${job.customerName}`} />
        </div>
      )}
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
                <span>
                  {e.kind === "created"
                    ? "Job created"
                    : e.kind === "item_added"
                      ? `Added ${e.detail ?? "an item"}`
                      : `Moved to ${jobStatusLabel(e.toStatus, job.fulfilment).toLowerCase()}`}
                </span>
                <span className="text-sm text-muted-foreground">{formatMoment(e.createdAt, locale, timeZone)}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
