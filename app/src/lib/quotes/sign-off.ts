/**
 * Who signs a quote (docs/plans/quote-sign-off-name.md): the business name, the owner's name, another name the maker
 * types (a studio name, "The Nkosi family"), or no name. The choice is
 * a usual (Quote settings) and each quote's own; the name it gives is frozen in the sent version's snapshot.
 */

export type SignOffAs = "business" | "owner" | "other" | "none";

export const SIGN_OFF_CHOICES: readonly SignOffAs[] = ["business", "owner", "other", "none"];

export const OWNER_NAME_MAX = 120;

export function isSignOffAs(value: unknown): value is SignOffAs {
  return value === "business" || value === "owner" || value === "other" || value === "none";
}

/** The words for each choice, with the name it gives where there is one ("The owner's name (Thandi Nkosi)"). */
export function signOffChoiceLabels(businessName: string, ownerName: string | null): Record<SignOffAs, string> {
  return {
    business: `The business name (${businessName})`,
    owner: ownerName ? `The owner's name (${ownerName})` : "The owner's name",
    other: "Another name",
    none: "No name",
  };
}

/** The name the quote is signed with: the business's, the owner's (null when none is saved), the one typed, or none. */
export function signOffNameFor(choice: SignOffAs, businessName: string, ownerName: string | null, otherName: string | null = null): string | null {
  if (choice === "business") return businessName;
  if (choice === "owner") return ownerName;
  if (choice === "other") return otherName;
  return null;
}

export const SIGN_OFF_OTHER_MAX = 120;

/** The name typed for "Another name": required with that choice, tidied; dropped with any other choice. */
export function parseSignOffOther(choice: SignOffAs, input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (choice !== "other") return { ok: true, value: null };
  const value = typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";
  if (value === "") return { ok: false, error: "Enter the name to sign with, or choose another option." };
  if (value.length > SIGN_OFF_OTHER_MAX) return { ok: false, error: `Keep the name to ${SIGN_OFF_OTHER_MAX} characters or fewer.` };
  return { ok: true, value };
}

/** The owner's name was chosen but none is saved: what to tell the maker, where the choice is made and before sending. */
export const NO_OWNER_NAME = "No owner's name is saved yet. Add it in the Business profile, or choose another name.";

/**
 * What the end of the document prints: the sign-off message, then the name. A snapshot from before the choice existed
 * (no `signOffName`) prints the business name, as it always did. The business name needs a message to print (it is
 * already at the top); any other name prints on its own too, as a signature.
 */
export function signOffBlock(s: { signOff?: string | null; signOffName?: string | null; business: { name: string } }): {
  message: string | null;
  name: string | null;
} | null {
  const name = s.signOffName === undefined ? s.business.name : s.signOffName;
  const message = s.signOff || null;
  if (!message && (!name || name === s.business.name)) return null;
  return { message, name };
}

/** Tidies a typed owner's name: trimmed, spaces collapsed, empty is none. */
export function parseOwnerName(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: false, error: "Enter the owner's name, or leave it empty." };
  const value = input.trim().replace(/\s+/g, " ");
  if (value === "") return { ok: true, value: null };
  if (value.length > OWNER_NAME_MAX) return { ok: false, error: `Keep the owner's name to ${OWNER_NAME_MAX} characters or fewer.` };
  return { ok: true, value };
}
