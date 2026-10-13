"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { jobNumberText, nextJobStep, type JobFulfilment, type JobStatus } from "@/lib/jobs";
import { moveJob } from "./actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

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
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = nextJobStep(status, fulfilment);
  if (!next) return null;

  function move() {
    if (!next) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await moveJob(jobId, next.to);
        if (result.status === "done") router.refresh();
        else setMessage(result.message);
      } catch {
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div className="space-y-2 px-4 pb-3">
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Button type="button" variant={status === "in_progress" && allMade ? "default" : "outline"} disabled={pending} onClick={move}>
        {next.label}
        <span className="sr-only">
          {" "}
          for {jobNumberText(number)}, {customerName}
        </span>
      </Button>
    </div>
  );
}
