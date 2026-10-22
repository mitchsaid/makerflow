"use client";

import Link from "next/link";
import { useState } from "react";
import { AddLink } from "@/components/add-button";
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
import type { InvoiceDraftRow as DraftRow } from "@/lib/invoices/draft";
import type { NumberStyle } from "@/lib/money";
import { InvoiceDraftRow } from "./invoice-draft-row";
import { InvoiceRow } from "./invoice-row";

/** The invoices list: newest first, search as you type, a few filters. The whole list is loaded once. */
export function InvoiceList({
  invoices,
  drafts,
  currencyCode,
  today,
  formatLocale,
  numberStyle,
  initialFilter = "all",
}: {
  initialFilter?: InvoiceFilter;
  invoices: InvoiceSummary[];
  /** Invoices that are not issued yet. */
  drafts: DraftRow[];
  currencyCode: string;
  /** Today, as YYYY-MM-DD, in the business's time zone. */
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
}) {
  const [filter, setFilter] = useState<InvoiceFilter>(initialFilter);
  const [query, setQuery] = useState("");

  if (invoices.length === 0 && drafts.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">No invoices yet</p>
          <p className="text-muted-foreground">Open an accepted quote and choose Create invoice, or start one with no quote.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <AddLink href="/app/invoices/new" variant="default">
              New invoice
            </AddLink>
            <Link href="/app/quotes" className={buttonVariants({ variant: "outline" })}>
              Go to your quotes
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusOf = (i: InvoiceSummary) => invoiceStatus({ grossCents: i.grossCents, paidCents: i.paidCents, creditedCents: i.creditedCents, dueDate: i.dueDate, today });
  const counts: Record<InvoiceFilter, number> = {
    all: invoices.length,
    unpaid: invoices.filter((i) => statusOf(i) !== "paid" && statusOf(i) !== "credited").length,
    overdue: invoices.filter((i) => statusOf(i) === "overdue").length,
    paid: invoices.filter((i) => statusOf(i) === "paid").length,
    credited: invoices.filter((i) => i.creditedCents > 0).length,
    drafts: drafts.length,
  };
  const visible = visibleInvoices(invoices, filter, query, today);
  const needle = query.trim().toLowerCase();
  const visibleDrafts = filter === "drafts" ? drafts.filter((d) => needle === "" || (d.customerName ?? "").toLowerCase().includes(needle)) : [];
  // "Drafts" is offered once there is one (and stays while it is the one being looked at).
  const filters = INVOICE_FILTERS.filter((f) => f.key !== "drafts" || drafts.length > 0 || filter === "drafts");

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
        {filters.map((f) => (
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
        {filter === "drafts"
          ? visibleDrafts.length === 1
            ? "1 draft"
            : `${visibleDrafts.length} drafts`
          : visible.length === 1
            ? "1 invoice"
            : `${visible.length} invoices`}
      </p>

      {filter === "drafts" ? (
        visibleDrafts.length === 0 ? (
          <p className="text-muted-foreground">{needle !== "" ? `No drafts match “${query.trim()}”.` : "No drafts."}</p>
        ) : (
          <ul className="space-y-2">
            {visibleDrafts.map((d) => (
              <InvoiceDraftRow key={d.id} draft={d} currencyCode={currencyCode} formatLocale={formatLocale} numberStyle={numberStyle} />
            ))}
          </ul>
        )
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">
          {query.trim() !== "" ? `No invoices match “${query.trim()}”.` : filter === "overdue" ? "Nothing is overdue." : "No invoices here yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((i) => (
            <InvoiceRow key={i.id} invoice={i} today={today} formatLocale={formatLocale} numberStyle={numberStyle} />
          ))}
        </ul>
      )}
    </div>
  );
}
