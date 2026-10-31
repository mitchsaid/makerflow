"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, ExternalLinkIcon, HammerIcon, Trash2Icon } from "lucide-react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { RowMenu } from "@/components/row-menu";
import type { SheetAction } from "@/components/action-sheet";
import { jobNumberText } from "@/lib/jobs";
import { quoteRowActions } from "@/lib/quotes/row-actions";
import { createJob } from "../jobs/actions";
import { deleteQuoteDraft, duplicateQuote } from "./actions";
import { TurnIntoJobSheet } from "./quote-outcome";

/**
 * The ⋯ on a quote's card (docs/plans/ux-pass-3.md): delete a draft, turn a sent quote into a job (the yes is recorded the
 * usual way, then the job is made and opened), make a job from an accepted quote, or open its job: none of it needs the
 * quote opened or previewed first.
 */
export function QuoteRowMenu({
  quote,
  today,
}: {
  quote: { id: string; number: string; status: string; customerName: string | null; liveJob?: { id: string; number: number } | null };
  today: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"delete" | "turn" | "create" | "duplicate" | null>(null);
  const kinds = quoteRowActions(quote);
  const who = quote.customerName ?? "No customer yet";

  const actions: SheetAction[] = kinds.map((kind) => {
    switch (kind) {
      case "delete-draft":
        return { label: "Delete draft", hint: "Removes it for good", icon: <Trash2Icon className="size-5" />, danger: true, onSelect: () => setSheet("delete") };
      case "turn-into-job":
        return { label: "Turn into a job", hint: "They said yes: record it and start the job", icon: <HammerIcon className="size-5" />, onSelect: () => setSheet("turn") };
      case "create-job":
        return { label: "Create a job", hint: "Make a job to make, from this accepted quote", icon: <HammerIcon className="size-5" />, onSelect: () => setSheet("create") };
      case "duplicate":
        return { label: "Duplicate", hint: "A new draft with the same customer and items", icon: <CopyIcon className="size-5" />, onSelect: () => setSheet("duplicate") };
      case "open-job":
        return { label: `Open job ${jobNumberText(quote.liveJob!.number)}`, hint: "Already being made", icon: <ExternalLinkIcon className="size-5" />, href: `/app/jobs/${quote.liveJob!.id}` };
    }
  });

  return (
    <>
      <RowMenu label={`More for ${who}, quote ${quote.number}`} title={`${who} · ${quote.number}`} actions={actions} />
      <ConfirmSheet
        open={sheet === "delete"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Delete this draft?"
        description={`${who} · ${quote.number}`}
        body="The draft is removed for good. This can't be undone."
        confirmLabel="Yes, delete the draft"
        pendingLabel="Deleting…"
        onConfirm={async () => {
          const result = await deleteQuoteDraft(quote.id);
          if (result?.status === "error") return result.message;
          router.refresh();
        }}
      />
      <ConfirmSheet
        open={sheet === "create"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Create a job?"
        description={`${who} · ${quote.number}`}
        body="Makes a job from this accepted quote, with its items, customer and day, and opens it."
        confirmLabel="Create the job"
        pendingLabel="Creating the job…"
        keepLabel="Not now"
        tone="default"
        onConfirm={async () => {
          const result = await createJob(quote.id);
          if (result?.status === "error") return result.message;
        }}
      />
      <ConfirmSheet
        open={sheet === "duplicate"}
        onOpenChange={(open) => !open && setSheet(null)}
        title="Duplicate this quote?"
        description={`${who} · ${quote.number}`}
        body="Starts a new draft with the same customer, items and wording, a new number and today's dates. This quote is left as it is."
        confirmLabel="Duplicate"
        pendingLabel="Duplicating…"
        keepLabel="Not now"
        tone="default"
        onConfirm={async () => {
          const result = await duplicateQuote(quote.id);
          if (result?.status === "error") return result.message;
        }}
      />
      <TurnIntoJobSheet quoteId={quote.id} number={quote.number} today={today} open={sheet === "turn"} onOpenChange={(open) => !open && setSheet(null)} />
    </>
  );
}
