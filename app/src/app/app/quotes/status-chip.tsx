import {
  quoteStatusKey,
  quoteStatusLabel,
  quoteStatusTone,
  type QuoteStatusInput,
} from "@/lib/quotes/status";

const TONE_CLASS = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
} as const;

/** The small label that says where a quote stands. */
export function StatusChip(props: QuoteStatusInput) {
  const key = quoteStatusKey(props);
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[quoteStatusTone(key)]}`}
      data-testid="status-chip"
    >
      {quoteStatusLabel(key)}
    </span>
  );
}
