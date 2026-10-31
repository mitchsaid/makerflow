"use client";

import { useState } from "react";
import { useAppRouter } from "@/components/use-app-router";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { Button } from "@/components/ui/button";
import { deleteJob } from "./actions";

/**
 * The question before a job is deleted (docs/plans/ux-pass-3.md): the job, its items and its progress go for good; the
 * quote and any invoice stay. The Jobs list says it is gone. Controlled, so the job page and a job's card can both open it.
 */
export function DeleteJobSheet({ jobId, jobLabel, open, onOpenChange, finalFocus }: { jobId: string; jobLabel: string; open: boolean; onOpenChange: (open: boolean) => void; finalFocus?: () => HTMLElement | null | true }) {
  const router = useAppRouter();
  return (
    <ConfirmSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Delete this job?"
      description={jobLabel}
      body="The job and its progress are removed for good. The quote and any invoice stay as they are."
      confirmLabel="Delete the job"
      pendingLabel="Deleting…"
      keepLabel="Keep the job"
      finalFocus={finalFocus}
      onConfirm={async () => {
        const result = await deleteJob(jobId);
        if (result.status === "deleted") router.push(`/app/jobs?deleted=${result.number}`);
        else return result.message;
      }}
    />
  );
}

/** "Delete this job", last on the job's page: a quiet link, then the question. */
export function DeleteJob({ jobId, jobLabel }: { jobId: string; jobLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button id="delete-job" type="button" variant="link" className="h-auto min-h-11 justify-start px-0 text-destructive underline text-sm" onClick={() => setOpen(true)}>
        Delete this job
      </Button>
      <DeleteJobSheet jobId={jobId} jobLabel={jobLabel} open={open} onOpenChange={setOpen} finalFocus={() => document.getElementById("delete-job") ?? true} />
    </>
  );
}
