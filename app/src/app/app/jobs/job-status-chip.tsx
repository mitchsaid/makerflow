import { jobStatusLabel, jobStatusTone, type JobFulfilment, type JobStatus, type StatusTone } from "@/lib/jobs";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  working: "bg-info/15 text-info",
  good: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
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
