import { optionalMultiline, optionalText } from "../form-values";
export * from "./examples";

/**
 * Terms: reusable wording a maker keeps once, with an optional title, and ticks onto quotes, plus
 * terms written just for one quote. On screen they are "Terms"; in the code and the database they
 * keep their older name, policies. See docs/plans/terms.md (and quote-policies.md before it). The
 * library is `policies`; a quote keeps its own copy of each term it includes, so changing the
 * library never changes a quote that exists.
 */

export const POLICY_TITLE_MAX = 80;
export const POLICY_BODY_MAX = 4000;
export const POLICY_BODY_MAX_LINES = 80;
/** At most this many terms on one quote (a document has only so much room). */
export const QUOTE_MAX_POLICIES = 20;

/** A term in the library. */
export type PolicySummary = {
  id: string;
  /** The business it belongs to; screens keep only the current business's (see lib/scope.ts). */
  organisationId: string;
  /** Null when the term has no title: it is printed as a plain paragraph. */
  title: string | null;
  body: string;
  /** Ticked on every new quote. */
  includeByDefault: boolean;
  sortOrder: number;
  archived: boolean;
};

/** What the term form holds while it is filled in ("" for no title). */
export type PolicyFormValues = {
  title: string;
  body: string;
  includeByDefault: boolean;
};

export type PolicyFieldErrors = Partial<Record<"title" | "body", string>>;

export type ParsedPolicy =
  | { ok: true; value: { title: string | null; body: string; includeByDefault: boolean } }
  | { ok: false; errors: PolicyFieldErrors };

/** Checks a term's title (optional) and wording, saying how to fix what is wrong. */
export function parsePolicy(values: PolicyFormValues): ParsedPolicy {
  const errors: PolicyFieldErrors = {};
  const title = optionalText(values.title, POLICY_TITLE_MAX, "The title");
  if (!title.ok) errors.title = title.error;

  const body = optionalMultiline(values.body, POLICY_BODY_MAX, "The wording", POLICY_BODY_MAX_LINES);
  if (!body.ok) errors.body = body.error;
  else if (body.value === null) errors.body = "Write what the term says, or start from an example.";

  if (Object.keys(errors).length > 0 || !title.ok || !body.ok || body.value === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      title: title.value,
      body: body.value,
      includeByDefault: values.includeByDefault === true,
    },
  };
}

/** A quote's own copy of a term, as the quote form holds it. */
export type QuotePolicyValues = {
  /** Identifies it on screen while editing. */
  key: string;
  /** The library term it was copied from, or "" for a term written just for this quote. */
  policyId: string;
  /** "" for no title. */
  title: string;
  body: string;
};

/** A copy of a library term for a quote. */
export function copyForQuote(policy: PolicySummary, key: string): QuotePolicyValues {
  return { key, policyId: policy.id, title: policy.title ?? "", body: policy.body };
}

/** A new, empty term written just for one quote (not saved to the library). */
export function oneOffTerm(key: string): QuotePolicyValues {
  return { key, policyId: "", title: "", body: "" };
}

/**
 * What a term is called on screen: its title, or the start of its wording when it has none
 * ("Please allow 2 weeks to make your…").
 */
export function termName(term: { title: string | null; body: string }, max = 48): string {
  const title = term.title?.trim();
  if (title) return title;
  const firstLine = term.body.trim().split("\n")[0].trim();
  if (firstLine === "") return "A term with no wording yet";
  return firstLine.length > max ? `${firstLine.slice(0, max - 1).trimEnd()}…` : firstLine;
}

/** The policies a new quote starts with: those marked "include on new quotes", in order. */
export function defaultQuotePolicies(library: readonly PolicySummary[]): QuotePolicyValues[] {
  return sortPolicies(library.filter((p) => !p.archived && p.includeByDefault))
    .slice(0, QUOTE_MAX_POLICIES)
    .map((p, i) => copyForQuote(p, `d-${i}`));
}

/** Library order: the maker's order, then name. */
export function sortPolicies<T extends { sortOrder?: number; title: string | null; body: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || termName(a).localeCompare(termName(b)));
}

/**
 * Puts a quote's terms in the library's order (the maker's order), so the document reads the same
 * as the list on screen whatever order they were ticked in. Terms written just for the quote, and
 * copies whose saved term is gone, go last, in the order they have.
 */
export function inLibraryOrder(copies: readonly QuotePolicyValues[], library: readonly PolicySummary[]): QuotePolicyValues[] {
  const order = sortPolicies(library.filter((p) => !p.archived)).map((p) => p.id);
  const rank = (c: QuotePolicyValues) => {
    const i = order.indexOf(c.policyId);
    return i === -1 ? order.length : i;
  };
  return copies
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

export type QuotePolicyError = { title?: string; body?: string };

/** Checks each term on a quote; errors are by the term's key. */
export function parseQuotePolicies(
  values: readonly QuotePolicyValues[],
):
  | { ok: true; policies: { policyId: string | null; title: string | null; body: string }[] }
  | { ok: false; error: string; byKey: Record<string, QuotePolicyError> } {
  const byKey: Record<string, QuotePolicyError> = {};
  const policies: { policyId: string | null; title: string | null; body: string }[] = [];
  if (values.length > QUOTE_MAX_POLICIES) {
    return { ok: false, error: `A quote can have up to ${QUOTE_MAX_POLICIES} terms. Remove one to add another.`, byKey };
  }
  for (const v of values) {
    const r = parsePolicy({ title: v.title, body: v.body, includeByDefault: false });
    if (!r.ok) {
      byKey[v.key] = { title: r.errors.title, body: r.errors.body };
      continue;
    }
    policies.push({
      policyId: /^[0-9a-f-]{36}$/i.test(v.policyId) ? v.policyId : null,
      title: r.value.title,
      body: r.value.body,
    });
  }
  if (Object.keys(byKey).length > 0) {
    return { ok: false, error: "One of the terms on this quote needs fixing.", byKey };
  }
  return { ok: true, policies };
}
