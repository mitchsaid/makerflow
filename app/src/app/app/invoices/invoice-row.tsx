import Link from "next/link";
import { invoiceStatus, type InvoiceSummary } from "@/lib/invoices";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { InvoiceStatusChip } from "./invoice-status-chip";

/** One invoice in a list: on the Invoices list, and on a customer's page (where their name is left out). */
export function InvoiceRow({
  invoice: i,
  today,
  formatLocale,
  numberStyle,
  hideCustomer = false,
}: {
  invoice: InvoiceSummary;
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
  hideCustomer?: boolean;
}) {
  const money = (cents: number) => formatMoney(cents, i.currencyCode, numberStyle);
  const owingCents = i.grossCents - i.creditedCents - i.paidCents;
  const status = invoiceStatus({ grossCents: i.grossCents, paidCents: i.paidCents, creditedCents: i.creditedCents, dueDate: i.dueDate, today });
  return (
    <li className="rounded-xl bg-card ring-1 ring-foreground/10">
      <Link
        href={`/app/invoices/${i.id}`}
        className="block rounded-xl px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{hideCustomer ? i.number : i.customerName}</span>
          {!hideCustomer && <span className="shrink-0 text-sm font-medium text-muted-foreground">{i.number}</span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {money(i.grossCents)}
          {i.creditedCents > 0 ? ` · ${money(i.creditedCents)} credited` : ""}
          {(i.paidCents > 0 || i.creditedCents > 0) && owingCents > 0 ? ` · ${money(owingCents)} owing` : ""} · due {formatDay(i.dueDate, formatLocale)}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <InvoiceStatusChip status={status} />
        </span>
      </Link>
    </li>
  );
}
