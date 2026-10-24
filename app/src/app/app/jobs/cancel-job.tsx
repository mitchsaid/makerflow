"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMoveJob } from "./use-move-job";

/**
 * "Cancel this job", after asking. Cancelling is one tap away from a big mistake (the job stops counting and leaves
 * the to-do list), so it asks once, then goes back to the Jobs list with a note and an Undo.
 */
export function CancelJob({ jobId, jobLabel }: { jobId: string; jobLabel: string }) {
  const [open, setOpen] = useState(false);
  const { move, pending, message, router } = useMoveJob(jobId);

  return (
    <>
      <Button id="cancel-job" type="button" variant="outline" onClick={() => setOpen(true)}>
        Cancel this job
      </Button>
      <Sheet open={open} onOpenChange={(isOpen) => !pending && setOpen(isOpen)}>
        <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={() => document.getElementById("cancel-job") ?? true}>
          <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
            <SheetTitle className="text-lg">Cancel this job?</SheetTitle>
            <SheetDescription className="text-base">{jobLabel}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 py-4">
            <p className="text-base">It leaves your to-do list and nothing more is counted on it. You can restore it later.</p>
            {message && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Button type="button" variant="danger" size="lg" className="w-full" disabled={pending} onClick={() => move("cancelled", () => router.push(`/app/jobs?cancelled=${jobId}`))}>
              {pending ? "Cancelling…" : "Cancel the job"}
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
