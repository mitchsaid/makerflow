import type { QuoteSnapshot, SnapshotLine } from "./snapshot";

/**
 * How a frozen quote shows VAT treatments. A document that mixes standard-rated, zero-rated or exempt items
 * names the treatment on each item and breaks the totals down by treatment (the country's rule, from the
 * words frozen in the snapshot). A document of only standard-rated items looks exactly as it always has.
 */
export type VatView = {
  mixed: boolean;
  /** The treatment's name to print under an item, or null when nothing is printed. */
  lineLabel(line: SnapshotLine): string | null;
  /** One row per treatment, with its amount (in the price-entry mode) and the VAT in it. Empty unless mixed. */
  breakdown: { label: string; amountCents: number; vatCents: number }[];
  /** Whether the VAT row should name the standard rate (not when nothing on the quote is standard-rated). */
  showRate: boolean;
};

export function vatView(s: QuoteSnapshot): VatView {
  const labels = s.wording.vatStatusLabels;
  const statusOf = (l: SnapshotLine) => l.vatStatus ?? "standard";
  const mixed = s.vat.registered && !!labels && s.lines.some((l) => statusOf(l) !== "standard");
  const groups = s.totals.groups.filter((g) => g.amountCents > 0);
  return {
    mixed,
    lineLabel: (line) => (mixed && labels && line.kind !== "collection" ? labels[statusOf(line)] : null),
    breakdown:
      mixed && labels
        ? groups.map((g) => ({ label: labels[g.vatStatus], amountCents: g.amountCents, vatCents: g.vatCents }))
        : [],
    showRate: !mixed || groups.some((g) => g.vatStatus === "standard"),
  };
}
