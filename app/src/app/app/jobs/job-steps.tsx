"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { otherJobSteps, nextJobStep, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { CancelJob } from "./cancel-job";
import { useMoveJob } from "./use-move-job";

/** The next step as one big button, and the other moves (back, cancel, restore) as smaller ones. Each is one tap, except cancelling, which asks. */
export function JobSteps({ jobId, jobLabel, status, fulfilment, allMade }: { jobId: string; jobLabel: string; status: JobStatus; fulfilment: JobFulfilment; allMade: boolean }) {
  const { move, pending, message } = useMoveJob(jobId);
  const next = nextJobStep(status, fulfilment);
  const others = otherJobSteps(status, fulfilment);

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
      {others.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {others.map((step) =>
            // Cancelling asks first.
            step.to === "cancelled" ? (
              <CancelJob key="cancel" jobId={jobId} jobLabel={jobLabel} />
            ) : (
              <Button key={step.to + step.label} type="button" variant="outline" disabled={pending} onClick={() => move(step.to)}>
                {step.label}
              </Button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
