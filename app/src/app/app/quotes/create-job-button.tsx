"use client";

import { useEffect, useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createJob } from "../jobs/actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** On an accepted quote: turns it into a job to make. Ends by opening the new job. */
export function CreateJobButton({
  quoteId,
  compact = false,
  onPendingChange,
}: {
  quoteId: string;
  compact?: boolean;
  /** Tells a card around the button when the job is being made, so it can hold its other buttons. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

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
      <AddButton size="lg" variant="default" disabled={pending} onClick={create}>
        {pending ? "Creating the job…" : "Create a job"}
      </AddButton>
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Turn this accepted quote into a job, with its items, customer and due day.
        </p>
      )}
    </div>
  );
}
