"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import { RowMenu } from "@/components/row-menu";
import { DeleteJobSheet } from "./delete-job";

/** The ⋯ on a job's card: delete it (owners and admins; the card has nothing else to offer). */
export function JobRowMenu({ jobId, number, customerName, canDelete }: { jobId: string; number: string; customerName: string; canDelete: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const label = `Job ${number} · ${customerName}`;
  return (
    <>
      <RowMenu
        label={`More for ${customerName}, job ${number}`}
        title={label}
        actions={canDelete ? [{ label: "Delete this job", hint: "Removes it and its progress for good", icon: <Trash2Icon className="size-5" />, danger: true, onSelect: () => setDeleting(true) }] : []}
      />
      <DeleteJobSheet jobId={jobId} jobLabel={label} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
