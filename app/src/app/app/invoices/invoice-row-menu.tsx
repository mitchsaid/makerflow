"use client";

import { useState } from "react";
import { CopyIcon, RepeatIcon } from "lucide-react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { RowMenu } from "@/components/row-menu";
import { useAppRouter } from "@/components/use-app-router";
import { blankRepeatForm } from "@/lib/recurrence";
import { duplicateInvoice, duplicateInvoiceDraft } from "./draft-actions";
import { startRepeat } from "./repeat-actions";
import { RepeatSheet } from "./repeat-sheet";

/**
 * The ⋯ on an invoice's card, and on a draft's (docs/plans/duplicate.md): Duplicate, a new invoice DRAFT with the same
 * customer and items, today's date and the usual due day. It is never a numbered invoice: nothing is sent or numbered until
 * the new draft is, and the original is left as it is. Repeat (docs/plans/recurring.md) makes such a draft again on a schedule.
 */
export function InvoiceRowMenu({
  target,
  who,
  what,
  today,
  formatLocale,
}: {
  target: { kind: "invoice" | "draft"; id: string };
  /** The customer, or "No customer yet". */
  who: string;
  /** "invoice INV-0004" or "draft". */
  what: string;
  /** Today in the business's time zone, and how it writes dates (for the Repeat sheet). */
  today: string;
  formatLocale: string;
}) {
  const router = useAppRouter();
  const [asking, setAsking] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const title = target.kind === "invoice" ? `${who} · ${what.replace(/^invoice /, "")}` : `${who} · draft`;
  return (
    <>
      <RowMenu
        label={`More for ${who}, ${what}`}
        title={title}
        actions={[
          { label: "Duplicate", hint: "A new draft with the same customer and items", icon: <CopyIcon className="size-5" />, onSelect: () => setAsking(true) },
          { label: "Repeat", hint: "Make a new draft like this on a schedule", icon: <RepeatIcon className="size-5" />, onSelect: () => setRepeating(true) },
        ]}
      />
      <RepeatSheet
        open={repeating}
        onOpenChange={setRepeating}
        title="Repeat this invoice"
        description={title}
        initial={blankRepeatForm(today)}
        today={today}
        formatLocale={formatLocale}
        submitLabel="Start repeating"
        pendingLabel="Starting…"
        onSubmit={(values) => startRepeat(target, values)}
        onDone={() => {
          setRepeating(false);
          router.push("/app/invoices?show=repeating");
        }}
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
