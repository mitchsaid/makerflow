/**
 * Units for materials (docs/plans/costs-and-recipes.md). Every unit has a kind (mass, volume, length or count)
 * and a whole-number factor to the smallest unit of its kind, so conversions are exact integer arithmetic.
 * Amounts convert only within a kind: litres of something bought by the kilo is refused, never read as 1:1.
 */

export const UNIT_CODES = ["mg", "g", "kg", "ml", "l", "mm", "cm", "m", "each", "dozen"] as const;
export type UnitCode = (typeof UNIT_CODES)[number];
export type UnitKind = "mass" | "volume" | "length" | "count";

type UnitInfo = {
  kind: UnitKind;
  /** How many of the smallest unit of its kind (milligrams, millilitres, millimetres, one) make one of this. */
  perUnit: number;
  /** In plain words, for choosing: "Kilograms (kg)". */
  label: string;
  /** What follows "per" or an amount: "kg", "each". */
  short: string;
};

export const UNITS: Record<UnitCode, UnitInfo> = {
  mg: { kind: "mass", perUnit: 1, label: "Milligrams (mg)", short: "mg" },
  g: { kind: "mass", perUnit: 1_000, label: "Grams (g)", short: "g" },
  kg: { kind: "mass", perUnit: 1_000_000, label: "Kilograms (kg)", short: "kg" },
  ml: { kind: "volume", perUnit: 1, label: "Millilitres (ml)", short: "ml" },
  l: { kind: "volume", perUnit: 1_000, label: "Litres (l)", short: "l" },
  mm: { kind: "length", perUnit: 1, label: "Millimetres (mm)", short: "mm" },
  cm: { kind: "length", perUnit: 10, label: "Centimetres (cm)", short: "cm" },
  m: { kind: "length", perUnit: 1_000, label: "Metres (m)", short: "m" },
  each: { kind: "count", perUnit: 1, label: "Each (pieces)", short: "each" },
  dozen: { kind: "count", perUnit: 12, label: "Dozen (12)", short: "dozen" },
};

export const isUnitCode = (value: unknown): value is UnitCode =>
  typeof value === "string" && (UNIT_CODES as readonly string[]).includes(value);

/** The units that can be chosen, grouped by kind in a sensible order. */
export const UNIT_CHOICES: { kind: UnitKind; title: string; units: UnitCode[] }[] = [
  { kind: "mass", title: "Weight", units: ["g", "kg", "mg"] },
  { kind: "volume", title: "Liquid", units: ["ml", "l"] },
  { kind: "length", title: "Length", units: ["mm", "cm", "m"] },
  { kind: "count", title: "Count", units: ["each", "dozen"] },
];

/** Do these two units measure the same kind of thing, so an amount of one can stand for the other? */
export const sameKind = (a: UnitCode, b: UnitCode): boolean => UNITS[a].kind === UNITS[b].kind;

/** An amount in thousandths of a unit, as a count of the smallest unit of its kind (still in thousandths). Exact. */
export function toBaseMilli(amountMilli: number, unit: UnitCode): bigint {
  return BigInt(amountMilli) * BigInt(UNITS[unit].perUnit);
}
