import { MAX_CENTS, parsePercent, type BasisPoints, type Cents } from "../money";
import type { PriceEntry, VatSettings, VatStatus } from "../money";
import type { ValidationResult } from "../validation";

/**
 * The margin a maker aims for (docs/plans/costing-slice-c.md): the share of the price (without VAT) that is left after
 * what it costs to make. Margin, not mark-up: a price of cost ÷ (1 − margin).
 */

/** The smallest and largest target: 1% to 99% (a margin of 100% would need a price of any size). */
export const MIN_TARGET_BP = 100;
export const MAX_TARGET_BP = 9900;

/** The target as typed in the Business profile: empty is "not set" (null), else a percentage from 1 to 99. */
export function parseTargetMargin(input: unknown): ValidationResult<BasisPoints | null> {
  const text = typeof input === "string" ? input : "";
  if (text.trim() === "") return { ok: true, value: null };
  const percent = parsePercent(text);
  // Whatever is wrong with it, the way to fix it is the same: a percentage from 1 to 99.
  if (!percent.ok || percent.value < MIN_TARGET_BP || percent.value > MAX_TARGET_BP) {
    return { ok: false, error: "Enter a margin from 1 to 99 percent, like 40." };
  }
  return { ok: true, value: percent.value };
}

/**
 * Where a margin stands against the target: "meets" at or above it, "below" under it, null when there is no target or
 * no margin to judge. Words always go with any colour.
 */
export function targetStanding(marginBp: BasisPoints | null, targetBp: BasisPoints | null): "meets" | "below" | null {
  if (marginBp === null || targetBp === null) return null;
  return marginBp >= targetBp ? "meets" : "below";
}

/**
 * What to charge, without VAT, for the target margin on a cost: cost ÷ (1 − margin), rounded UP to the cent so the margin
 * is at least the target. Null when there is nothing to base it on (no cost) or the answer is more than money can hold.
 */
export function priceForMarginCents(costCents: Cents, targetBp: BasisPoints): Cents | null {
  if (costCents <= 0 || targetBp < MIN_TARGET_BP || targetBp > MAX_TARGET_BP) return null;
  const denominator = BigInt(10_000 - targetBp);
  const price = (BigInt(costCents) * BigInt(10_000) + denominator - BigInt(1)) / denominator;
  return price > BigInt(MAX_CENTS) ? null : Number(price);
}

/**
 * The same price the way the maker types prices in: with the VAT added when the business enters prices including VAT and
 * the item is at the standard rate, else as it is. Rounded up to the cent, so taking the VAT out again leaves at least
 * the price without VAT.
 */
export function priceToEnterCents(netCents: Cents, vat: VatSettings, vatStatus: VatStatus = "standard"): Cents | null {
  if (!vat.registered || vat.entry !== ("inclusive" satisfies PriceEntry) || vatStatus !== "standard") return netCents;
  const rate = BigInt(10_000 + vat.standardRateBp);
  const gross = (BigInt(netCents) * rate + BigInt(9_999)) / BigInt(10_000);
  return gross > BigInt(MAX_CENTS) ? null : Number(gross);
}
