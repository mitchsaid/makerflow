"use server";

import { revalidatePath } from "next/cache";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { parsePolicy, type PolicyFieldErrors, type PolicyFormValues, type PolicySummary } from "@/lib/policies";
import { createClient } from "@/lib/supabase/server";

export type PolicySaveState =
  | { status: "saved"; policy: PolicySummary }
  | { status: "error"; message?: string; errors?: PolicyFieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong saving that. Please try again.";
const NOT_ALLOWED = "Only owners and admins can change the business's policies. Ask one of them.";

function isValues(v: unknown): v is PolicyFormValues {
  const x = v as Record<string, unknown> | null;
  return (
    !!x &&
    typeof x.kind === "string" &&
    typeof x.title === "string" &&
    typeof x.body === "string" &&
    typeof x.includeByDefault === "boolean"
  );
}

/**
 * Adds a policy (id null) or saves changes to one. Owners and admins only (the database checks
 * too). Quotes keep their own copy of a policy, so quotes that exist are not changed.
 */
export async function savePolicy(id: string | null, values: PolicyFormValues): Promise<PolicySaveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  if ((id !== null && !UUID.test(id)) || !isValues(values)) return { status: "error", message: GENERIC_ERROR };

  const parsed = parsePolicy(values);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const v = parsed.value;

  const supabase = await createClient();
  if (id === null) {
    // New policies go to the end of their heading.
    const { data: last } = await supabase
      .from("policies")
      .select("sort_order")
      .eq("organisation_id", organisation.id)
      .eq("kind", v.kind)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sortOrder = (last?.sort_order ?? -1) + 1;
    const { data, error } = await supabase
      .from("policies")
      .insert({
        organisation_id: organisation.id,
        kind: v.kind,
        title: v.title,
        body: v.body,
        include_by_default: v.includeByDefault,
        sort_order: sortOrder,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("could not add policy:", error?.message);
      return { status: "error", message: GENERIC_ERROR };
    }
    revalidatePath("/app/business/policies");
    return {
      status: "saved",
      policy: { id: data.id, organisationId: organisation.id, ...v, sortOrder, archived: false },
    };
  }

  const { data, error } = await supabase
    .from("policies")
    .update({ kind: v.kind, title: v.title, body: v.body, include_by_default: v.includeByDefault })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id, sort_order, archived_at");
  if (error || !data || data.length !== 1) {
    console.error("could not save policy:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/business/policies");
  return {
    status: "saved",
    policy: {
      id,
      organisationId: organisation.id,
      ...v,
      sortOrder: data[0].sort_order,
      archived: data[0].archived_at !== null,
    },
  };
}

export type PolicyArchiveState = { status: "ok" } | { status: "error"; message: string };

/** Archives or restores a policy. Policies are never deleted. */
export async function setPolicyArchived(id: string, archived: boolean): Promise<PolicyArchiveState> {
  const { organisation, role } = await requireOrganisation();
  if (!canEditBusinessProfile(role)) return { status: "error", message: NOT_ALLOWED };
  if (!UUID.test(id)) return { status: "error", message: GENERIC_ERROR };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policies")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("organisation_id", organisation.id)
    .select("id");
  if (error || !data || data.length !== 1) {
    console.error("could not archive policy:", error?.message);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidatePath("/app/business/policies");
  return { status: "ok" };
}
