"use client";

import { SelectField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { jobStatusChoices, jobStatusLabel, nextJobStep, otherJobSteps, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { useMoveJob } from "./use-move-job";

/**
 * Where a job stands: the next step as one big button (and, when everything is made, the prompt to take it), and the
 * status as a dropdown to set it to any other (docs/plans/ux-pass-3.md). A job cancelled before cancelling went has one
 * button, Restore. Deleting is at the foot of the page, not here.
 */
export function JobSteps({ jobId, status, fulfilment, allMade }: { jobId: string; status: JobStatus; fulfilment: JobFulfilment; allMade: boolean }) {
  const { move, pending, message } = useMoveJob(jobId);
  const next = nextJobStep(status, fulfilment);
  const restore = otherJobSteps(status, fulfilment);
  const choices = jobStatusChoices(fulfilment);

  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {status === "in_progress" && allMade && (
        <p className="text-base font-medium" role="status" data-testid="all-made-prompt">
          Everything is made. Ready for the next step?
        </p>
      )}
      {next && (
        <Button type="button" size="lg" className="w-full sm:w-auto" disabled={pending} onClick={() => move(next.to)}>
          {next.label}
        </Button>
      )}
      {restore.map((step) => (
        <Button key={step.to} type="button" variant="outline" disabled={pending} onClick={() => move(step.to)}>
          {step.label}
        </Button>
      ))}
      {status !== "cancelled" && (
        <div className="max-w-xs">
          <SelectField
            id="job-status"
            label="Status"
            value={status}
            options={choices}
            optionLabels={Object.fromEntries(choices.map((s) => [s, jobStatusLabel(s, fulfilment)]))}
            onChange={(value) => {
              if (value !== status) move(value as JobStatus);
            }}
          />
        </div>
      )}
    </div>
  );
}
