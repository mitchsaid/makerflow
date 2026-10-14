"use client";

import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createJob } from "../jobs/actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** On an accepted quote: turns it into a job to make. Ends by opening the new job. */
export function CreateJobButton({ quoteId, compact = false }: { quoteId: string; compact?: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createJob(quoteId);
        if (result.status === "error") setMessage(result.message);
      } catch (error) {
        // Making the job ends by opening it: that is a redirect, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage(OFFLINE);
      }
    });
  }

  return (
    <div className="space-y-2">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <AddButton id={compact ? "nudge-create-job" : undefined} size="lg" variant="default" disabled={pending} onClick={create}>
        {pending ? "Creating the job…" : "Create a job"}
      </AddButton>
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Turns this accepted quote into a job to make, with the items, the customer and the day it is needed carried
          over. You can then follow it from making to collected or delivered.
        </p>
      )}
    </div>
  );
}
