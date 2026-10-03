"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setProductArchived } from "../actions";

/** Archive or restore. Products are never deleted, so this is always safe to undo. */
export function ProductArchiveButton({ id, archived }: { id: string; archived: boolean }) {
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
            const result = await setProductArchived(id, !archived);
            if (result.status === "error") setMessage(result.message);
          })
        }
      >
        {archived ? "Restore product" : "Archive product"}
      </Button>
      {!archived && (
        <p className="text-sm text-muted-foreground">
          Archived products disappear from your list but stay on any quotes that use them. You can
          restore them at any time.
        </p>
      )}
    </div>
  );
}
