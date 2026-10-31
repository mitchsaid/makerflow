"use server";

import { redirect } from "next/navigation";
import { getWorkspace, requireOrganisation } from "@/lib/auth/dal";
import { buildDemoBusiness } from "@/lib/demo/build";
import { demoContent } from "@/lib/demo/content";
import { isDemoKind } from "@/lib/demo";
import { purgeExpiredDemos, removeDemoOf } from "@/lib/demo/purge";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Trying MakerFlow without signing up (docs/plans/demo-accounts.md; docs/product-brief.md, 4a). Three steps, each its
 * own request so the browser has the visitor's cookie before the next one starts: `startDemo` signs them in as an
 * anonymous visitor and makes their demo business; `buildDemo` fills it with the sample content as the visitor; and
 * `resetDemo` throws that demo away and starts a fresh one.
 */

export type DemoResult = { status: "ok" } | { status: "error"; message: string };

const BUSY = "The demo is busy right now. Please try again in a few minutes.";
const GENERIC = "Something went wrong starting the demo. Please try again.";

/** Signs in as an anonymous visitor (unless this browser already is one) and makes the demo business of this kind. */
export async function startDemo(kind: string): Promise<DemoResult> {
  if (!isDemoKind(kind)) return { status: "error", message: GENERIC };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const existing = claims?.claims;
  // A real maker who is signed in here does not get a demo beside their account.
  if (existing?.sub && existing.is_anonymous !== true) {
    return { status: "error", message: "You're signed in to MakerFlow already. Sign out first to try the demo." };
  }
  if (!existing?.sub) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("could not start an anonymous visit:", error.code, error.message);
      return { status: "error", message: error.status === 429 ? BUSY : GENERIC };
    }
  }
  const { error } = await supabase.rpc("create_demo_organisation", { p_kind: kind, p_name: demoContent(kind).businessName });
  if (error?.code === "54000") return { status: "error", message: BUSY };
  if (error) {
    console.error("could not make a demo business:", error.code, error.message);
    return { status: "error", message: GENERIC };
  }
  // Tidy up after earlier visitors while we are here, a few at a time. Never in the visitor's way.
  try {
    await purgeExpiredDemos(10);
  } catch (error) {
    console.error("could not tidy up old demos:", (error as Error).message);
  }
  return { status: "ok" };
}

/** Fills the visitor's demo with its sample content. Runs once; a second call finds it done. */
export async function buildDemo(): Promise<DemoResult> {
  const workspace = await getWorkspace();
  if (!workspace?.demo) return { status: "error", message: GENERIC };
  try {
    await buildDemoBusiness(workspace);
  } catch (error) {
    console.error("could not build the demo:", (error as Error).message);
    return { status: "error", message: GENERIC };
  }
  return { status: "ok" };
}

/** Throws this demo away and starts a fresh one of the same kind. Only for a visitor's own demo. */
export async function resetDemo(): Promise<DemoResult> {
  const workspace = await requireOrganisation();
  if (!workspace.demo) return { status: "error", message: GENERIC };
  const kind = workspace.demo.kind;
  const removed = await removeDemoOf(createAdminClient(), workspace.user.id, false);
  if (!removed) return { status: "error", message: GENERIC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_demo_organisation", { p_kind: kind, p_name: demoContent(kind).businessName });
  if (error) {
    console.error("could not remake a demo business:", error.code, error.message);
    return { status: "error", message: error.code === "54000" ? BUSY : GENERIC };
  }
  return { status: "ok" };
}

/** "Start your own": leaves the demo and goes to sign-up. The demo is thrown away with the visitor. */
export async function leaveDemo(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
