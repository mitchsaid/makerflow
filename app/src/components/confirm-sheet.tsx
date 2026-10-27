"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * "Are you sure?" for something that cannot be undone (or an ordinary yes, with tone "default") (docs/plans/ux-pass-3.md): the one question every delete asks, in
 * the same sheet as the app's other questions. It stays open while the work runs, and a problem is said in it and
 * leaves it open. `onConfirm` returns the problem to show, or nothing when it worked.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmLabel,
  pendingLabel,
  keepLabel = "Keep it",
  tone = "danger",
  onConfirm,
  finalFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Under the title: what it is about ("Job J-0001 · Thandi"). */
  description?: string;
  /** What happens, in a line or two. */
  body: string;
  confirmLabel: string;
  pendingLabel: string;
  keepLabel?: string;
  /** "danger" (the default) for something that cannot be undone; "default" for an ordinary yes. */
  tone?: "danger" | "default";
  onConfirm: () => Promise<string | void>;
  finalFocus?: () => HTMLElement | null | true;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setMessage(null);
    startTransition(async () => {
      try {
        const problem = await onConfirm();
        if (problem) setMessage(problem);
      } catch (error) {
        // A server action that ends by sending the person elsewhere throws a redirect: that is success, not a failure.
        const digest = (error as { digest?: unknown } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw error;
        setMessage("Couldn't reach the server, so nothing was changed. Check your connection and try again.");
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setMessage(null);
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="h-dvh gap-0 overflow-y-auto" finalFocus={finalFocus}>
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-popover pr-14">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && <SheetDescription className="text-base">{description}</SheetDescription>}
        </SheetHeader>
        <div className="space-y-4 px-4 py-4">
          <p className="text-base">{body}</p>
          {message && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <Button type="button" variant={tone === "danger" ? "destructive" : "default"} size="lg" className="w-full" disabled={pending} onClick={confirm}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
          <Button type="button" variant="outline" size="lg" className="w-full" disabled={pending} onClick={() => onOpenChange(false)}>
            {keepLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
