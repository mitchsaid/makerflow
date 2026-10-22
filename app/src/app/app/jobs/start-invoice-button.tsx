"use client";

import { useState, useTransition } from "react";
import { AddButton } from "@/components/add-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { startInvoiceFromJob } from "../invoices/draft-actions";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** On a finished job made by hand: starts an invoice with its customer and items, ready for prices. Opens the draft. */
export function StartInvoiceButton({ jobId }: { jobId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await startInvoiceFromJob(jobId);
        setMessage(result.message);
      } catch (error) {
        // Starting it ends by opening the draft: that is a redirect, not a failure.
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
      <AddButton size="lg" variant="default" disabled={pending} onClick={start}>
        {pending ? "Starting the invoice…" : "Start an invoice"}
      </AddButton>
      <p className="text-sm text-muted-foreground">With this job&apos;s customer and items, ready for their prices.</p>
    </div>
  );
}
