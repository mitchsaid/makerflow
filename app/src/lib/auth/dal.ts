import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile } from "@/lib/business-profile";
import { businessTypesFromRow } from "@/lib/business-types";
import { bankFromRow, type BankDetails, type BankRow } from "@/lib/bank";
import { DEFAULT_COUNTRY_CODE, getLocalePack } from "@/lib/locale";
import { isDesignKey, normaliseColour, parseDesignOptions } from "@/lib/quotes/designs";

/**
 * Data access layer: who is signed in, and which business they are working in.
 * Every protected page and Server Action goes through here, so the checks live in
 * one place. It is deliberately cheap: the page's data is ONE query, with the
 * session check running at the same time as it (not before it), because every
 * extra serial round trip to Supabase is felt on each click.
 */

export type SessionUser = { id: string; email: string | null };
export type Organisation = { id: string; name: string };

export type Workspace = {
  user: SessionUser;
  organisation: Organisation;
  /** "owner", "admin" or "staff" */
  role: string;
  profile: BusinessProfile;
  /** The business's bank details (one account), or null when none are saved. Everyone in the business can read them. */
  bankDetails: BankDetails | null;
  /** Friendly prompts this person has dismissed in this business (their own only). */
  dismissedPrompts: string[];
};

/**
 * The user according to the token alone: signature and expiry are checked locally
 * (no network call). A token outlives the session behind it by up to an hour, so this
 * is never enough on its own to allow access: pair it with sessionIsActive().
 */
const getTokenUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/**
 * Does the session behind this token still exist? Asks the database
 * (session_is_active, see migration 20261001090000). This is what makes signing out on
 * one device lock every other device on its next request, and what stops removed
 * accounts, rather than waiting for the token to expire.
 */
const sessionIsActive = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("session_is_active");
  return !error && data === true;
});

/** The signed-in user, or null. The session is confirmed with the database. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const [user, active] = await Promise.all([getTokenUser(), sessionIsActive()]);
  return user && active ? user : null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

type ProfileRow = {
  country_code: string;
  currency_code: string;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  prices_include_vat: boolean;
  business_types: string[] | null;
  default_deposit_kind: "none" | "percent" | "fixed";
  default_deposit_value: number | string;
  default_sign_off: string | null;
  default_terms: string | null;
  payment_instructions: string | null;
  logo_image_id: string | null;
  brand_color: string | null;
  default_design: string | null;
  default_design_options: unknown;
};
type OrganisationRow = {
  id: string;
  name: string;
  business_profiles: ProfileRow | ProfileRow[] | null;
  business_bank_details: BankRow | BankRow[] | null;
  prompt_dismissals: { prompt_key: string }[] | null;
};
type MembershipRow = { role: string; organisations: OrganisationRow | OrganisationRow[] | null };

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/**
 * The user's business, their role in it and its profile,
 * fetched in a single query. Null if they have not finished onboarding.
 * Row-level security limits every part of this to what the user may see.
 */
export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  const tokenUser = await getTokenUser();
  if (!tokenUser) return null;

  const supabase = await createClient();
  const membershipQuery = supabase
    .from("memberships")
    .select(
      `role,
       organisations (
         id, name,
         business_profiles (
           country_code, currency_code,
           phone, email, address_line1, address_line2, city, region, postal_code,
           vat_registered, vat_number, prices_include_vat,
           default_sign_off, default_terms, payment_instructions, business_types,
           default_deposit_kind, default_deposit_value, logo_image_id,
           brand_color, default_design, default_design_options
         ),
         business_bank_details (
           country_code, details, use_reference, updated_at
         ),
         prompt_dismissals ( prompt_key )
       )`,
    )
    .eq("user_id", tokenUser.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // The session check and the data query run side by side; the data is only
  // used if the session is confirmed. (session_is_active also requires the
  // session to belong to the token's user.)
  const [active, { data, error }] = await Promise.all([sessionIsActive(), membershipQuery]);
  if (!active) return null;
  const user = tokenUser;

  if (error) throw new Error(`Could not load workspace: ${error.message}`);
  const membership = data as unknown as MembershipRow | null;
  const org = one(membership?.organisations);
  if (!membership || !org) return null;

  const p = one(org.business_profiles);
  const countryCode = p?.country_code ?? DEFAULT_COUNTRY_CODE;
  return {
    user,
    organisation: { id: org.id, name: org.name },
    role: membership.role,
    profile: {
      countryCode,
      currencyCode: p?.currency_code ?? getLocalePack(DEFAULT_COUNTRY_CODE).currencyCode,
      phone: p?.phone ?? null,
      email: p?.email ?? null,
      addressLine1: p?.address_line1 ?? null,
      addressLine2: p?.address_line2 ?? null,
      city: p?.city ?? null,
      region: p?.region ?? null,
      postalCode: p?.postal_code ?? null,
      vatRegistered: p?.vat_registered ?? false,
      vatNumber: p?.vat_number ?? null,
      pricesIncludeVat: p?.prices_include_vat ?? true,
      businessTypes: businessTypesFromRow(p?.business_types),
      defaultDepositKind: p?.default_deposit_kind ?? "none",
      defaultDepositValue: Number(p?.default_deposit_value ?? 0),
      defaultSignOff: p?.default_sign_off ?? null,
      defaultTerms: p?.default_terms ?? null,
      paymentInstructions: p?.payment_instructions ?? null,
      logoImageId: p?.logo_image_id ?? null,
      brandColor: normaliseColour(p?.brand_color),
      defaultDesign: isDesignKey(p?.default_design) ? p.default_design : null,
      defaultDesignOptions: parseDesignOptions(p?.default_design_options),
    },
    bankDetails: bankFromRow(one(org.business_bank_details), getLocalePack(countryCode)),
    dismissedPrompts: (org.prompt_dismissals ?? []).map((d) => d.prompt_key),
  };
});

/** Signed in AND onboarded. Otherwise redirects to the right place. */
export async function requireOrganisation(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) {
    await requireUser(); // cached: redirects to sign-in if the session is gone
    redirect("/onboarding");
  }
  return workspace;
}
