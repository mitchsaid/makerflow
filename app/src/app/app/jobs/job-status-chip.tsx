import { jobStatusLabel, jobStatusTone, type JobFulfilment, type JobStatus, type StatusTone } from "@/lib/jobs";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  working: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

/** The small label that says where a job stands. */
export function JobStatusChip({ status, fulfilment }: { status: JobStatus; fulfilment: JobFulfilment }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[jobStatusTone(status)]}`}
      data-testid="job-status-chip"
    >
      {jobStatusLabel(status, fulfilment)}
    </span>
  );
}
