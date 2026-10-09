"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setPolicyArchived } from "./actions";

/** Archive or restore a term. Archived terms are hidden from quotes but kept; quotes that used them are unchanged. */
export function PolicyArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await setPolicyArchived(id, !archived);
              if (result.status === "error") setMessage(result.message);
              else router.push("/app/documents/policies");
            } catch {
              setMessage("Couldn't reach the server. Check your connection and try again.");
            }
          })
        }
      >
        {pending ? "Saving…" : archived ? "Restore this term" : "Archive this term"}
      </Button>
      <p className="text-sm text-muted-foreground">
        {archived
          ? "Restoring puts it back on your list for new quotes."
          : "Archiving hides it from new quotes. Quotes that already use it keep their wording."}
      </p>
    </div>
  );
}
