"use client";

import { useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { NoMatches } from "@/components/empty-state";
import type { NumberStyle } from "@/lib/money";
import type { QuoteSummary } from "@/lib/quotes/data";
import { STATUS_FILTERS, type QuoteStatusKey } from "@/lib/quotes/status";
import { QuoteRow } from "./quote-row";

type Filter = "all" | QuoteStatusKey;

/** The quotes list: newest first, with a chip for each status that has quotes in it. The whole list is loaded once, so a chip answers at once. */
export function QuoteList({
  quotes,
  today,
  formatLocale,
  numberStyle,
  initialFilter = "all",
}: {
  quotes: (QuoteSummary & { key: QuoteStatusKey })[];
  today: string;
  formatLocale: string;
  numberStyle: NumberStyle;
  initialFilter?: Filter;
}) {
  const counts = new Map<string, number>([["all", quotes.length]]);
  for (const q of quotes) counts.set(q.key, (counts.get(q.key) ?? 0) + 1);
  // Only statuses with something in them, and "All" always.
  const options = STATUS_FILTERS.filter((f) => f.key === "all" || (counts.get(f.key) ?? 0) > 0).map((f) => ({ ...f, count: counts.get(f.key) ?? 0 }));
  const [chosen, setChosen] = useState<Filter>(initialFilter);
  const filter = options.some((o) => o.key === chosen) ? chosen : "all";
  const shown = filter === "all" ? quotes : quotes.filter((q) => q.key === filter);

  return (
    <div className="space-y-4">
      {options.length > 2 && <FilterBar label="Show quotes" options={options} value={filter} onChange={setChosen} />}
      {shown.length === 0 ? (
        <NoMatches message="No quotes here yet." clearLabel="Show all quotes" onClear={() => setChosen("all")} />
      ) : (
        <ul className="space-y-2">
          {shown.map((q) => (
            <QuoteRow key={q.id} quote={q} today={today} formatLocale={formatLocale} numberStyle={numberStyle} />
          ))}
        </ul>
      )}
    </div>
  );
}
