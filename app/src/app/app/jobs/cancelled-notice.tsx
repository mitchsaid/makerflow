"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMoveJob } from "./use-move-job";

/** On the Jobs list right after a job is cancelled: what happened, and a way back. */
export function CancelledNotice({ jobId, jobLabel }: { jobId: string; jobLabel: string }) {
  const { move, pending, message, router } = useMoveJob(jobId);
  return (
    <Alert role="status" data-testid="job-cancelled-notice">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message ?? `${jobLabel} cancelled.`}</span>
        <Button type="button" variant="outline" disabled={pending} onClick={() => move("not_started", () => router.replace("/app/jobs"))}>
          Undo
        </Button>
      </AlertDescription>
    </Alert>
  );
}
