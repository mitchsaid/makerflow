import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data access layer for "who is signed in and which business are they in".
 * Every protected page and Server Action goes through these, so the checks
 * live in one place.
 */

/** The signed-in user, verified with Supabase's auth server, or null. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

export type Organisation = { id: string; name: string };

/** The user's business, or null if they have not finished onboarding. */
export const getOrganisation = cache(async (): Promise<Organisation | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  // Row-level security limits this to organisations the user belongs to.
  const { data, error } = await supabase
    .from("organisations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not load organisation: ${error.message}`);
  return data;
});

/** Signed in AND onboarded. Otherwise redirects to the right place. */
export async function requireOrganisation() {
  const user = await requireUser();
  const organisation = await getOrganisation();
  if (!organisation) redirect("/onboarding");
  return { user, organisation };
}
