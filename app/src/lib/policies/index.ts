import { optionalMultiline, optionalText } from "../form-values";
import { isPolicyKind, type PolicyKind } from "./kinds";

export * from "./kinds";

/**
 * Policies: reusable wording a maker keeps once under the five headings and ticks onto quotes.
 * See docs/plans/quote-policies.md. The library is `policies`; a quote keeps its own copy of each
 * policy it includes, so changing the library never changes a quote that exists.
 */

export const POLICY_TITLE_MAX = 80;
export const POLICY_BODY_MAX = 2000;
export const POLICY_BODY_MAX_LINES = 40;
/** At most this many policies on one quote (a document has only so much room). */
export const QUOTE_MAX_POLICIES = 12;

/** A policy in the library. */
export type PolicySummary = {
  id: string;
  /** The business it belongs to; screens keep only the current business's (see lib/scope.ts). */
  organisationId: string;
  kind: PolicyKind;
  title: string;
  body: string;
  /** Ticked on every new quote. */
  includeByDefault: boolean;
  sortOrder: number;
  archived: boolean;
};

/** What the policy form holds while it is filled in. */
export type PolicyFormValues = {
  kind: PolicyKind;
  title: string;
  body: string;
  includeByDefault: boolean;
};

export type PolicyFieldErrors = Partial<Record<"kind" | "title" | "body", string>>;

export type ParsedPolicy =
  | { ok: true; value: PolicyFormValues }
  | { ok: false; errors: PolicyFieldErrors };

/** Checks a policy's heading, title and wording, saying how to fix what is wrong. */
export function parsePolicy(values: PolicyFormValues): ParsedPolicy {
  const errors: PolicyFieldErrors = {};
  if (!isPolicyKind(values.kind)) errors.kind = "Choose which heading this policy goes under.";

  const title = optionalText(values.title, POLICY_TITLE_MAX, "The title");
  if (!title.ok) errors.title = title.error;
  else if (title.value === null) errors.title = "Give the policy a title, like “If you cancel”.";

  const body = optionalMultiline(values.body, POLICY_BODY_MAX, "The wording", POLICY_BODY_MAX_LINES);
  if (!body.ok) errors.body = body.error;
  else if (body.value === null) errors.body = "Write what the policy says, or tap a starter to begin.";

  if (Object.keys(errors).length > 0 || !title.ok || !body.ok || title.value === null || body.value === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      kind: values.kind,
      title: title.value,
      body: body.value,
      includeByDefault: values.includeByDefault === true,
    },
  };
}

/** A quote's own copy of a policy, as the quote form holds it. */
export type QuotePolicyValues = {
  /** Identifies it on screen while editing. */
  key: string;
  /** The library policy it was copied from, or "" if that is gone or unknown. */
  policyId: string;
  kind: PolicyKind;
  title: string;
  body: string;
};

/** A copy of a library policy for a quote. */
export function copyForQuote(policy: PolicySummary, key: string): QuotePolicyValues {
  return { key, policyId: policy.id, kind: policy.kind, title: policy.title, body: policy.body };
}

/** The policies a new quote starts with: those marked "include on new quotes", in order. */
export function defaultQuotePolicies(library: readonly PolicySummary[]): QuotePolicyValues[] {
  return sortPolicies(library.filter((p) => !p.archived && p.includeByDefault))
    .slice(0, QUOTE_MAX_POLICIES)
    .map((p, i) => copyForQuote(p, `d-${i}`));
}

/** Library order: by heading, then the maker's order, then name. */
export function sortPolicies<T extends { kind: PolicyKind; sortOrder?: number; title: string }>(list: readonly T[]): T[] {
  const rank = (k: PolicyKind) => ["changes", "cancellation", "variations", "client_responsibilities", "liability_aftercare"].indexOf(k);
  return [...list].sort(
    (a, b) => rank(a.kind) - rank(b.kind) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title),
  );
}

export type QuotePolicyError = { title?: string; body?: string };

/** Checks each policy on a quote; errors are by the policy's key. */
export function parseQuotePolicies(
  values: readonly QuotePolicyValues[],
):
  | { ok: true; policies: { policyId: string | null; kind: PolicyKind; title: string; body: string }[] }
  | { ok: false; error: string; byKey: Record<string, QuotePolicyError> } {
  const byKey: Record<string, QuotePolicyError> = {};
  const policies: { policyId: string | null; kind: PolicyKind; title: string; body: string }[] = [];
  if (values.length > QUOTE_MAX_POLICIES) {
    return { ok: false, error: `A quote can have up to ${QUOTE_MAX_POLICIES} policies.`, byKey };
  }
  for (const v of values) {
    const r = parsePolicy({ kind: v.kind, title: v.title, body: v.body, includeByDefault: false });
    if (!r.ok) {
      byKey[v.key] = { title: r.errors.title, body: r.errors.body };
      continue;
    }
    policies.push({
      policyId: /^[0-9a-f-]{36}$/i.test(v.policyId) ? v.policyId : null,
      kind: r.value.kind,
      title: r.value.title,
      body: r.value.body,
    });
  }
  if (Object.keys(byKey).length > 0) {
    return { ok: false, error: "One of the policies on this quote needs fixing.", byKey };
  }
  return { ok: true, policies };
}
