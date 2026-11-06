"use client";

import Link from "@/components/app-link";
import { useState } from "react";
import { PauseIcon, PencilIcon, PlayIcon, SlidersHorizontalIcon, SquareXIcon } from "lucide-react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { RowMenu } from "@/components/row-menu";
import { useAppRouter } from "@/components/use-app-router";
import { formatMoney, type NumberStyle } from "@/lib/money";
import type { RepeatRow as Row } from "@/lib/recurrence/rows";
import { changeRepeatSchedule, pauseRepeat, resumeRepeat, stopRepeat } from "./repeat-actions";
import { RepeatSheet } from "./repeat-sheet";

const CHIP = {
  running: { text: "Repeating", className: "bg-success/15 text-success" },
  paused: { text: "Paused", className: "bg-warning/15 text-warning-foreground" },
  finished: { text: "Finished", className: "bg-muted text-muted-foreground" },
} as const;

/**
 * One repeat in the Invoices list's "Repeating" view (docs/plans/recurring.md): who, what it makes, how often, when it is
 * next, what it has made. Tapping it opens what it repeats; the ⋯ pauses or resumes it, changes its schedule, or stops it.
 */
export function RepeatRow({ repeat: r, today, formatLocale, currencyCode, numberStyle }: { repeat: Row; today: string; formatLocale: string; currencyCode: string; numberStyle: NumberStyle }) {
  const router = useAppRouter();
  const [asking, setAsking] = useState<"pause" | "resume" | "stop" | null>(null);
  const [changing, setChanging] = useState(false);
  const chip = CHIP[r.status];

  const actions = [
    r.status === "running"
      ? { label: "Pause", hint: "Make nothing until you resume it", icon: <PauseIcon className="size-5" />, onSelect: () => setAsking("pause") }
      : r.status === "paused"
        ? { label: "Resume", hint: "Carry on making drafts", icon: <PlayIcon className="size-5" />, onSelect: () => setAsking("resume") }
        : null,
    { label: "Change schedule", hint: "How often, from when and until when", icon: <SlidersHorizontalIcon className="size-5" />, onSelect: () => setChanging(true) },
    { label: "Edit what it repeats", hint: "The items, customer and note", icon: <PencilIcon className="size-5" />, href: `/app/invoices/repeats/${r.id}` },
    { label: "Stop repeating", hint: "Keeps everything it already made", icon: <SquareXIcon className="size-5" />, danger: true, onSelect: () => setAsking("stop") },
  ].filter((a) => a !== null);

  /** Runs the change, then refreshes the list: a problem is said in the sheet and leaves it open. */
  async function run(action: () => Promise<{ status: "ok" } | { status: "error"; message: string }>): Promise<string | void> {
    const result = await action();
    if (result.status === "error") return result.message;
    setAsking(null);
    router.refresh();
  }

  return (
    <li className="relative" data-testid="repeat-row">
      <Link
        href={`/app/invoices/repeats/${r.id}`}
        className="block rounded-xl bg-card py-3 pl-4 pr-16 ring-1 ring-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{r.customerName ?? "No customer"}</span>
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {r.itemCount === 0 ? "No items" : `${r.itemCount} ${r.itemCount === 1 ? "item" : "items"}`}
          {r.grossCents !== null ? ` · ${formatMoney(r.grossCents, currencyCode, numberStyle)} each time` : ""}
        </span>
        <span className="mt-0.5 block text-sm" data-testid="repeat-how">
          {r.how ?? "Schedule can't be read"}
          {r.until ? ` · ${r.until}` : ""}
        </span>
        {r.next && (
          <span className="block text-sm text-muted-foreground" data-testid="repeat-next">
            Next on {r.next}
          </span>
        )}
        {r.pausedReason && (
          <span className="block text-sm text-foreground" data-testid="repeat-reason">
            {r.pausedReason}
          </span>
        )}
        {r.made && <span className="block text-sm text-muted-foreground">{r.made}</span>}
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${chip.className}`} data-testid="repeat-status">
            {chip.text}
          </span>
        </span>
      </Link>
      <div className="absolute right-2 top-2">
        <RowMenu label={`More for the repeat for ${r.label}`} title={`${r.label} · repeat`} description={r.how ?? undefined} actions={actions} />
      </div>

      <ConfirmSheet
        open={asking === "pause"}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Pause this repeat?"
        description={`${r.label} · ${r.how ?? ""}`}
        body="No more drafts are made until you resume it. Nothing already made is touched."
        confirmLabel="Pause"
        pendingLabel="Pausing…"
        keepLabel="Not now"
        tone="default"
        onConfirm={() => run(() => pauseRepeat(r.id))}
      />
      <ConfirmSheet
        open={asking === "resume"}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Resume this repeat?"
        description={`${r.label} · ${r.how ?? ""}`}
        body="It carries on making a draft each time one is due. If one was due while it was paused, one is made at the next run, not one for each date missed."
        confirmLabel="Resume"
        pendingLabel="Resuming…"
        keepLabel="Not now"
        tone="default"
        onConfirm={() => run(() => resumeRepeat(r.id))}
      />
      <ConfirmSheet
        open={asking === "stop"}
        onOpenChange={(open) => !open && setAsking(null)}
        title="Stop repeating?"
        description={`${r.label} · ${r.how ?? ""}`}
        body="No more drafts are made. The drafts and invoices it already made are left exactly as they are."
        confirmLabel="Stop repeating"
        pendingLabel="Stopping…"
        keepLabel="Keep it"
        onConfirm={() => run(() => stopRepeat(r.id))}
      />
      <RepeatSheet
        open={changing}
        onOpenChange={setChanging}
        title="Change schedule"
        description={`${r.label} · what it already made stays as it is`}
        initial={r.scheduleForm}
        today={today}
        formatLocale={formatLocale}
        keepStartsOn={r.startsOn ?? undefined}
        submitLabel="Save schedule"
        pendingLabel="Saving…"
        onSubmit={(values) => changeRepeatSchedule(r.id, values)}
        onDone={() => {
          setChanging(false);
          router.refresh();
        }}
      />
    </li>
  );
}
