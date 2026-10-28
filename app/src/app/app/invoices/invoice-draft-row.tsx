import Link from "next/link";
import type { InvoiceDraftRow as Row } from "@/lib/invoices/draft";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";

/** One invoice draft in the Invoices list: who it is for, what is on it so far, and that it is not issued. */
export function InvoiceDraftRow({
  draft: d,
  currencyCode,
  formatLocale,
  numberStyle,
}: {
  draft: Row;
  currencyCode: string;
  formatLocale: string;
  numberStyle: NumberStyle;
}) {
  return (
    <li className="rounded-xl bg-card ring-1 ring-foreground/10" data-testid="invoice-draft-row">
      <Link
        href={`/app/invoices/drafts/${d.id}`}
        className="block rounded-xl px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{d.customerName ?? "No customer yet"}</span>
          <span className="shrink-0 text-sm font-medium text-muted-foreground">Draft</span>
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {d.itemCount === 0 ? "No items yet" : `${d.itemCount} ${d.itemCount === 1 ? "item" : "items"}`}
          {d.grossCents !== null ? ` · ${formatMoney(d.grossCents, currencyCode, numberStyle)}` : ""}
          {d.quoteNumber ? ` · from quote ${d.quoteNumber}` : ""} · changed {formatDay(d.updatedAt.slice(0, 10), formatLocale)}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Not sent</span>
        </span>
      </Link>
    </li>
  );
}
