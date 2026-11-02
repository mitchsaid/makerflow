import { INVOICE_STATUS_LABELS, invoiceStatusTone, type InvoiceStatus, type InvoiceStatusTone } from "@/lib/invoices";

const TONE_CLASS: Record<InvoiceStatusTone, string> = {
  neutral: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
  good: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
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
