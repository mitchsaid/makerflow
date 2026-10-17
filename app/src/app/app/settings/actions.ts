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
const NOT_SET_UP = "Deleting an account isn't switched on for this version of MakerFlow, so nothing was deleted.";
const SIGN_IN_LEFT_BUSINESSES_GONE =
  "Your businesses were deleted, but we couldn't remove your sign-in. Press Delete again to finish.";
const SIGN_IN_LEFT_NOTHING_DELETED = "We couldn't remove your sign-in, so your account is still here. Press Delete again to try once more.";

/** Anything left under a deleted business's folder in storage (a picture the list did not know about). */
async function sweepFolders(admin: ReturnType<typeof createAdminClient>, organisationIds: string[]) {
  for (const org of organisationIds) {
    try {
      const bucket = admin.storage.from(BUCKET);
      const { data: folders } = await bucket.list(org, { limit: 1000 });
      for (const folder of folders ?? []) {
        const { data: files } = await bucket.list(`${org}/${folder.name}`, { limit: 100 });
        const paths = (files ?? []).map((f) => `${org}/${folder.name}/${f.name}`);
        if (paths.length > 0) await bucket.remove(paths);
      }
    } catch (error) {
      console.error("could not sweep the picture folder of a deleted business:", (error as Error).message);
    }
  }
}

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
  if (error?.code === "55007") {
    const business = error.details ? `${error.details}, which has` : "a business that has";
    return {
      status: "error",
      message: `You are on your own in ${business} issued invoices, and those must be kept. Add someone else to the business first, or write to us. Nothing was deleted.`,
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
  // Belt and braces: anything still under those businesses' folders (the database list is the main route).
  const organisations = (data as { organisations?: unknown } | null)?.organisations;
  const deletedOrganisations = Array.isArray(organisations) ? organisations.filter((o): o is string => typeof o === "string") : [];
  await sweepFolders(admin, deletedOrganisations);

  // 3. The sign-in itself (this also removes their membership, profile and "Not now" records).
  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  // Pressing Delete again after a half-finished attempt must still work: "user not found" means it is already done.
  if (authError && !/not.?found/i.test(`${authError.code ?? ""} ${authError.message}`)) {
    console.error("could not delete the sign-in:", authError.message);
    return {
      status: "error",
      message: deletedOrganisations.length > 0 ? SIGN_IN_LEFT_BUSINESSES_GONE : SIGN_IN_LEFT_NOTHING_DELETED,
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
