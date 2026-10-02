/**
 * Money primitives. The rules (CLAUDE.md): money is never a JavaScript float. Amounts are
 * whole cents in plain integers; quantities are whole thousandths; percentages are whole
 * basis points (1 basis point = 0.01%, so 15% = 1500). Multiplication and division go
 * through BigInt so nothing is rounded by floating point and nothing overflows.
 */

/** Whole cents (or the smallest unit of whatever currency). */
export type Cents = number;
/** A quantity in thousandths: 1 unit = 1000, half a unit = 500. Up to 3 decimals. */
export type QuantityMilli = number;
/** A percentage in basis points: 15% = 1500, 12.5% = 1250. */
export type BasisPoints = number;

export const QUANTITY_SCALE = 1000;
export const BASIS_POINTS_100_PERCENT = 10_000;

/** Largest amount we accept: R999 999 999.99. Keeps every intermediate value well inside safe integers. */
export const MAX_CENTS: Cents = 99_999_999_999;
/** Largest quantity we accept: 9 999 999.999. */
export const MAX_QUANTITY_MILLI: QuantityMilli = 9_999_999_999;

export function assertSafeInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what} must be a whole number, got ${value}`);
  }
}

/**
 * round(a * b / c) to the nearest whole number, halves rounded away from zero
 * ("round half up" for the positive amounts we use). All integers; c must be positive.
 */
export function mulDivRound(a: number, b: number, c: number): number {
  assertSafeInteger(a, "a");
  assertSafeInteger(b, "b");
  assertSafeInteger(c, "c");
  if (c <= 0) throw new RangeError("divisor must be positive");
  const numerator = BigInt(a) * BigInt(b);
  const denominator = BigInt(c);
  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute * BigInt(2) + denominator) / (denominator * BigInt(2));
  return Number(negative ? -rounded : rounded);
}

/**
 * Splits `total` across weights so the shares add up to exactly `total`: each gets its
 * proportional floor, then the leftover cents go to the largest remainders (ties to the
 * earlier entry). Weights must be non-negative; if they are all zero the shares are all zero.
 */
export function allocateProportionally(total: number, weights: readonly number[]): number[] {
  assertSafeInteger(total, "total");
  if (total < 0) throw new RangeError("total must not be negative");
  weights.forEach((w) => {
    assertSafeInteger(w, "weight");
    if (w < 0) throw new RangeError("weights must not be negative");
  });
  const sum = weights.reduce((acc, w) => acc + BigInt(w), BigInt(0));
  if (sum === BigInt(0) || total === 0) return weights.map(() => 0);

  const bigTotal = BigInt(total);
  const shares: number[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let assigned = BigInt(0);
  weights.forEach((w, index) => {
    const product = bigTotal * BigInt(w);
    const share = product / sum;
    shares.push(Number(share));
    remainders.push({ index, remainder: product % sum });
    assigned += share;
  });

  let leftover = Number(bigTotal - assigned);
  remainders.sort((x, y) =>
    x.remainder === y.remainder ? x.index - y.index : x.remainder > y.remainder ? -1 : 1,
  );
  for (const { index } of remainders) {
    if (leftover === 0) break;
    shares[index] += 1;
    leftover -= 1;
  }
  return shares;
}
