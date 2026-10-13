"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { jobNumberText, nextJobStep, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { useMoveJob } from "./use-move-job";

/**
 * The job's next step as one button on its row in the list, the same step (and the same server action) as the big
 * button on the job's page. Going back, cancelling and restoring stay on the job's page. When everything is made the
 * button is the main one on the row.
 */
export function JobQuickStep({
  jobId,
  number,
  customerName,
  status,
  fulfilment,
  allMade,
}: {
  jobId: string;
  number: number;
  customerName: string;
  status: JobStatus;
  fulfilment: JobFulfilment;
  allMade: boolean;
}) {
  const { move, pending, message } = useMoveJob(jobId);
  const next = nextJobStep(status, fulfilment);
  if (!next) return null;

  return (
    <div className="space-y-2 px-4 pb-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button type="button" variant={status === "in_progress" && allMade ? "default" : "outline"} disabled={pending} onClick={() => move(next.to)}>
        {next.label}
        <span className="sr-only">
          {" "}
          for {jobNumberText(number)}, {customerName}
        </span>
      </Button>
    </div>
  );
}
