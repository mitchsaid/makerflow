import { moneyToInput, percentToInput, type NumberStyle } from "../money";
import type { DefaultDepositKind } from "./deposit";

/**
 * "Your usual" (docs/plans/quote-form-feedback.md): what a new quote starts with, saved once for the business. On a
 * quote the maker can change any of it for that quote only, and save what is on the quote as the new usual.
 */
export type QuoteUsuals = {
  description: string;
  signOff: string;
  paymentInstructions: string;
  depositKind: DefaultDepositKind;
  /** The deposit as typed ("50", "1 250,00"); empty for "none" and "ask". */
  depositValue: string;
};

export function usualsFromProfile(
  profile: {
    defaultDescription: string | null;
    defaultSignOff: string | null;
    paymentInstructions: string | null;
    defaultDepositKind: DefaultDepositKind;
    defaultDepositValue: number;
  },
  style: NumberStyle,
): QuoteUsuals {
  return {
    description: profile.defaultDescription ?? "",
    signOff: profile.defaultSignOff ?? "",
    paymentInstructions: profile.paymentInstructions ?? "",
    depositKind: profile.defaultDepositKind,
    depositValue:
      profile.defaultDepositKind === "percent"
        ? percentToInput(profile.defaultDepositValue, style)
        : profile.defaultDepositKind === "fixed"
          ? moneyToInput(profile.defaultDepositValue, style)
          : "",
  };
}

/** Is what is on the quote different from the usual, and worth offering to save? Blank text is never offered. */
export const canSaveUsualText = (value: string, usual: string): boolean => value.trim() !== "" && value.trim() !== usual.trim();

/** Is there a usual to go back to that differs from what is on the quote? */
export const canUseUsualText = (value: string, usual: string): boolean => usual.trim() !== "" && value.trim() !== usual.trim();
