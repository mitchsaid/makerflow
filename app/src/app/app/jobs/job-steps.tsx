"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { otherJobSteps, nextJobStep, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { moveJob } from "./actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** The next step as one big button, and the other moves (back, cancel, restore) as smaller ones. Each is one tap. */
export function JobSteps({ jobId, status, fulfilment, allMade }: { jobId: string; status: JobStatus; fulfilment: JobFulfilment; allMade: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = nextJobStep(status, fulfilment);
  const others = otherJobSteps(status, fulfilment);

  function move(to: JobStatus) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await moveJob(jobId, to);
        if (result.status === "done") router.refresh();
        else setMessage(result.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

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
          {others.map((step) => (
            <Button key={step.to + step.label} type="button" variant="outline" disabled={pending} onClick={() => move(step.to)}>
              {step.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
