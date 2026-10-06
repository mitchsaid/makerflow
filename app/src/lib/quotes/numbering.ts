/**
 * Quote numbers: a prefix and a counter, as Quotes and invoices lets the owner set them. The
 * database hands the numbers out (issue_document_number); this is for showing a preview and
 * for checking what the person typed before it is sent.
 */

export const NUMBER_PREFIX_MAX = 12;
export const NUMBER_MAX = 999_999_999;
export const DEFAULT_QUOTE_PREFIX = "QT-";
export const DEFAULT_MIN_DIGITS = 4;

const PREFIX_PATTERN = /^[A-Za-z0-9._/-]{0,12}$/;

/** "QT-" and 42 give "QT-0042". A counter longer than the padding is never cut. Same as the database. */
export function formatDocumentNumber(prefix: string, number: number, minDigits = DEFAULT_MIN_DIGITS): string {
  const digits = String(number);
  return prefix + (digits.length >= minDigits ? digits : digits.padStart(minDigits, "0"));
}

export type NumberingValues = { prefix: string; nextNumber: string };
export type NumberingErrors = Partial<Record<keyof NumberingValues, string>>;

export function parseNumbering(
  values: NumberingValues,
  lastIssued: number | null,
): { ok: true; prefix: string; nextNumber: number } | { ok: false; errors: NumberingErrors } {
  const errors: NumberingErrors = {};
  const prefix = values.prefix.trim();
  if (!PREFIX_PATTERN.test(prefix)) {
    errors.prefix = `Use letters, numbers and . _ / - only, up to ${NUMBER_PREFIX_MAX} characters, with no spaces.`;
  }

  const raw = values.nextNumber.trim();
  let nextNumber = NaN;
  if (!/^\d{1,9}$/.test(raw)) {
    errors.nextNumber = "Enter a whole number, like 42.";
  } else {
    nextNumber = Number(raw);
    if (nextNumber < 1) errors.nextNumber = "The next number must be 1 or more.";
    else if (nextNumber > NUMBER_MAX) errors.nextNumber = `The next number can be up to ${NUMBER_MAX}.`;
    else if (lastIssued !== null && nextNumber <= lastIssued) {
      errors.nextNumber = `Number ${lastIssued} has already been used. Choose ${lastIssued + 1} or higher so no two quotes share a number.`;
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, prefix, nextNumber };
}
