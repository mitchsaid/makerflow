import { formatPercent, type NumberStyle, type VatSettings, type VatStatus } from "../money";

/** The ways VAT can treat an item (or a product's default), in the country's words. */
export type VatChoice = { value: VatStatus; label: string; hint: string };

/**
 * The choices to offer for an item or a product, or null when the business is not VAT registered
 * (then there is nothing to choose: everything is standard and no VAT shows anywhere). `statuses` is the
 * locale pack's `tax.statuses`.
 */
export function vatChoicesFor(
  vat: VatSettings,
  statuses: Record<VatStatus, { label: string; hint: string }>,
  style: NumberStyle,
): VatChoice[] | null {
  if (!vat.registered) return null;
  return (["standard", "zero", "exempt"] as const).map((value) => ({
    value,
    label: value === "standard" ? `${statuses.standard.label} (${formatPercent(vat.standardRateBp, style)})` : statuses[value].label,
    hint: statuses[value].hint,
  }));
}
