"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteQuoteDraft } from "../actions";

/** Deleting a draft asks first, in two steps. Only drafts can be deleted. */
export function DeleteDraftButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Delete draft
      </Button>
    );
  }
  return (
    <div className="space-y-3" role="group" aria-label="Confirm deleting this draft">
      <p className="text-base">Delete this draft? This can&apos;t be undone.</p>
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteQuoteDraft(id);
              if (result.status === "error") setMessage(result.message);
            })
          }
        >
          {pending ? "Deleting…" : "Yes, delete the draft"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
