"use client";

import Link from "next/link";
import { useState } from "react";
import { AddLink } from "@/components/add-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { isActiveJob, isDueThisWeekJob, isOverdueJob, visibleJobs, type JobFilter, type JobSummary } from "@/lib/jobs";
import type { NumberStyle } from "@/lib/money/format";
import { JobRow } from "./job-row";

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
            Add a job for anything you are making, or create one from an accepted quote.
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
          {visible.map((j) => (
            <JobRow key={j.id} job={j} today={today} formatLocale={formatLocale} numberStyle={numberStyle} />
          ))}
        </ul>
      )}
    </div>
  );
}
