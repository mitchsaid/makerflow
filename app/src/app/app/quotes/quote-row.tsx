import Link from "next/link";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import type { QuoteSummary } from "@/lib/quotes/data";
import { quoteRowActions } from "@/lib/quotes/row-actions";
import { QuoteRowMenu } from "./quote-row-menu";
import { StatusChip } from "./status-chip";

/** One quote in a list: on the Quotes list, and on a customer's page (where their name is left out). */
export function QuoteRow({
  quote: q,
  today,
  formatLocale,
  numberStyle,
  hideCustomer = false,
}: {
  quote: QuoteSummary;
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
  hideCustomer?: boolean;
}) {
  // The ⋯ is there when the card has something to offer (a draft to delete, a quote to turn into a job).
  const menu = quoteRowActions(q).length > 0;
  return (
    <li className="relative">
      <Link
        href={`/app/quotes/${q.id}`}
        className={`block rounded-xl bg-card py-3 pl-4 ${menu ? "pr-16" : "pr-4"} ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium">{hideCustomer ? `${q.number}${q.version > 1 ? ` · v${q.version}` : ""}` : (q.customerName ?? "No customer yet")}</span>
          <span className="shrink-0 text-base font-medium">{formatMoney(q.grossCents, q.currencyCode, numberStyle)}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          {!hideCustomer && (
            <span className="shrink-0 font-medium">
              {q.number}
              {q.version > 1 ? ` · v${q.version}` : ""}
            </span>
          )}
          <StatusChip status={q.status} version={q.version} validUntil={q.validUntil} today={today} />
          <span className="truncate">
            {formatDay(q.issueDate, formatLocale)} · valid until {formatDay(q.validUntil, formatLocale)}
          </span>
        </span>
      </Link>
      {menu && (
        <div className="absolute right-2 top-2">
          <QuoteRowMenu quote={q} today={today} />
        </div>
      )}
    </li>
  );
}
