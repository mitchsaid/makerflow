import type { ValidationResult } from "../validation";
import {
  MAX_CENTS,
  MAX_QUANTITY_MILLI,
  type BasisPoints,
  type Cents,
  type QuantityMilli,
} from "./primitives";

/**
 * Turns what a person typed into exact integers. Lenient about habits that differ by
 * country: a comma or a dot as the decimal mark, spaces (including non-breaking ones)
 * between thousands, an optional leading "R" (rand). Nothing here uses floating point.
 */

type Split = { whole: string; fraction: string } | null;

/** "1 250,50" -> {whole:"1250", fraction:"50"}. Null when the shape is not a plain number. */
function splitNumber(raw: string): Split {
  const text = raw.replace(/[\s  ]/g, "").replace(/^R/i, "");
  if (text === "" || /[^0-9.,]/.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  const lastSeparator = Math.max(lastDot, lastComma);

  if (lastSeparator === -1) return { whole: text, fraction: "" };

  const before = text.slice(0, lastSeparator);
  const after = text.slice(lastSeparator + 1);
  const otherSeparatorInBefore = /[.,]/.test(before);

  if (otherSeparatorInBefore) {
    // Both marks used (1,234.50 or 1.234,50): the LAST one is the decimal mark, the
    // earlier ones are thousands marks and must be the other character, in groups of 3.
    const thousandsMark = lastDot > lastComma ? "," : ".";
    const groups = before.split(thousandsMark);
    if (groups.some((g, i) => (i === 0 ? !/^\d{1,3}$/.test(g) : !/^\d{3}$/.test(g)))) return null;
    return { whole: groups.join(""), fraction: after };
  }

  // One separator. Three digits after it, with a short non-zero start, reads as thousands
  // ("1,500" means 1500); anything else reads as the decimal mark.
  if (/^\d{3}$/.test(after) && /^[1-9]\d{0,2}$/.test(before)) {
    return { whole: before + after, fraction: "" };
  }
  if (!/^\d*$/.test(before) || !/^\d*$/.test(after)) return null;
  return { whole: before === "" ? "0" : before, fraction: after };
}

function scaled(split: NonNullable<Split>, decimals: number): number | null {
  if (split.fraction.length > decimals) return null;
  const fraction = split.fraction.padEnd(decimals, "0");
  const digits = (split.whole + fraction).replace(/^0+(?=\d)/, "");
  if (digits.length > 15) return null;
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** An amount of money, to the cent. Accepts "1250", "1 250,50", "R1,250.50". Not negative. */
export function parseMoney(input: unknown): ValidationResult<Cents> {
  const text = typeof input === "string" ? input : "";
  if (text.trim() === "") return { ok: false, error: "Enter an amount, like 1 250 or 1 250,50." };
  const split = splitNumber(text);
  if (!split) return { ok: false, error: "Enter an amount using numbers only, like 1 250 or 1 250,50." };
  const cents = scaled(split, 2);
  if (cents === null) {
    return { ok: false, error: "Amounts can have at most 2 decimals, like 49,95." };
  }
  if (cents > MAX_CENTS) return { ok: false, error: "That amount is too large." };
  return { ok: true, value: cents };
}

/** A quantity with up to 3 decimals ("0,5", "2", "1.25"). Must be greater than zero. */
export function parseQuantity(input: unknown): ValidationResult<QuantityMilli> {
  const text = typeof input === "string" ? input : "";
  if (text.trim() === "") return { ok: false, error: "Enter a quantity, like 1 or 0,5." };
  const split = splitNumber(text);
  if (!split) return { ok: false, error: "Enter a quantity using numbers only, like 1 or 0,5." };
  const milli = scaled(split, 3);
  if (milli === null) {
    return { ok: false, error: "Quantities can have at most 3 decimals, like 0,25." };
  }
  if (milli === 0) return { ok: false, error: "The quantity must be more than zero." };
  if (milli > MAX_QUANTITY_MILLI) return { ok: false, error: "That quantity is too large." };
  return { ok: true, value: milli };
}

/** A percentage between 0 and 100 with up to 2 decimals ("10", "12,5", "7.25%"). */
export function parsePercent(input: unknown): ValidationResult<BasisPoints> {
  const text = typeof input === "string" ? input.replace(/%/g, "") : "";
  if (text.trim() === "") return { ok: false, error: "Enter a percentage, like 10 or 12,5." };
  const split = splitNumber(text);
  if (!split) return { ok: false, error: "Enter a percentage using numbers only, like 10 or 12,5." };
  const basisPoints = scaled(split, 2);
  if (basisPoints === null) {
    return { ok: false, error: "Percentages can have at most 2 decimals, like 7,25." };
  }
  if (basisPoints > 10_000) return { ok: false, error: "A percentage can't be more than 100." };
  return { ok: true, value: basisPoints };
}
