"use client";

import Link from "next/link";
import { useState } from "react";
import { AddLink } from "@/components/add-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isActiveJob, isDueThisWeekJob, isOverdueJob, jobNumberText, jobProgress, progressText, takesCounts, visibleJobs, type JobFilter, type JobSummary } from "@/lib/jobs";
import { formatQuantity, type NumberStyle } from "@/lib/money/format";
import { formatDay } from "@/lib/quotes/dates";
import { JobQuickStep } from "./job-quick-step";
import { JobStatusChip } from "./job-status-chip";

const FILTERS: { key: JobFilter; label: string }[] = [
  { key: "active", label: "To do" },
  { key: "late", label: "Late" },
  { key: "week", label: "This week" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

/**
 * The jobs list: what to make next first (by the day it is needed), search as you type, finished ones a tap away. The
 * whole list is loaded once, so filtering needs no round trip.
 */
export function JobList({
  jobs,
  today,
  formatLocale,
  numberStyle,
  initialFilter = "active",
}: {
  initialFilter?: JobFilter;
  jobs: JobSummary[];
  /** Today, as YYYY-MM-DD, in the business's time zone. */
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
}) {
  const [filter, setFilter] = useState<JobFilter>(initialFilter);
  const [query, setQuery] = useState("");

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">No jobs yet</p>
          <p className="text-muted-foreground">
            Add a job for anything you are making, then follow it from making to collected or delivered. When a customer
            accepts a quote, open it and choose &ldquo;Create a job&rdquo; and the items, the customer and the day it is
            needed carry over.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <AddLink href="/app/jobs/new" variant="default">
              New job
            </AddLink>
            <Link href="/app/quotes" className={buttonVariants({ variant: "outline" })}>
              Go to your quotes
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const counts: Record<JobFilter, number> = {
    active: jobs.filter((j) => isActiveJob(j.status)).length,
    late: jobs.filter((j) => isOverdueJob(j, today)).length,
    week: jobs.filter((j) => isDueThisWeekJob(j, today)).length,
    done: jobs.filter((j) => j.status === "done").length,
    all: jobs.length,
  };
  const visible = visibleJobs(jobs, filter, query, today);

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="job-search">Search jobs</FieldLabel>
        <Input
          id="job-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Customer, item or job number"
          autoComplete="off"
        />
      </Field>

      <div role="group" aria-label="Show jobs" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            variant={filter === f.key ? "default" : "outline"}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({counts[f.key]})
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="job-count">
        {visible.length === 1 ? "1 job" : `${visible.length} jobs`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          {query.trim() !== ""
            ? `No jobs match “${query.trim()}”.`
            : filter === "active"
              ? "Nothing to make right now."
              : filter === "late"
                ? "Nothing is late. Well done."
                : filter === "week"
                  ? "Nothing is needed in the next week."
                  : "No jobs here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((j) => {
            const overdue = isOverdueJob(j, today);
            const progress = jobProgress(j.items);
            return (
              <li key={j.id} className="rounded-xl bg-card ring-1 ring-foreground/10">
                <Link
                  href={`/app/jobs/${j.id}`}
                  className="block rounded-xl px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-base font-medium">{j.customerName}</span>
                    <span className="shrink-0 text-sm font-medium text-muted-foreground">{jobNumberText(j.number)}</span>
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
          })}
        </ul>
      )}
    </div>
  );
}

/** "Wedding cake, 12 dozen Cupcakes and 1 more": enough to tell jobs apart at a glance. */
function itemsLine(job: JobSummary, style: NumberStyle): string {
  const names = job.items.map((i) => (i.quantityMilli === 1000 ? i.name : `${formatQuantity(i.quantityMilli, style)}${i.unit ? ` ${i.unit}` : " ×"} ${i.name}`));
  if (names.length <= 2) return names.join(" and ") || "No items";
  return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
}
