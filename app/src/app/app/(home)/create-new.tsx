"use client";

import { useRef, useState } from "react";
import { FileTextIcon, HammerIcon, ReceiptTextIcon } from "lucide-react";
import { AddButton } from "@/components/add-button";
import { ActionSheet } from "@/components/action-sheet";

/**
 * "Create new" on Home (docs/plans/ux-pass-3.md; the prototype's Home had it): one button that asks what to make, then
 * goes straight to that new form.
 */
export function CreateNew() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <AddButton ref={button} variant="default" onClick={() => setOpen(true)}>
        Create new
      </AddButton>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title="Create new"
        finalFocus={() => button.current ?? true}
        actions={[
          { label: "Quote", hint: "Price some work for a customer", href: "/app/quotes/new", icon: <FileTextIcon className="size-5" /> },
          { label: "Invoice", hint: "Ask a customer to pay", href: "/app/invoices/new", icon: <ReceiptTextIcon className="size-5" /> },
          { label: "Job", hint: "Something to make", href: "/app/jobs/new", icon: <HammerIcon className="size-5" /> },
        ]}
      />
    </>
  );
}
