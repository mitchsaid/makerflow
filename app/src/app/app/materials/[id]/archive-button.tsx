"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setMaterialArchived } from "../actions";

/** Archive or restore. Materials are never deleted, so this is always safe to undo. */
export function MaterialArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setMaterialArchived(id, !archived);
            if (result.status === "error") setMessage(result.message);
          })
        }
      >
        {archived ? "Restore material" : "Archive material"}
      </Button>
      {!archived && (
        <p className="text-sm text-muted-foreground">
          Hidden from your list, but kept where they are used. You can restore them.
        </p>
      )}
    </div>
  );
}
