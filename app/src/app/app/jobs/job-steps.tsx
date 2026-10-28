"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { SelectField } from "@/components/form-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { jobStatusChoices, jobStatusLabel, nextJobStep, otherJobSteps, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { moveJob } from "./actions";
import { useMoveJob } from "./use-move-job";

/**
 * Where a job stands (docs/plans/ux-pass-3.md, "Job status, again"): the status as a dropdown, to set it to any other
 * (things happen outside the app: a job can go from started straight to ready for delivery, so no order is forced). The
 * one clear next step is offered when it is clear, not all the time: when the last item is counted a question opens
 * ("Everything is made. Mark it ready?"), and a job that is already all made says so with the button. A job cancelled
 * before cancelling went has one button, Restore. Deleting is at the foot of the page, not here.
 */
export function JobSteps({ jobId, status, fulfilment, allMade }: { jobId: string; status: JobStatus; fulfilment: JobFulfilment; allMade: boolean }) {
  const { move, pending, message, router } = useMoveJob(jobId);
  const choices = jobStatusChoices(fulfilment);
  const restore = otherJobSteps(status, fulfilment);
  const ready = nextJobStep("in_progress", fulfilment);

  // The last item was counted while this page was open: ask, once (a page opened on a job that is already all made shows the prompt below instead).
  const [asking, setAsking] = useState(false);
  const wasAllMade = useRef(allMade);
  useEffect(() => {
    if (allMade && !wasAllMade.current && status === "in_progress") setAsking(true);
    wasAllMade.current = allMade;
  }, [allMade, status]);

  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {status !== "cancelled" && (
        <div className="max-w-xs">
          <SelectField
            id="job-status"
            label="Status"
            value={status}
            options={choices}
            optionLabels={Object.fromEntries(choices.map((s) => [s, jobStatusLabel(s, fulfilment)]))}
            onChange={(value) => {
              if (!pending && value !== status) move(value as JobStatus);
            }}
          />
        </div>
      )}
      {status === "in_progress" && allMade && ready && (
        <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-testid="all-made-prompt">
          <p className="text-base font-medium" role="status">
            Everything is made.
          </p>
          <Button type="button" disabled={pending} onClick={() => move(ready.to)}>
            {ready.label}
          </Button>
        </div>
      )}
      {restore.map((step) => (
        <Button key={step.to} type="button" variant="outline" disabled={pending} onClick={() => move(step.to)}>
          {step.label}
        </Button>
      ))}
      {ready && (
        <ConfirmSheet
          open={asking}
          onOpenChange={setAsking}
          tone="default"
          title="Everything is made"
          body={`${ready.label}?`}
          confirmLabel={ready.label}
          pendingLabel="Saving…"
          keepLabel="Not yet"
          onConfirm={async () => {
            try {
              const result = await moveJob(jobId, ready.to);
              if (result.status !== "done") return result.message;
              setAsking(false);
              router.refresh();
            } catch {
              return "Couldn't reach the server. Check your connection and try again.";
            }
          }}
        />
      )}
    </div>
  );
}
