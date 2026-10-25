/**
 * What stops a draft being marked as sent, in plain words. (A phone number or email is not one of them: marking a quote as
 * sent is a record, the maker may have sent it some other way, and no law asks a quote for contact details,
 * docs/locales/za/vat-and-documents.md answer 5. A missing one is mentioned on the confirmation, not made a blocker.) The send sheet lists these (the error
 * standard: say what is wrong and how to fix it) and the server checks them again before it
 * sends, so a hand-built request cannot skip them.
 */

import { NO_OWNER_NAME } from "./sign-off";

export type SendProblemCode = "customer" | "items" | "validity" | "deposit" | "balance-date" | "sign-off";

export type SendProblem = {
  code: SendProblemCode;
  /** What is wrong and how to fix it. */
  message: string;
};

/** What is said when a quote has no customer or no items (on Preview, on the draft, and when sending). */
export const MISSING_CUSTOMER = "Choose who the quote is for.";
export const MISSING_ITEMS = "Add at least one item to the quote.";

export function sendProblems(input: {
  hasCustomer: boolean;
  itemCount: number;
  validUntil: string;
  /** Today in the business's time zone, as YYYY-MM-DD. */
  today: string;
  /** A fixed deposit that is more than the quote total. */
  depositTooBig?: boolean;
  /** A deposit that works out to nothing (a tiny percentage of a small total). */
  depositIsNothing?: boolean;
  /** The date the balance is due, when it is by a date. */
  balanceDueDate?: string | null;
  /** The quote is signed with the owner's name, and none is saved. */
  noOwnerName?: boolean;
}): SendProblem[] {
  const problems: SendProblem[] = [];
  if (!input.hasCustomer) {
    problems.push({ code: "customer", message: MISSING_CUSTOMER });
  }
  if (input.itemCount === 0) {
    problems.push({ code: "items", message: MISSING_ITEMS });
  }
  if (input.validUntil < input.today) {
    problems.push({
      code: "validity",
      message: "The valid-until date has already passed. Choose a new date so the quote is still valid.",
    });
  }
  if (input.depositTooBig) {
    problems.push({
      code: "deposit",
      message: "The deposit is more than the quote total. Lower the deposit, or add what it is for to the quote.",
    });
  }
  if (input.depositIsNothing && !input.depositTooBig) {
    problems.push({ code: "deposit", message: "The deposit works out to nothing. Raise it, or untick it." });
  }
  if (input.balanceDueDate && input.balanceDueDate < input.today) {
    problems.push({ code: "balance-date", message: "The date the balance is due has passed. Choose a new date." });
  }
  if (input.noOwnerName) {
    problems.push({ code: "sign-off", message: NO_OWNER_NAME });
  }
  return problems;
}
