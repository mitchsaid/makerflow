"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { deleteJob } from "./actions";

/**
 * "Delete this job", after asking. Only a job that has not been started, or was cancelled, can go (the page offers it
 * only then); it takes its items and its activity log with it, and cannot be brought back. The Jobs list says it is gone.
 */
export function DeleteJob({ jobId, jobLabel }: { jobId: string; jobLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await deleteJob(jobId);
        if (result.status === "deleted") router.push(`/app/jobs?deleted=${result.number}`);
        else setMessage(result.message);
      } catch {
        setMessage("Couldn't reach the server, so nothing was deleted. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button id="delete-job" type="button" variant="link" className="h-auto min-h-11 justify-start px-0 text-destructive underline text-sm" onClick={() => setOpen(true)}>
        Delete this job
      </Button>
      <Sheet open={open} onOpenChange={(isOpen) => !pending && setOpen(isOpen)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("delete-job") ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Delete this job?</SheetTitle>
            <SheetDescription className="text-base">{jobLabel}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <p className="text-base">The job and its progress are removed for good. The quote and any invoice stay as they are.</p>
            {message && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Button type="button" variant="destructive" size="lg" className="w-full" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete the job"}
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => setOpen(false)}>
              Keep the job
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
