"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { dismissCreateJobPrompt } from "../jobs/actions";
import { CreateJobButton } from "./create-job-button";

/** Where focus goes when the card goes away: the page's own heading. */
const focusTitle = () => setTimeout(() => document.getElementById("quote-title")?.focus(), 0);

/**
 * Straight after "They accepted": a friendly card offering to turn the quote into a job. Never forced: "Not now" just
 * closes it (the plain "Create a job" section stays on the quote), and "Don't ask me again" is remembered for this
 * person in this business, as the logo prompt is. It lives in the page, asked for by the address (?next=job), so it
 * survives the page redrawing after the answer is saved.
 */
export function CreateJobNudge({ quoteId, quoteNumber }: { quoteId: string; quoteNumber: string }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const [making, setMaking] = useState(false);
  const [, startTransition] = useTransition();
  const region = useRef<HTMLDivElement>(null);

  // The page redraws after the answer is saved and the buttons that were focused are gone: bring focus to the card,
  // so a keyboard or screen-reader user lands on the offer.
  useEffect(() => {
    region.current?.focus();
  }, []);

  if (hidden) return null;

  function close() {
    setHidden(true);
    focusTitle();
    // Take the request out of the address, so a reload does not bring the card back.
    router.replace(`/app/quotes/${quoteId}`, { scroll: false });
  }

  return (
    <Alert ref={region} tabIndex={-1} role="region" aria-label="Create a job" data-testid="create-job-nudge" className="outline-none">
      <AlertTitle>Create a job for {quoteNumber}?</AlertTitle>
      <AlertDescription className="space-y-3">
        <span className="block">You can then follow it from making to collected or delivered.</span>
        <span className="flex flex-wrap items-start gap-2">
          <CreateJobButton quoteId={quoteId} compact onPendingChange={setMaking} />
          <Button type="button" variant="outline" size="lg" disabled={making} onClick={close}>
            Not now
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={making}
            onClick={() => {
              close();
              // Quietly remembered; if that fails the card simply comes back after the next acceptance.
              startTransition(async () => {
                await dismissCreateJobPrompt().catch(() => undefined);
              });
            }}
          >
            Don&apos;t ask me again
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
