import { moneyToInput, percentToInput, type NumberStyle } from "../money";
import { depositColumns, parseDeposit, type DefaultDepositKind } from "./deposit";

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

/** The text the way it is stored: the same tidying the server does, so "Kind  regards" and "Kind regards" are the same. */
export const normaliseText = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Is what is on the quote different from the usual, and worth offering to save? Blank text is never offered, and neither
 * is the country's generic starting text while the business has no usual of its own: it is not something they wrote.
 */
export const canSaveUsualText = (value: string, usual: string, start = ""): boolean =>
  normaliseText(value) !== "" &&
  normaliseText(value) !== normaliseText(usual) &&
  !(normaliseText(usual) === "" && normaliseText(value) === normaliseText(start));

/** Is there a usual to go back to that differs from what is on the quote? */
export const canUseUsualText = (value: string, usual: string): boolean => normaliseText(usual) !== "" && normaliseText(value) !== normaliseText(usual);

/** The same deposit, however it was typed ("50" and "50,0")? Compared by what it works out to, not by its text. */
export function sameDeposit(a: { kind: string; value: string }, b: { kind: string; value: string }): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind !== "percent" && a.kind !== "fixed") return true;
  const parse = (d: { kind: string; value: string }) => {
    const parsed = parseDeposit({ depositKind: d.kind as "percent" | "fixed", depositValue: d.value }, "");
    return parsed.ok ? depositColumns(parsed.deposit).deposit_value : null;
  };
  const x = parse(a);
  const y = parse(b);
  return x !== null && y !== null ? x === y : a.value.trim() === b.value.trim();
}
