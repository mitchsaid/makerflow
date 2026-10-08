"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { discardRevision } from "../issue-actions";

/**
 * Going back to the version that was sent, dropping the changes made since. Asks first, in two steps:
 * the changes can't be brought back. The sent versions are never touched.
 */
export function DiscardRevisionButton({ quoteId, sentVersion }: { quoteId: string; sentVersion: number }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const question = useRef<HTMLDivElement>(null);
  const problem = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  // Bring the question into view and read it out; give focus back to the button if it is dismissed.
  useEffect(() => {
    if (confirming) {
      question.current?.scrollIntoView({ block: "center" });
      question.current?.focus({ preventScroll: true });
    }
  }, [confirming]);

  // After a failure, take the person to what went wrong.
  useEffect(() => {
    if (message) problem.current?.focus();
  }, [message]);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button ref={opener} type="button" variant="outline" onClick={() => setConfirming(true)}>
          Discard this revision
        </Button>
        <p className="text-sm text-muted-foreground">
          Go back to version {sentVersion} as it was sent, and drop the changes you&apos;ve made since.
        </p>
      </div>
    );
  }
  return (
    <div
      ref={question}
      tabIndex={-1}
      className="space-y-3 outline-none"
      role="alertdialog"
      aria-label="Discard this revision?"
      aria-describedby="discard-revision-detail"
    >
      <p className="text-base font-medium">Discard this revision?</p>
      <p id="discard-revision-detail" className="text-base">
        Everything you&apos;ve changed since version {sentVersion} was sent is dropped, and this goes back to version{" "}
        {sentVersion}. This can&apos;t be undone.
      </p>
      {message && (
        <Alert ref={problem} tabIndex={-1} variant="destructive" className="outline-none">
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
              const result = await discardRevision(quoteId);
              if (result.status === "error") setMessage(result.message);
            })
          }
        >
          {pending ? "Discarding…" : "Yes, discard the changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setMessage(null);
            requestAnimationFrame(() => opener.current?.focus());
          }}
        >
          Keep editing
        </Button>
      </div>
    </div>
  );
}
