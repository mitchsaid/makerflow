"use client";

import { useRef, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import { ActionSheet, type SheetAction } from "@/components/action-sheet";
import { Button } from "@/components/ui/button";

/**
 * The ⋯ on a card (docs/plans/ux-pass-3.md): an outlined icon button, a full 44 px tap target, that opens a sheet of what
 * can be done to that card (turn a quote into a job, delete). It is only there when the card has something to offer.
 * `label` names the card for a screen reader ("More for Thandi, quote QT-0001").
 */
export function RowMenu({ label, title, description, actions }: { label: string; title: string; description?: string; actions: SheetAction[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (actions.length === 0) return null;
  return (
    <>
      <Button ref={button} type="button" variant="outline" size="icon" aria-label={label} onClick={() => setOpen(true)}>
        <MoreHorizontalIcon aria-hidden="true" />
      </Button>
      <ActionSheet open={open} onOpenChange={setOpen} title={title} description={description} actions={actions} finalFocus={() => button.current ?? true} />
    </>
  );
}
