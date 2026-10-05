import { missingForQuote } from "../business-profile";
import type { ContactFacts, LocalePack } from "../locale";

/**
 * What stops a draft being sent, in plain words. The send sheet lists these (the error
 * standard: say what is wrong and how to fix it) and the server checks them again before it
 * sends, so a hand-built request cannot skip them.
 */

export type SendProblemCode = "customer" | "items" | "contact" | "validity";

export type SendProblem = {
  code: SendProblemCode;
  /** What is wrong and how to fix it. */
  message: string;
};

export function sendProblems(input: {
  hasCustomer: boolean;
  itemCount: number;
  validUntil: string;
  /** Today in the business's time zone, as YYYY-MM-DD. */
  today: string;
  /** The business's contact details (phone, email and address). */
  profile: ContactFacts;
  locale: LocalePack;
}): SendProblem[] {
  const problems: SendProblem[] = [];
  if (!input.hasCustomer) {
    problems.push({ code: "customer", message: "Choose who the quote is for." });
  }
  if (input.itemCount === 0) {
    problems.push({ code: "items", message: "Add at least one item to the quote." });
  }
  if (input.validUntil < input.today) {
    problems.push({
      code: "validity",
      message: "The valid-until date has already passed. Choose a new date so the quote is still valid.",
    });
  }
  if (missingForQuote(input.profile, input.locale).length > 0) {
    problems.push({
      code: "contact",
      message: "Add a phone number or email, so your customer can get hold of you about this quote.",
    });
  }
  return problems;
}
