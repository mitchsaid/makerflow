"use client";

import Link from "next/link";
import { formatMoney, formatPercent, type NumberStyle } from "@/lib/money";
import { quoteMargin } from "@/lib/costing";
import type { LineMargin } from "@/lib/quotes/margin";

/**
 * "Only you see this" (docs/plans/costing-and-margin.md, slice A): what the quote earns after what it costs to make,
 * on a draft. One quiet line that opens into a breakdown for each item. Items with no costs are named, with a link to
 * where to add them, and are left out of the figure (it says how many are counted). Without VAT, said once. It is
 * never part of the customer's quote.
 */
export function MarginPanel({ items, currencyCode, numberStyle }: { items: LineMargin[]; currencyCode: string; numberStyle: NumberStyle }) {
  if (items.length === 0) return null;
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const total = quoteMargin(items.map((i) => i.margin ?? { revenueCents: 0, costCents: null, profitCents: null, marginBp: null, incomplete: false }));
  // Items with no costs are not counted at all, so the figure is for the costed ones.
  const costed = total.costedItems;
  if (costed === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="margin-panel">
        Only you see this: add what a product costs to make to see your margin here.{" "}
        <Link href="/app/products" className="underline underline-offset-4">
          Go to your products
        </Link>
      </p>
    );
  }
  const partial = costed < items.length;
  return (
    <details className="group text-sm" data-testid="margin-panel">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>
          Only you see this: margin <span className="font-medium text-foreground" data-testid="margin-summary">{money(total.profitCents)}{total.marginBp === null ? "" : ` · ${formatPercent(total.marginBp, numberStyle)}`}</span>
          {total.incomplete ? " or less" : ""}
          {partial ? ` (costed items only, ${costed} of ${items.length})` : ""}
        </span>
      </summary>
      <div className="space-y-3 pb-2">
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="rounded-lg border border-border px-3 py-2" data-testid="margin-item">
              <p className="font-medium">{i.name}</p>
              {i.margin && i.margin.costCents !== null ? (
                <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-muted-foreground">
                  <dt>Sells for</dt>
                  <dd className="text-right">{money(i.margin.revenueCents)}</dd>
                  <dt>Costs{i.margin.incomplete ? " (at least)" : ""}</dt>
                  <dd className="text-right">{money(i.margin.costCents)}</dd>
                  <dt>Margin</dt>
                  <dd className="text-right text-foreground">
                    {money(i.margin.profitCents ?? 0)}
                    {i.margin.marginBp === null ? "" : ` · ${formatPercent(i.margin.marginBp, numberStyle)}`}
                  </dd>
                </dl>
              ) : (
                <p className="text-muted-foreground">
                  No costs yet.{" "}
                  {i.productId && (
                    <Link href={`/app/products/${i.productId}`} className="underline underline-offset-4">
                      Add what it costs to make
                    </Link>
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">Costs and margins are worked out without VAT.</p>
      </div>
    </details>
  );
}
