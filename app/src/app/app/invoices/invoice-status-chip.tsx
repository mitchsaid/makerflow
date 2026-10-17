import { INVOICE_STATUS_LABELS, invoiceStatusTone, type InvoiceStatus, type InvoiceStatusTone } from "@/lib/invoices";

const TONE_CLASS: Record<InvoiceStatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

/** The small label that says where an invoice stands. It is worked out, never set by hand. */
export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${TONE_CLASS[invoiceStatusTone(status)]}`}
      data-testid="invoice-status-chip"
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
