"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  INVOICE_FILTERS,
  invoiceStatus,
  visibleInvoices,
  type InvoiceFilter,
  type InvoiceSummary,
} from "@/lib/invoices";
import { formatMoney, type NumberStyle } from "@/lib/money";
import { formatDay } from "@/lib/quotes/dates";
import { InvoiceStatusChip } from "./invoice-status-chip";

/** The invoices list: newest first, search as you type, a few filters. The whole list is loaded once. */
export function InvoiceList({
  invoices,
  today,
  formatLocale,
  numberStyle,
}: {
  invoices: InvoiceSummary[];
  /** Today, as YYYY-MM-DD, in the business's time zone. */
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
}) {
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [query, setQuery] = useState("");

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">No invoices yet</p>
          <p className="text-muted-foreground">Open an accepted quote and choose Create invoice.</p>
          <Link href="/app/quotes" className={buttonVariants({ variant: "outline" })}>
            Go to your quotes
          </Link>
        </CardContent>
      </Card>
    );
  }

  const statusOf = (i: InvoiceSummary) => invoiceStatus({ grossCents: i.grossCents, paidCents: 0, dueDate: i.dueDate, today });
  const counts: Record<InvoiceFilter, number> = {
    all: invoices.length,
    unpaid: invoices.filter((i) => statusOf(i) !== "paid").length,
    overdue: invoices.filter((i) => statusOf(i) === "overdue").length,
    paid: invoices.filter((i) => statusOf(i) === "paid").length,
  };
  const visible = visibleInvoices(invoices, filter, query, today);

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor="invoice-search">Search invoices</FieldLabel>
        <Input
          id="invoice-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Customer or invoice number"
          autoComplete="off"
        />
      </Field>

      <div role="group" aria-label="Show invoices" className="flex flex-wrap gap-2">
        {INVOICE_FILTERS.map((f) => (
          <Button
            key={f.key}
            type="button"
            variant={filter === f.key ? "default" : "outline"}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({counts[f.key]})
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="invoice-count">
        {visible.length === 1 ? "1 invoice" : `${visible.length} invoices`}
      </p>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          {query.trim() !== "" ? `No invoices match “${query.trim()}”.` : filter === "overdue" ? "Nothing is overdue." : "No invoices here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((i) => (
            <li key={i.id} className="rounded-xl bg-card ring-1 ring-foreground/10">
              <Link
                href={`/app/invoices/${i.id}`}
                className="block rounded-xl px-4 py-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-medium">{i.customerName}</span>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">{i.number}</span>
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {formatMoney(i.grossCents, i.currencyCode, numberStyle)} · due {formatDay(i.dueDate, formatLocale)}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                  <InvoiceStatusChip status={statusOf(i)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
