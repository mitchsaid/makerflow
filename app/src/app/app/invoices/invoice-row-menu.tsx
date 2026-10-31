"use client";

import { useState } from "react";
import { CopyIcon } from "lucide-react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { RowMenu } from "@/components/row-menu";
import { duplicateInvoice, duplicateInvoiceDraft } from "./draft-actions";

/**
 * The ⋯ on an invoice's card, and on a draft's (docs/plans/duplicate.md): Duplicate, a new invoice DRAFT with the same
 * customer and items, today's date and the usual due day. It is never a numbered invoice: nothing is sent or numbered until
 * the new draft is, and the original is left as it is.
 */
export function InvoiceRowMenu({
  target,
  who,
  what,
}: {
  target: { kind: "invoice" | "draft"; id: string };
  /** The customer, or "No customer yet". */
  who: string;
  /** "invoice INV-0004" or "draft". */
  what: string;
}) {
  const [asking, setAsking] = useState(false);
  const title = target.kind === "invoice" ? `${who} · ${what.replace(/^invoice /, "")}` : `${who} · draft`;
  return (
    <>
      <RowMenu
        label={`More for ${who}, ${what}`}
        title={title}
        actions={[{ label: "Duplicate", hint: "A new draft with the same customer and items", icon: <CopyIcon className="size-5" />, onSelect: () => setAsking(true) }]}
      />
      <ConfirmSheet
        open={asking}
        onOpenChange={setAsking}
        title={target.kind === "invoice" ? "Duplicate this invoice?" : "Duplicate this draft?"}
        description={title}
        body="Starts a new invoice draft with the same customer and items, today's date and the usual due day. Nothing is sent or numbered until you send it."
        confirmLabel="Duplicate"
        pendingLabel="Duplicating…"
        keepLabel="Not now"
        tone="default"
        onConfirm={async () => {
          const result = target.kind === "invoice" ? await duplicateInvoice(target.id) : await duplicateInvoiceDraft(target.id);
          if (result?.status === "error") return result.message;
        }}
      />
    </>
  );
}
