import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BusinessProfile } from "@/lib/business-profile";
import { businessTypesFromRow } from "@/lib/business-types";
import { bankFromRow, type BankDetails, type BankRow } from "@/lib/bank";
import { paymentMethodFromRow, sortPaymentMethods, type PaymentMethod, type PaymentMethodRow } from "@/lib/payments";
import { DEFAULT_COUNTRY_CODE, getLocalePack } from "@/lib/locale";
import { isSignOffAs } from "@/lib/quotes/sign-off";

/**
 * Data access layer: who is signed in, and which business they are working in.
 * Every protected page and Server Action goes through here, so the checks live in
 * one place. It is deliberately cheap: the page's data is ONE query, with the
 * session check running at the same time as it (not before it), because every
 * extra serial round trip to Supabase is felt on each click.
 */

export type SessionUser = { id: string; email: string | null };
import { isDemoKind, type DemoKind } from "@/lib/demo";

export type Organisation = {
  id: string;
  name: string;
  /** When the business was made (ISO), so "new here" prompts can be limited to the first days. */
  createdAt: string;
};

export type Workspace = {
  user: SessionUser;
  organisation: Organisation;
  /** "owner", "admin" or "staff" */
  role: string;
  profile: BusinessProfile;
  /** The business's bank details (one account), or null when none are saved. Everyone in the business can read them. */
  bankDetails: BankDetails | null;
  /** The ways to pay besides the bank account, oldest first. Everyone in the business can read them. */
  paymentMethods: PaymentMethod[];
  /** Friendly prompts this person has dismissed in this business (their own only). */
  dismissedPrompts: string[];
  /** Set when this business is a visitor's temporary demo (docs/plans/demo-accounts.md): which sample business, and when it is thrown away. */
  demo: { kind: DemoKind; expiresAt: string } | null;
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
  labour_rate_cents: number | string | null;
  target_margin_bp: number | null;
  business_types: string[] | null;
  default_deposit_kind: "none" | "percent" | "fixed" | "ask";
  default_deposit_value: number | string;
  default_discount_kind: "none" | "percent" | "fixed";
  default_discount_value: number | string;
  usual_fulfilment: "collection" | "delivery" | null;
  default_sign_off: string | null;
  owner_name: string | null;
  sign_off_as: string;
  sign_off_other: string | null;
  default_description: string | null;
  payment_instructions: string | null;
  logo_image_id: string | null;
};
type OrganisationRow = {
  id: string;
  name: string;
  created_at: string;
  demo_kind: string | null;
  demo_expires_at: string | null;
  business_profiles: ProfileRow | ProfileRow[] | null;
  business_bank_details: BankRow | BankRow[] | null;
  payment_methods: PaymentMethodRow[] | null;
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
         id, name, created_at, demo_kind, demo_expires_at,
         business_profiles (
           country_code, currency_code,
           phone, email, address_line1, address_line2, city, region, postal_code,
           vat_registered, vat_number, prices_include_vat,
           default_sign_off, default_description, payment_instructions, business_types, owner_name, sign_off_as, sign_off_other,
           default_deposit_kind, default_deposit_value, default_discount_kind, default_discount_value, usual_fulfilment, logo_image_id, labour_rate_cents, target_margin_bp
         ),
         business_bank_details (
           country_code, details, use_reference, updated_at
         ),
         payment_methods (
           id, kind, name, details, image_id, on_new_quotes, sort_order, created_at, updated_at
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
    organisation: { id: org.id, name: org.name, createdAt: org.created_at },
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
      defaultDiscountKind: p?.default_discount_kind ?? "none",
      defaultDiscountValue: Number(p?.default_discount_value ?? 0),
      usualFulfilment: p?.usual_fulfilment ?? null,
      defaultSignOff: p?.default_sign_off ?? null,
      ownerName: p?.owner_name ?? null,
      signOffAs: isSignOffAs(p?.sign_off_as) ? p.sign_off_as : "business",
      signOffOther: p?.sign_off_other ?? null,
      defaultDescription: p?.default_description ?? null,
      paymentInstructions: p?.payment_instructions ?? null,
      logoImageId: p?.logo_image_id ?? null,
      labourRateCents: p?.labour_rate_cents == null ? null : Number(p.labour_rate_cents),
      targetMarginBp: p?.target_margin_bp == null ? null : Number(p.target_margin_bp),
    },
    bankDetails: bankFromRow(one(org.business_bank_details), getLocalePack(countryCode)),
    paymentMethods: sortPaymentMethods(
      (org.payment_methods ?? []).flatMap((row) => {
        const method = paymentMethodFromRow(row, getLocalePack(countryCode));
        return method ? [method] : [];
      }),
    ),
    dismissedPrompts: (org.prompt_dismissals ?? []).map((d) => d.prompt_key),
    demo: isDemoKind(org.demo_kind) && org.demo_expires_at ? { kind: org.demo_kind, expiresAt: org.demo_expires_at } : null,
  };
});

/** Signed in AND onboarded. Otherwise redirects to the right place. */
export async function requireOrganisation(): Promise<Workspace> {
  const workspace = await getWorkspace();
  if (!workspace) {
    await requireUser(); // cached: redirects to sign-in if the session is gone
    redirect("/onboarding");
  }
  // A demo that has run out is over, whether or not the clean-up has reached it yet.
  if (workspace.demo && Date.parse(workspace.demo.expiresAt) <= Date.now()) redirect("/demo/ended");
  return workspace;
}
