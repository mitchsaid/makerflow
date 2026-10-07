import type { SavedAddress } from "../customers";
import type { Fulfilment } from "./index";

/**
 * The rules for what a quote's delivery address should be when the person changes something around it.
 * One principle: an address that came from a customer's own saved ones follows that customer, and an
 * address typed for this quote is never replaced. Pure, so each rule is tested on its own.
 */

const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

/** Is this the same address, ignoring spaces and line breaks? */
export const sameAddress = (a: string, b: string) => tidy(a) === tidy(b);

/** Nothing typed, or the address is one of these saved ones. */
function isTheirs(current: string, saved: readonly SavedAddress[]): boolean {
  return tidy(current) === "" || saved.some((a) => sameAddress(a.text, current));
}

/** Choosing Delivery for a customer with an address on file uses it, unless something is already there. */
export function addressWhenFulfilmentChanges(next: Fulfilment, current: string, saved: readonly SavedAddress[]): string {
  return next === "delivery" && tidy(current) === "" && saved.length > 0 ? saved[0].text : current;
}

/**
 * Choosing another customer (or none): an empty address, or the previous customer's own saved one,
 * becomes the new customer's first saved address (or empty). A typed address stays.
 */
export function addressWhenCustomerChanges(
  current: string,
  previous: readonly SavedAddress[],
  next: readonly SavedAddress[],
): string {
  return isTheirs(current, previous) ? (next[0]?.text ?? "") : current;
}

/**
 * The customer's saved addresses were edited while they are chosen: an address that was one of their
 * saved ones becomes the edited version of the same kind (or their first, or empty if they have none now).
 */
export function addressWhenSavedAddressesChange(
  current: string,
  before: readonly SavedAddress[],
  after: readonly SavedAddress[],
): string {
  const was = before.find((a) => sameAddress(a.text, current));
  if (!was) return current;
  return (after.find((a) => a.kind === was.kind) ?? after[0])?.text ?? "";
}
