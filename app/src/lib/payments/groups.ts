import type { BankLine } from "../bank";
import type { QuoteSnapshot } from "../quotes/snapshot";

/** One part of the "How to pay" block as printed: an optional heading over its rows. */
export type HowToPayGroup = {
  name: string | null;
  lines: BankLine[];
  /** The bank account (printed in columns when long). */
  bank: boolean;
  /** The QR code picture to print under the rows, if the way has one. */
  imageId: string | null;
};

/**
 * What a document prints under "How to pay": the bank account first, then each other way in the order the maker keeps
 * them. The account gets a heading ("EFT") only when other ways are shown with it, so a document that shows only the
 * account reads as it always did. Empty when the document shows no way to pay.
 */
export function howToPayGroups(
  s: Pick<QuoteSnapshot, "bankDetails" | "paymentMethods" | "wording">,
): HowToPayGroup[] {
  const ways = s.paymentMethods ?? [];
  const groups: HowToPayGroup[] = [];
  if (s.bankDetails && s.bankDetails.length > 0) {
    groups.push({
      name: ways.length > 0 ? (s.wording.bankTransferName ?? null) : null,
      lines: s.bankDetails,
      bank: true,
      imageId: null,
    });
  }
  for (const way of ways)
    groups.push({ name: way.name, lines: way.lines, bank: false, imageId: way.imageId ?? null });
  return groups;
}
