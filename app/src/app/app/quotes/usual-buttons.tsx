"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Under something a new quote starts with (docs/plans/quote-form-feedback.md): "Save as my usual" makes what is on this
 * quote what every new quote starts with, in one tap; "Use my usual" puts the saved one back. The parent decides when each
 * is on offer (`canSave`, `canUse`) and what saving does (`save`, which says what was stored). Nothing here changes a quote
 * that already exists.
 */
export function UsualButtons({
  what,
  valueKey,
  canSave,
  canUse,
  save,
  onSaved,
  onUse,
}: {
  /** What it is, for the buttons' names: "description", "sign-off", "deposit". */
  what: string;
  /** Changes whenever what is on the quote changes, so "Saved" goes away once it is edited again. */
  valueKey: string;
  canSave: boolean;
  canUse: boolean;
  save: () => Promise<{ status: "saved"; value?: string } | { status: "error"; message?: string }>;
  onSaved: (value: string | undefined) => void;
  onUse: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const saved = savedKey === valueKey;

  if (!canSave && !canUse && !saved && !message) return null;

  function doSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await save();
        if (result.status === "saved") {
          setSavedKey(valueKey);
          onSaved(result.value);
        } else {
          setMessage(result.message ?? "Something went wrong saving that. Please try again.");
        }
      } catch {
        setMessage("Couldn't reach the server, so nothing was saved. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="space-y-1">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-x-2">
        {canSave && (
          <Button type="button" variant="ghost" disabled={pending} onClick={doSave}>
            {pending ? "Saving…" : "Save as my usual"}
            <span className="sr-only"> {what}</span>
          </Button>
        )}
        {canUse && (
          <Button type="button" variant="ghost" disabled={pending} onClick={onUse}>
            Use my usual<span className="sr-only"> {what}</span>
          </Button>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Saved as your usual {what}.
          </p>
        )}
      </div>
    </div>
  );
}
