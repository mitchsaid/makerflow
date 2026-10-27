import Link from "next/link";
import { isOverdueJob, jobNumberText, jobProgress, progressText, takesCounts, type JobSummary } from "@/lib/jobs";
import { formatQuantity, type NumberStyle } from "@/lib/money/format";
import { formatDay } from "@/lib/quotes/dates";
import { JobQuickStep } from "./job-quick-step";
import { JobStatusChip } from "./job-status-chip";

/** "Wedding cake, 12 dozen Cupcakes and 1 more": enough to tell jobs apart at a glance. */
function itemsLine(job: JobSummary, style: NumberStyle): string {
  const names = job.items.map((i) => (i.quantityMilli === 1000 ? i.name : `${formatQuantity(i.quantityMilli, style)}${i.unit ? ` ${i.unit}` : " ×"} ${i.name}`));
  if (names.length <= 2) return names.join(" and ") || "No items";
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}

/** One job in a list: on the Jobs list, and on a customer's page (where their name is left out). */
export function JobRow({
  job: j,
  today,
  formatLocale,
  numberStyle,
  hideCustomer = false,
}: {
  job: JobSummary;
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
  hideCustomer?: boolean;
}) {
  const overdue = isOverdueJob(j, today);
  const progress = jobProgress(j.items);
  return (
    <li className="rounded-xl bg-card ring-1 ring-foreground/10 transition-colors hover:bg-muted">
      <Link
        href={`/app/jobs/${j.id}`}
        className="block rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{hideCustomer ? jobNumberText(j.number) : j.customerName}</span>
          {!hideCustomer && <span className="shrink-0 text-sm font-medium text-muted-foreground">{jobNumberText(j.number)}</span>}
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{itemsLine(j, numberStyle)}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <JobStatusChip status={j.status} fulfilment={j.fulfilment} />
          {j.neededBy ? (
            <span className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
              {overdue ? "Late: was needed " : "Needed "}
              {formatDay(j.neededBy, formatLocale)}
            </span>
          ) : (
            <span className="text-muted-foreground">No day set</span>
          )}
        </span>
        {takesCounts(j.status) && (
          <span className="mt-1 block text-sm text-muted-foreground" data-testid="job-row-progress">
            {progressText(progress)}
          </span>
        )}
      </Link>
      <JobQuickStep
        jobId={j.id}
        number={j.number}
        customerName={j.customerName}
        status={j.status}
        fulfilment={j.fulfilment}
        allMade={progress.allMade}
      />
    </li>
  );
}
