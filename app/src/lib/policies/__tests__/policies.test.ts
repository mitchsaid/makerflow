import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import { parseQuote, toDatabasePayload, type QuoteFormValues } from "../../quotes";
import {
  copyForQuote,
  defaultQuotePolicies,
  inLibraryOrder,
  parsePolicy,
  parseQuotePolicies,
  POLICY_HEADINGS,
  POLICY_KINDS,
  QUOTE_MAX_POLICIES,
  sortPolicies,
  type PolicySummary,
  type QuotePolicyValues,
} from "..";

const policy = (over: Partial<PolicySummary> = {}): PolicySummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  organisationId: "o",
  kind: "cancellation",
  title: "If you cancel",
  body: "You pay the deposit.",
  includeByDefault: true,
  sortOrder: 0,
  archived: false,
  ...over,
});

describe("parsePolicy", () => {
  it("accepts a heading, a title and wording, and tidies them", () => {
    const r = parsePolicy({ kind: "changes", title: "  Re-quote   changes ", body: "Line one.\n\n\n\nLine two.", includeByDefault: true });
    expect(r).toEqual({
      ok: true,
      value: { kind: "changes", title: "Re-quote changes", body: "Line one.\n\nLine two.", includeByDefault: true },
    });
  });

  it("says how to fix what is missing, by field", () => {
    const r = parsePolicy({ kind: "changes", title: "", body: "", includeByDefault: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toMatch(/Give the policy a title/);
      expect(r.errors.body).toMatch(/Write what the policy says/);
    }
    const bad = parsePolicy({ kind: "nonsense" as never, title: "x", body: "y", includeByDefault: false });
    expect(!bad.ok && bad.errors.kind).toMatch(/Choose which heading/);
  });

  it("limits the title, the wording and the lines", () => {
    const r = parsePolicy({
      kind: "changes",
      title: "t".repeat(81),
      body: "b".repeat(2001),
      includeByDefault: false,
    });
    expect(!r.ok && r.errors.title).toMatch(/up to 80 characters/);
    expect(!r.ok && r.errors.body).toMatch(/up to 2000 characters/);
    const lines = Array.from({ length: 41 }, (_, i) => `line ${i}`).join("\n");
    const tall = parsePolicy({ kind: "changes", title: "x", body: lines, includeByDefault: false });
    expect(!tall.ok && tall.errors.body).toMatch(/up to 40 lines/);
  });
});

describe("a quote's own copy of policies", () => {
  it("starts with the policies marked for new quotes, in the heading order, never archived ones", () => {
    const library = [
      policy({ id: "a", kind: "liability_aftercare", title: "Aftercare" }),
      policy({ id: "b", kind: "changes", title: "Changes" }),
      policy({ id: "c", kind: "cancellation", includeByDefault: false, title: "Not by default" }),
      policy({ id: "d", kind: "variations", archived: true, title: "Archived" }),
    ];
    expect(defaultQuotePolicies(library).map((c) => c.title)).toEqual(["Changes", "Aftercare"]);
    expect(defaultQuotePolicies(library)[0]).toMatchObject({ policyId: "b", kind: "changes", body: "You pay the deposit." });
  });

  it("is its own copy: the saved policy can change without it", () => {
    const saved = policy();
    const copy = copyForQuote(saved, "k1");
    saved.body = "Changed later";
    expect(copy.body).toBe("You pay the deposit.");
  });

  it("checks each copy, by its key, and the number on a quote", () => {
    const ok: QuotePolicyValues = { key: "k1", policyId: "", kind: "changes", title: "Changes", body: "Text" };
    expect(parseQuotePolicies([ok])).toEqual({
      ok: true,
      policies: [{ policyId: null, kind: "changes", title: "Changes", body: "Text" }],
    });
    const bad = parseQuotePolicies([ok, { ...ok, key: "k2", body: "" }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.byKey.k2.body).toMatch(/Write what the policy says/);
    const many = parseQuotePolicies(Array.from({ length: QUOTE_MAX_POLICIES + 1 }, (_, i) => ({ ...ok, key: `k${i}` })));
    expect(!many.ok && many.error).toMatch(/up to 12 policies/);
  });

  it("goes from the quote form to the database payload, with where each came from", () => {
    const values: QuoteFormValues = {
      customerId: "",
      issueDate: "2026-10-06",
      validUntil: "2026-10-20",
      neededBy: "",
      lines: [],
      fulfilment: "none",
      deliveryFee: "",
      discountKind: "none",
      discountValue: "",
      notes: "",
      title: "",
      description: "",
      signOff: "",
      terms: "",
      paymentInstructions: "",
      policies: [{ key: "k", policyId: "11111111-1111-4111-8111-111111111111", kind: "cancellation", title: "If you cancel", body: "Edited for this quote" }],
    };
    const parsed = parseQuote(values, { registered: false });
    if (!parsed.ok) throw new Error("should parse");
    const payload = toDatabasePayload(parsed.quote, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.quote.policies).toEqual([
      { policy_id: "11111111-1111-4111-8111-111111111111", kind: "cancellation", title: "If you cancel", body: "Edited for this quote" },
    ]);
    const bad = parseQuote({ ...values, policies: [{ ...values.policies[0], body: "" }] }, { registered: false });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.fields.policies).toBeTruthy();
  });

  it("keeps a quote's policies in the library's order, whatever order they were ticked in", () => {
    const cancel = policy({ id: "a", kind: "cancellation", title: "Cancel" });
    const changes = policy({ id: "b", kind: "changes", title: "Changes" });
    const ticked = [copyForQuote(cancel, "1"), copyForQuote(changes, "2"), { key: "3", policyId: "gone", kind: "variations" as const, title: "Old", body: "x" }];
    expect(inLibraryOrder(ticked, [cancel, changes]).map((c) => c.title)).toEqual(["Changes", "Cancel", "Old"]);
  });

  it("lists the library by heading, then the maker's order", () => {
    const sorted = sortPolicies([
      policy({ kind: "variations", title: "B", sortOrder: 1 }),
      policy({ kind: "changes", title: "Z" }),
      policy({ kind: "variations", title: "A", sortOrder: 0 }),
    ]);
    expect(sorted.map((p) => p.title)).toEqual(["Z", "A", "B"]);
  });
});

describe("the South African starters", () => {
  const za = ZA_LOCALE.policies;

  it("cover every heading, with a good-to-know note and at least one starter each", () => {
    for (const kind of POLICY_KINDS) {
      expect(za.kinds[kind].goodToKnow.length, kind).toBeGreaterThan(40);
      expect(za.kinds[kind].starters.length, kind).toBeGreaterThan(0);
    }
    expect(za.adviceNote).toMatch(/not legal advice/);
  });

  it("are valid policies as they stand, with their blanks marked in square brackets, and unique keys", () => {
    const keys = new Set<string>();
    for (const kind of POLICY_KINDS) {
      for (const s of za.kinds[kind].starters) {
        expect(keys.has(`${kind}/${s.key}`)).toBe(false);
        keys.add(`${kind}/${s.key}`);
        expect(parsePolicy({ kind, title: POLICY_HEADINGS[kind], body: s.text, includeByDefault: false }).ok, s.key).toBe(true);
      }
    }
  });

  it("follow the consumer-law points in docs/locales/za/consumer-policies.md", () => {
    const text = (k: (typeof POLICY_KINDS)[number]) => za.kinds[k].starters.map((s) => s.text).join(" ");
    // A new date is agreed with the customer, never set by the maker alone.
    expect(text("changes")).toMatch(/agree the new price and the new date with you/);
    expect(za.kinds.changes.goodToKnow).toMatch(/shouldn't move unless the customer agrees/);
    // Cancellation has a made-to-order starter and a bookings one with the hospital or death exception.
    expect(za.kinds.cancellation.starters.map((s) => s.key)).toEqual(["made-to-order", "bookings"]);
    expect(text("cancellation")).toMatch(/in hospital, or the person it is for has died/);
    // The deposit counts towards the charge: never the deposit on top of the costs.
    expect(text("cancellation")).toMatch(/deposit of \[amount or %\] counts towards that/);
    // Aftercare adds to legal rights and never takes them away, and offers no liability cap.
    expect(text("liability_aftercare")).toMatch(/does not affect your legal rights/);
    // The six months is fixed (the law's minimum), the consumer chooses the remedy, and a failed repair is replaced or refunded.
    expect(text("liability_aftercare")).toMatch(/within 6 months/);
    expect(text("liability_aftercare")).not.toMatch(/\[6 months\]/);
    expect(text("liability_aftercare")).toMatch(/at your choice/);
    expect(text("liability_aftercare")).toMatch(/does not hold within 3 months/);
    expect(text("liability_aftercare")).not.toMatch(/not (be )?(liable|responsible)|limited to/i);
    // Variations are said before the customer agrees.
    expect(text("variations")).toMatch(/Tell us before you say yes/);
  });
});
