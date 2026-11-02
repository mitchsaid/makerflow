import {
  quoteStatusKey,
  quoteStatusLabel,
  quoteStatusTone,
  type QuoteStatusInput,
} from "@/lib/quotes/status";

const TONE_CLASS = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  good: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
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
