"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setCustomerArchived, type ArchiveState } from "../actions";

/** Archive or restore. Customers are never deleted, so this is always safe to undo. */
export function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  const [state, action, pending] = useActionState<ArchiveState>(
    setCustomerArchived.bind(null, id, !archived),
    { status: "idle" },
  );
  return (
    <form action={action} className="space-y-3">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        {archived ? "Restore customer" : "Archive customer"}
      </Button>
      {!archived && (
        <p className="text-sm text-muted-foreground">
          Archived customers disappear from your list but stay on any quotes you have made. You
          can restore them at any time.
        </p>
      )}
    </form>
  );
}
