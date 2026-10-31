"use client";

import Link from "@/components/app-link";
import { PrivateTag } from "@/components/private-tag";
import { formatMoney, formatPercent, type NumberStyle } from "@/lib/money";
import { quoteMargin } from "@/lib/costing";
import { MarginPrompt } from "./margin-prompt";
import { priceForMarginCents, targetStanding } from "@/lib/costing/target";
import type { LineMargin } from "@/lib/quotes/margin";

/**
 * "Only you see this" (docs/plans/costing-and-margin.md, slice A): what the quote earns after what it costs to make,
 * on a draft. One quiet line that opens into a breakdown for each item. Items with no costs are named, with a link to
 * where to add them, and are left out of the figure (it says how many are counted). Without VAT, said once. It is
 * never part of the customer's quote.
 */
export function MarginPanel({
  items,
  currencyCode,
  numberStyle,
  note,
  targetBp = null,
  frozen = false,
  vatRegistered = false,
  askAboutMargin = false,
}: {
  items: LineMargin[];
  currencyCode: string;
  numberStyle: NumberStyle;
  /** Said under the breakdown: "Worked out when you sent this version" on a sent quote. */
  note?: string;
  /** The margin the business aims for (basis points); null when it has not said, and nothing is judged. */
  targetBp?: number | null;
  /** A sent quote: nothing here can be edited, so no prompts to add costs. */
  frozen?: boolean;
  /** Said once, and only to a business that is VAT registered: that costs and margins are worked out without VAT. */
  vatRegistered?: boolean;
  /** No costs yet and the friendly card has not been dismissed for good: show it, not just the quiet line. */
  askAboutMargin?: boolean;
}) {
  if (items.length === 0) return null;
  const money = (cents: number) => formatMoney(cents, currencyCode, numberStyle);
  const total = quoteMargin(items.map((i) => i.margin ?? { revenueCents: 0, costCents: null, profitCents: null, marginBp: null, incomplete: false }));
  // Items with no costs are not counted at all, so the figure is for the costed ones.
  const costed = total.costedItems;
  if (costed === 0 && !frozen) {
    return <MarginPrompt asking={askAboutMargin} />;
  }
  const partial = costed < items.length;
  const target = targetBp === null ? null : formatPercent(targetBp, numberStyle);
  const standing = targetStanding(total.marginBp, targetBp);
  return (
    <details className="group text-sm" data-testid="margin-panel">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>
          <PrivateTag /> Margin <span className="font-medium text-foreground" data-testid="margin-summary">{money(total.profitCents)}{total.marginBp === null ? "" : ` · ${formatPercent(total.marginBp, numberStyle)}`}</span>
          {total.incomplete ? " or less" : ""}
          {partial ? ` (costed items only, ${costed} of ${items.length})` : ""}
          {standing && (
            <span className={standing === "meets" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"} data-testid="margin-standing">
              {" "}
              · {standing === "meets" ? "meets" : "below"} your {target} target
            </span>
          )}
        </span>
      </summary>
      <div className="space-y-3 pb-2">
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="rounded-lg border border-border px-3 py-2" data-testid="margin-item">
              <p className="font-medium">{i.name}</p>
              {i.margin && i.margin.costCents !== null ? (
                <>
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
                {targetBp !== null && targetStanding(i.margin.marginBp, targetBp) === "below" && (
                  <p className="text-amber-800 dark:text-amber-300" data-testid="margin-item-hint">
                    Below your {target} target.
                    {(() => {
                      const price = priceForMarginCents(i.margin.costCents, targetBp);
                      return price === null ? "" : ` For ${target}, sell it for ${money(price)}${vatRegistered ? ", without VAT" : ""}.`;
                    })()}
                  </p>
                )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  {frozen ? "No costs were recorded for this item." : "No costs yet."}{" "}
                  {frozen ? null : i.productId ? (
                    <Link href={`/app/products/${i.productId}`} className="underline underline-offset-4">
                      Add what it costs to make
                    </Link>
                  ) : (
                    "Say what it costs you on the item to see its margin."
                  )}
                </p>
              )}
            </li>
          ))}
        </ul>
        {note && <p className="text-muted-foreground">{note}</p>}
        {frozen && targetBp !== null && <p className="text-muted-foreground">Compared with the margin you aim for now.</p>}
        {vatRegistered && <p className="text-muted-foreground">Costs and margins are worked out without VAT.</p>}
      </div>
    </details>
  );
}
