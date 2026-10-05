import type { LocalePack } from "../locale";

/**
 * A business's bank details, kept once in the Business profile and shown on its documents.
 * The fields, their checks and their labels come from the country's locale pack (see
 * LocalePack.payment); nothing here knows what a branch code is. See docs/plans/bank-details.md.
 */

/** The details as stored: one row per business. */
export type BankDetails = {
  countryCode: string;
  /** Field key (from the locale pack) to value. Only keys the pack knows are kept. */
  details: Record<string, string>;
  /** Ask customers to use the document number as their payment reference. */
  useReference: boolean;
  /** ISO timestamp of the last change. */
  updatedAt: string;
};

/** What the bank details form holds while it is filled in. */
export type BankFormValues = { fields: Record<string, string>; useReference: boolean };

export type BankFieldErrors = Record<string, string>;

export type ParsedBankForm =
  | { ok: true; details: Record<string, string>; useReference: boolean }
  | { ok: false; errors: BankFieldErrors };

/** One line of the "How to pay" block on a document: "Bank" / "FNB". */
export type BankLine = { label: string; value: string };

/** The shape of a stored row, as read from the database. */
export type BankRow = {
  country_code: string;
  details: unknown;
  use_reference: boolean;
  updated_at: string;
};

/**
 * Turns a stored row into bank details for this business's country. A row for another country's
 * rules is not used: there is no falling back to another country's fields.
 */
export function bankFromRow(row: BankRow | null | undefined, locale: LocalePack): BankDetails | null {
  if (!row || row.country_code !== locale.countryCode) return null;
  const raw = row.details;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const details: Record<string, string> = {};
  for (const field of locale.payment.bankFields) {
    const value = (raw as Record<string, unknown>)[field.key];
    if (typeof value === "string" && value !== "") details[field.key] = value;
  }
  if (Object.keys(details).length === 0) return null;
  return { countryCode: row.country_code, details, useReference: row.use_reference === true, updatedAt: row.updated_at };
}

/** Checks the form against the country's fields, saying how to fix each problem. */
export function parseBankForm(values: BankFormValues, locale: LocalePack): ParsedBankForm {
  const errors: BankFieldErrors = {};
  const details: Record<string, string> = {};
  for (const field of locale.payment.bankFields) {
    const raw = values.fields?.[field.key];
    const typed = typeof raw === "string" ? raw.trim() : "";
    if (typed === "") {
      if (field.required) {
        errors[field.key] = field.options
          ? `Choose the ${field.label.toLowerCase()} from the list.`
          : `Enter the ${field.label.toLowerCase()}.`;
      }
      continue;
    }
    const checked = field.validate(typed);
    if (checked.ok) details[field.key] = checked.value;
    else errors[field.key] = checked.error;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, details, useReference: values.useReference === true };
}

/**
 * The lines a document prints under "How to pay": one per field the business filled in, in the
 * country's order, then the payment reference when the business asked for it. `reference` is the
 * document number ("QT-0042"). Empty when there are no details.
 */
export function bankLines(bank: BankDetails | null, reference: string | null, locale: LocalePack): BankLine[] {
  if (!bank || bank.countryCode !== locale.countryCode) return [];
  const lines: BankLine[] = [];
  for (const field of locale.payment.bankFields) {
    const value = bank.details[field.key];
    if (value) lines.push({ label: field.label, value });
  }
  if (lines.length > 0 && bank.useReference && reference) {
    lines.push({ label: locale.payment.referenceLabel, value: reference });
  }
  return lines;
}

/** A short "FNB, ending 6789" for a screen. */
export function bankSummary(bank: BankDetails, locale: LocalePack): string {
  return locale.payment.bankSummary(bank.details);
}

/** All a quote screen needs: which account (never the whole number) and whether the reference is asked for. */
export type BankPreview = { summary: string; useReference: boolean };

export function bankPreview(bank: BankDetails | null, locale: LocalePack): BankPreview | null {
  return bank ? { summary: bankSummary(bank, locale), useReference: bank.useReference } : null;
}

/** Owners only: changing where customers send money is how invoice fraud happens. */
export function canEditBankDetails(role: string | null): boolean {
  return role === "owner";
}
