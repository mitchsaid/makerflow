"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Under something a new quote starts with (docs/plans/quote-form-feedback.md): "Save as my usual" makes what is on this
 * quote what every new quote starts with, in one tap; "Use my usual" puts the saved one back. The parent decides when each
 * is on offer (`canSave`, `canUse`) and what saving does (`save`, which says what was stored). Nothing here changes a quote
 * that already exists.
 *
 * Both buttons go away once they have done their work (the quote then matches the usual), so focus moves to the line that
 * says what happened, which is also what a screen reader announces.
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
  /** Changes whenever what is on the quote changes, so the note goes away once it is edited again. */
  valueKey: string;
  canSave: boolean;
  canUse: boolean;
  save: () => Promise<{ status: "saved"; value?: string } | { status: "error"; message?: string }>;
  onSaved: (value: string | undefined) => void;
  onUse: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; key: string } | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  // After "Use my usual" the quote changes on the next render: the note is then tied to the new value.
  const usedUsual = useRef(false);
  const focusNote = useRef(false);

  useEffect(() => {
    if (usedUsual.current) {
      usedUsual.current = false;
      setNote({ text: `Back to your usual ${what}.`, key: valueKey });
      focusNote.current = true;
    }
  }, [valueKey, what]);

  useEffect(() => {
    if (focusNote.current && note) {
      focusNote.current = false;
      status.current?.focus();
    }
  }, [note]);

  const showNote = note !== null && note.key === valueKey;
  if (!canSave && !canUse && !showNote && !message) return null;

  function doSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await save();
        if (result.status === "saved") {
          setNote({ text: `Saved as your usual ${what}.`, key: valueKey });
          focusNote.current = true;
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
          <Button type="button" variant="soft" disabled={pending} onClick={doSave}>
            {pending ? "Saving…" : "Save as my usual"}
            <span className="sr-only"> {what}</span>
          </Button>
        )}
        {canUse && (
          <Button
            type="button"
            variant="soft"
            disabled={pending}
            onClick={() => {
              usedUsual.current = true;
              onUse();
            }}
          >
            Use my usual<span className="sr-only"> {what}</span>
          </Button>
        )}
        <p ref={status} role="status" tabIndex={-1} className="text-sm text-muted-foreground outline-none">
          {showNote ? note.text : ""}
        </p>
      </div>
    </div>
  );
}
