import "server-only";
import { BUCKET } from "../images";
import { createAdminClient } from "../supabase/admin";

/**
 * Throws away demos that have run out (docs/plans/demo-accounts.md). Server key only: it reads demo businesses, deletes
 * them with the same `delete_account` the Settings page uses (which refuses a business that has issued invoices: a demo
 * never has one), removes their picture files, and then the anonymous sign-ins that owned them.
 * It only ever touches a business that is flagged as a demo AND past its expiry.
 */

type Admin = ReturnType<typeof createAdminClient>;

/** Anything under a business's folder in storage (its pictures), removed. */
async function sweepFolder(admin: Admin, organisationId: string) {
  try {
    const bucket = admin.storage.from(BUCKET);
    const { data: folders } = await bucket.list(organisationId, { limit: 1000 });
    for (const folder of folders ?? []) {
      const { data: files } = await bucket.list(`${organisationId}/${folder.name}`, { limit: 100 });
      const paths = (files ?? []).map((f) => `${organisationId}/${folder.name}/${f.name}`);
      if (paths.length > 0) await bucket.remove(paths);
    }
  } catch (error) {
    console.error("could not sweep a demo's picture folder:", (error as Error).message);
  }
}

/** Removes one visitor's demo (by their sign-in): the business, its pictures, then the sign-in when `removeSignIn`. */
export async function removeDemoOf(admin: Admin, userId: string, removeSignIn: boolean): Promise<boolean> {
  const { data, error } = await admin.rpc("delete_account", { p_user: userId });
  if (error) {
    console.error("could not delete a demo:", error.code, error.message);
    return false;
  }
  const organisations = (data as { organisations?: unknown } | null)?.organisations;
  for (const org of Array.isArray(organisations) ? organisations : []) if (typeof org === "string") await sweepFolder(admin, org);
  if (removeSignIn) {
    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError && !/not.?found/i.test(`${authError.code ?? ""} ${authError.message}`)) {
      console.error("could not delete a demo's sign-in:", authError.message);
      return false;
    }
  }
  return true;
}

/** Deletes up to `limit` expired demos. Returns how many were removed. */
export async function purgeExpiredDemos(limit = 25): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organisations")
    .select("id, memberships ( user_id )")
    .not("demo_expires_at", "is", null)
    .lt("demo_expires_at", new Date().toISOString())
    .limit(limit);
  if (error) {
    console.error("could not list expired demos:", error.message);
    return 0;
  }
  let removed = 0;
  for (const org of data ?? []) {
    const members = (org.memberships ?? []) as { user_id: string }[];
    // A demo has the one visitor who made it. If it somehow has none, the business is left for a person to look at.
    for (const m of members) if (await removeDemoOf(admin, m.user_id, true)) removed++;
  }
  return removed;
}
