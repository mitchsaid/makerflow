"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { confirmationProblem, pictureFiles } from "@/lib/account";
import { BUCKET, pathFor } from "@/lib/images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Deleting the signed-in person's account (docs/plans/delete-account.md). The person comes from the session, never
 * from what the browser sent, and must have typed their own email address. The database function can be called by
 * the server's own key and nobody else (migration 20261101100000_delete_account.sql).
 */

export type DeleteAccountState =
  | { status: "idle" }
  | { status: "error"; /** About the typed address, shown at the field. */ field?: string; /** Anything else. */ message?: string };

const GENERIC_ERROR = "Something went wrong, so nothing was deleted. Please try again.";
const NOT_SET_UP = "This version of MakerFlow can't do that yet, so nothing was deleted. We've been told.";

export async function deleteAccount(typedEmail: string): Promise<DeleteAccountState> {
  const user = await requireUser();

  const problem = confirmationProblem(typeof typedEmail === "string" ? typedEmail : "", user.email);
  if (problem) return { status: "error", field: problem };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("the server key for deleting accounts is missing:", (error as Error).message);
    return { status: "error", message: NOT_SET_UP };
  }

  // 1. The database, in one transaction: the businesses this person is alone in, with everything in them.
  const { data, error } = await admin.rpc("delete_account", { p_user: user.id });
  if (error?.code === "55006") {
    const business = error.details ? `${error.details} (a business that has other people in it)` : "a business that has other people in it";
    return {
      status: "error",
      message: `You are the only owner of ${business}, so it would be left with nobody in charge. Make someone else an owner first. Nothing was deleted.`,
    };
  }
  if (error) {
    console.error("could not delete the account:", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  // 2. The pictures of the deleted businesses: the files live in storage, which the database delete does not reach.
  const files = pictureFiles((data as { pictures?: unknown } | null)?.pictures, pathFor);
  for (let i = 0; i < files.length; i += 100) {
    const { error: storageError } = await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
    // The database is already clean, and the person cannot do anything about leftover files: say so in the log.
    if (storageError) console.error("could not delete picture files of a deleted account:", storageError.message);
  }

  // 3. The sign-in itself (this also removes their membership, profile and "Not now" records).
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error("could not delete the sign-in:", authError.message);
    return {
      status: "error",
      message:
        "Your businesses were deleted, but we couldn't remove your sign-in. Sign in again to start fresh, then delete your account again.",
    };
  }

  // Their cookies are no use now; clear them (the session is already gone, so a failure here changes nothing).
  try {
    await (await createClient()).auth.signOut();
  } catch {
    // nothing to do
  }
  redirect("/sign-in?account=deleted");
}
