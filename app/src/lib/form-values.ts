import type { ValidationResult } from "./validation";

/**
 * Helpers shared by the forms that turn typed text into values for the database. Empty
 * optional fields become null (the database stores NULL, never empty strings).
 */

/** Empty becomes null. Over-long is an error. Runs of spaces collapse to one. */
export function optionalText(
  raw: FormDataEntryValue | null,
  max: number,
  label: string,
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (value === "") return { ok: true, value: null };
  if (value.length > max) {
    return { ok: false, error: `${label} can be up to ${max} characters.` };
  }
  return { ok: true, value };
}

/** Several lines of text (line breaks kept, trailing spaces trimmed). Empty becomes null. */
export function optionalMultiline(
  raw: FormDataEntryValue | null,
  max: number,
  label: string,
  /** Also limit the number of lines (a document page can only hold so many). */
  maxLines?: number,
): ValidationResult<string | null> {
  const value =
    typeof raw === "string"
      ? raw
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((line) => line.trim().replace(/[ \t]+/g, " "))
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      : "";
  if (value === "") return { ok: true, value: null };
  if (value.length > max) {
    return { ok: false, error: `${label} can be up to ${max} characters.` };
  }
  if (maxLines !== undefined && value.split("\n").length > maxLines) {
    return { ok: false, error: `${label} can be up to ${maxLines} lines. Shorten it or join some lines.` };
  }
  return { ok: true, value };
}

/** Same as optionalText, but runs a stricter validator when something was entered. */
export function optionalValidated(
  raw: FormDataEntryValue | null,
  validate: (input: unknown) => ValidationResult<string>,
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { ok: true, value: null };
  return validate(value);
}

/** One of a fixed list (a province, say). Empty becomes null; anything else is an error. */
export function optionalChoice(
  raw: FormDataEntryValue | null,
  allowed: readonly string[],
  message: string,
): ValidationResult<string | null> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return { ok: true, value: null };
  return allowed.includes(value) ? { ok: true, value } : { ok: false, error: message };
}
