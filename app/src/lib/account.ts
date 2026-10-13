/**
 * Deleting an account (docs/plans/delete-account.md): the person confirms by typing their own email address. It is
 * compared ignoring case and spaces at the ends, on the screen and again on the server.
 */

export const CONFIRM_EMAIL_MISSING = "Type your email address to confirm.";
export const CONFIRM_EMAIL_WRONG = "That is not your email address. Type it exactly as shown above the box.";

/** Does what was typed match the account's email? */
export const confirmationMatches = (typed: unknown, email: string | null | undefined): boolean =>
  typeof typed === "string" && !!email && typed.trim().toLowerCase() === email.trim().toLowerCase();

/** What to tell the person about what was typed, or null when it matches. */
export function confirmationProblem(typed: string, email: string | null | undefined): string | null {
  if (typed.trim() === "") return CONFIRM_EMAIL_MISSING;
  return confirmationMatches(typed, email) ? null : CONFIRM_EMAIL_WRONG;
}

/** The files to delete for the pictures of deleted businesses (see pathFor in lib/images). */
export function pictureFiles(
  pictures: unknown,
  pathFor: (organisationId: string, imageId: string, size: "display" | "thumb") => string,
): string[] {
  if (!Array.isArray(pictures)) return [];
  return pictures.flatMap((p) => {
    const o = (p ?? {}) as { organisationId?: unknown; id?: unknown };
    if (typeof o.organisationId !== "string" || typeof o.id !== "string") return [];
    return [pathFor(o.organisationId, o.id, "display"), pathFor(o.organisationId, o.id, "thumb")];
  });
}
