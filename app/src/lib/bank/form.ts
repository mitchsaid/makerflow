import { getLocalePack } from "../locale";
import type { BankDetails, BankFormValues } from "./index";

/** The empty form for a country: one blank value per field, reference ticked. */
export function emptyBankValues(countryCode: string): BankFormValues {
  const locale = getLocalePack(countryCode);
  return { fields: Object.fromEntries(locale.payment.bankFields.map((f) => [f.key, ""])), useReference: true };
}

/** The saved details as the form holds them. */
export function bankFormValues(bank: BankDetails | null, countryCode: string): BankFormValues {
  const empty = emptyBankValues(countryCode);
  if (!bank) return empty;
  return { fields: { ...empty.fields, ...bank.details }, useReference: bank.useReference };
}
