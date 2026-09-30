import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile, PromptKey } from "@/lib/business-profile";

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

/** The signed-in user's role in the organisation ("owner", "admin", "staff"), or null. */
export const getMyRole = cache(async (organisationId: string): Promise<string | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("organisation_id", organisationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load role: ${error.message}`);
  return data?.role ?? null;
});

/** The business profile (contact details, address, VAT status) for an organisation. */
export const getBusinessProfile = cache(
  async (organisationId: string): Promise<BusinessProfile> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_profiles")
      .select(
        "phone, email, address_line1, address_line2, city, region, postal_code, vat_registered, vat_number",
      )
      .eq("organisation_id", organisationId)
      .maybeSingle();

    if (error) throw new Error(`Could not load business profile: ${error.message}`);
    // A profile row is created with every organisation; fall back to empty just in case.
    return {
      phone: data?.phone ?? null,
      email: data?.email ?? null,
      addressLine1: data?.address_line1 ?? null,
      addressLine2: data?.address_line2 ?? null,
      city: data?.city ?? null,
      region: data?.region ?? null,
      postalCode: data?.postal_code ?? null,
      vatRegistered: data?.vat_registered ?? false,
      vatNumber: data?.vat_number ?? null,
    };
  },
);

/** Has this user dismissed the given friendly prompt in this organisation? */
export async function isPromptDismissed(
  organisationId: string,
  key: PromptKey,
): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prompt_dismissals")
    .select("prompt_key")
    .eq("organisation_id", organisationId)
    .eq("user_id", user.id)
    .eq("prompt_key", key)
    .maybeSingle();

  if (error) throw new Error(`Could not load prompt state: ${error.message}`);
  return data !== null;
}
