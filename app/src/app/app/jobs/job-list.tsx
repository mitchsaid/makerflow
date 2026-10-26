"use client";

import Link from "next/link";
import { useState } from "react";
import { AddLink } from "@/components/add-button";
import { EmptyState, NoMatches } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { buttonVariants } from "@/components/ui/button";
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
  { key: "cancelled", label: "Cancelled" },
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
      <EmptyState title="No jobs yet" line="Add a job for anything you are making, or create one from an accepted quote.">
        <AddLink href="/app/jobs/new" variant="default">
          New job
        </AddLink>
        <Link href="/app/quotes" className={buttonVariants({ variant: "outline" })}>
          Go to your quotes
        </Link>
      </EmptyState>
    );
  }

  const counts: Record<JobFilter, number> = {
    active: jobs.filter((j) => isActiveJob(j.status)).length,
    late: jobs.filter((j) => isOverdueJob(j, today)).length,
    week: jobs.filter((j) => isDueThisWeekJob(j, today)).length,
    done: jobs.filter((j) => j.status === "done").length,
    cancelled: jobs.filter((j) => j.status === "cancelled").length,
    all: jobs.filter((j) => j.status !== "cancelled").length,
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

      {/* Cancelled has its own chip, but only while there is something cancelled to look at. */}
      <FilterBar
        label="Show jobs"
        options={FILTERS.filter((f) => f.key !== "cancelled" || counts.cancelled > 0 || filter === "cancelled").map((f) => ({ ...f, count: counts[f.key] }))}
        value={filter}
        onChange={setFilter}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="job-count">
        {visible.length === 1 ? "1 job" : `${visible.length} jobs`}
      </p>

      {visible.length === 0 ? (
        <NoMatches
          message={
            query.trim() !== ""
              ? `No jobs match “${query.trim()}”.`
              : filter === "active"
                ? "Nothing to make right now."
                : filter === "late"
                  ? "Nothing is late. Well done."
                  : filter === "week"
                    ? "Nothing is needed in the next week."
                    : filter === "cancelled"
                      ? "No cancelled jobs."
                      : "No jobs here yet."
          }
          clearLabel="Show to-do jobs"
          onClear={
            query.trim() !== "" || filter !== "active"
              ? () => {
                  setQuery("");
                  setFilter("active");
                }
              : undefined
          }
        />
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
