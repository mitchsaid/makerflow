import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "../supabase/server";
import { isPolicyKind, type PolicyKind, type PolicySummary } from "./index";

/**
 * Policy reads. Row-level security limits every query to businesses the signed-in person belongs
 * to; pages keep only the current business's rows (see lib/scope.ts).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  organisation_id: string;
  kind: string;
  title: string;
  body: string;
  include_by_default: boolean;
  sort_order: number;
  archived_at: string | null;
};

const COLUMNS = "id, organisation_id, kind, title, body, include_by_default, sort_order, archived_at";

export function policyFromRow(row: Row): PolicySummary | null {
  if (!isPolicyKind(row.kind)) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    kind: row.kind as PolicyKind,
    title: row.title,
    body: row.body,
    includeByDefault: row.include_by_default,
    sortOrder: row.sort_order,
    archived: row.archived_at !== null,
  };
}

/** Every policy of the business, archived ones included. One query. */
export async function getPolicies(): Promise<PolicySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("policies")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not load policies: ${error.message}`);
  return (data as Row[]).flatMap((row) => {
    const p = policyFromRow(row);
    return p ? [p] : [];
  });
}

/** One policy, or "not found" for a bad id or one this person cannot see. */
export async function getPolicy(id: string): Promise<PolicySummary> {
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("policies").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the policy: ${error.message}`);
  const policy = data ? policyFromRow(data as Row) : null;
  if (!policy) notFound();
  return policy;
}
