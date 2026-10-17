import { MAX_CENTS, parseMoney, type Cents } from "../money";
import type { ValidationResult } from "../validation";

/** What an hour of the maker's time is worth, as typed: empty is "not set" (null), else money per hour. */
export function parseLabourRate(input: unknown): ValidationResult<Cents | null> {
  const text = typeof input === "string" ? input : "";
  if (text.trim() === "") return { ok: true, value: null };
  const money = parseMoney(text);
  if (!money.ok) return money;
  if (money.value > MAX_CENTS) return { ok: false, error: "That amount is too large." };
  return { ok: true, value: money.value };
}
