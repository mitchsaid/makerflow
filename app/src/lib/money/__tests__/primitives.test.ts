import { describe, expect, it } from "vitest";
import { allocateProportionally, mulDivRound } from "../primitives";

describe("mulDivRound", () => {
  it("rounds to the nearest whole number, halves away from zero", () => {
    expect(mulDivRound(1, 1, 2)).toBe(1); // 0.5 -> 1
    expect(mulDivRound(1, 1, 3)).toBe(0); // 0.333 -> 0
    expect(mulDivRound(2, 1, 3)).toBe(1); // 0.667 -> 1
    expect(mulDivRound(5, 1, 2)).toBe(3); // 2.5 -> 3
    expect(mulDivRound(-5, 1, 2)).toBe(-3); // -2.5 -> -3
    expect(mulDivRound(0, 7, 3)).toBe(0);
  });

  it("is exact where floating point is not", () => {
    // 0.5 kg at R99.99 per kg is R49.995, which must round up to R50.00
    expect(mulDivRound(500, 9999, 1000)).toBe(5000);
    // 15% of R0.10 is 1.5 cents -> 2 cents
    expect(mulDivRound(10, 1500, 10_000)).toBe(2);
    // 1.005 style trap: 1005 * 1 / 1000 -> exactly 1.005 -> 1
    expect(mulDivRound(1005, 1, 1000)).toBe(1);
  });

  it("handles products larger than 2^53 without losing precision", () => {
    expect(mulDivRound(9_999_999_999, 99_999_999_999, 10_000_000_000)).toBe(99_999_999_989);
  });

  it("rejects non-integers and a zero divisor", () => {
    expect(() => mulDivRound(1.5, 1, 1)).toThrow();
    expect(() => mulDivRound(1, 1, 0)).toThrow();
    expect(() => mulDivRound(1, 1, -2)).toThrow();
  });
});

describe("allocateProportionally", () => {
  it("shares add up exactly, with leftovers going to the largest remainders", () => {
    expect(allocateProportionally(100, [100, 100, 100])).toEqual([34, 33, 33]);
    expect(allocateProportionally(1, [1, 1, 1])).toEqual([1, 0, 0]);
    expect(allocateProportionally(10, [1, 2, 7])).toEqual([1, 2, 7]);
    expect(allocateProportionally(7, [3, 3, 1])).toEqual([3, 3, 1]);
  });

  it("gives nothing when there is nothing to share or no weight", () => {
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportionally(50, [0, 0])).toEqual([0, 0]);
    expect(allocateProportionally(50, [])).toEqual([]);
  });

  it("never gives a zero-weight line anything", () => {
    expect(allocateProportionally(99, [0, 10, 0, 20])).toEqual([0, 33, 0, 66]);
  });

  it("always adds up, for many random splits", () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 500; i++) {
      const weights = Array.from({ length: 1 + Math.floor(random() * 8) }, () =>
        Math.floor(random() * 100_000),
      );
      const total = Math.floor(random() * 1_000_000);
      const shares = allocateProportionally(total, weights);
      const sumWeights = weights.reduce((a, b) => a + b, 0);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(sumWeights === 0 ? 0 : total);
      shares.forEach((share, j) => {
        expect(Number.isInteger(share)).toBe(true);
        expect(share).toBeGreaterThanOrEqual(0);
        if (weights[j] === 0) expect(share).toBe(0);
      });
    }
  });
});
