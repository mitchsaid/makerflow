import { describe, expect, it } from "vitest";
import { ZA_LOCALE } from "../../locale/za";
import { parseQuote, toDatabasePayload, type QuoteFormValues } from "../../quotes";
import {
  copyForQuote,
  defaultQuotePolicies,
  inLibraryOrder,
  parsePolicy,
  parseQuotePolicies,
  QUOTE_MAX_POLICIES,
  sortPolicies,
  type PolicySummary,
  type QuotePolicyValues,
} from "..";

const policy = (over: Partial<PolicySummary> = {}): PolicySummary => ({
  id: "11111111-1111-4111-8111-111111111111",
  organisationId: "o",
  title: "If you cancel",
  body: "You pay the deposit.",
  includeByDefault: true,
  sortOrder: 0,
  archived: false,
  ...over,
});

describe("parsePolicy", () => {
  it("accepts a title and wording, and tidies them", () => {
    const r = parsePolicy({ title: "  Re-quote   changes ", body: "Line one.\n\n\n\nLine two.", includeByDefault: true });
    expect(r).toEqual({
      ok: true,
      value: { title: "Re-quote changes", body: "Line one.\n\nLine two.", includeByDefault: true },
    });
  });

  it("says how to fix what is missing, by field", () => {
    const r = parsePolicy({ title: "", body: "", includeByDefault: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toMatch(/Give the policy a title/);
      expect(r.errors.body).toMatch(/Write what the policy says/);
    }
  });

  it("limits the title, the wording and the lines", () => {
    const r = parsePolicy({
      title: "t".repeat(81),
      body: "b".repeat(2001),
      includeByDefault: false,
    });
    expect(!r.ok && r.errors.title).toMatch(/up to 80 characters/);
    expect(!r.ok && r.errors.body).toMatch(/up to 2000 characters/);
    const lines = Array.from({ length: 41 }, (_, i) => `line ${i}`).join("\n");
    const tall = parsePolicy({ title: "x", body: lines, includeByDefault: false });
    expect(!tall.ok && tall.errors.body).toMatch(/up to 40 lines/);
  });
});

describe("a quote's own copy of policies", () => {
  it("starts with the policies marked for new quotes, in the maker's order, never archived ones", () => {
    const library = [
      policy({ id: "a", sortOrder: 1, title: "Aftercare" }),
      policy({ id: "b", sortOrder: 0, title: "Changes" }),
      policy({ id: "c", sortOrder: 2, includeByDefault: false, title: "Not by default" }),
      policy({ id: "d", sortOrder: 3, archived: true, title: "Archived" }),
    ];
    expect(defaultQuotePolicies(library).map((c) => c.title)).toEqual(["Changes", "Aftercare"]);
    expect(defaultQuotePolicies(library)[0]).toMatchObject({ policyId: "b", body: "You pay the deposit." });
  });

  it("is its own copy: the saved policy can change without it", () => {
    const saved = policy();
    const copy = copyForQuote(saved, "k1");
    saved.body = "Changed later";
    expect(copy.body).toBe("You pay the deposit.");
  });

  it("checks each copy, by its key, and the number on a quote", () => {
    const ok: QuotePolicyValues = { key: "k1", policyId: "", title: "Changes", body: "Text" };
    expect(parseQuotePolicies([ok])).toEqual({
      ok: true,
      policies: [{ policyId: null, title: "Changes", body: "Text" }],
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
      showBankDetails: true,
      policies: [{ key: "k", policyId: "11111111-1111-4111-8111-111111111111", title: "If you cancel", body: "Edited for this quote" }],
    };
    const parsed = parseQuote(values, { registered: false });
    if (!parsed.ok) throw new Error("should parse");
    const payload = toDatabasePayload(parsed.quote, { countryCode: "ZA", currencyCode: "ZAR" });
    expect(payload.quote.policies).toEqual([
      { policy_id: "11111111-1111-4111-8111-111111111111", title: "If you cancel", body: "Edited for this quote" },
    ]);
    const bad = parseQuote({ ...values, policies: [{ ...values.policies[0], body: "" }] }, { registered: false });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.fields.policies).toBeTruthy();
  });

  it("keeps a quote's policies in the library's order, whatever order they were ticked in", () => {
    const cancel = policy({ id: "a", sortOrder: 1, title: "Cancel" });
    const changes = policy({ id: "b", sortOrder: 0, title: "Changes" });
    const ticked = [copyForQuote(cancel, "1"), copyForQuote(changes, "2"), { key: "3", policyId: "gone", title: "Old", body: "x" }];
    expect(inLibraryOrder(ticked, [cancel, changes]).map((c) => c.title)).toEqual(["Changes", "Cancel", "Old"]);
  });

  it("lists the library in the maker's order, then by name", () => {
    const sorted = sortPolicies([
      policy({ title: "B", sortOrder: 1 }),
      policy({ title: "Z", sortOrder: 2 }),
      policy({ title: "A", sortOrder: 1 }),
    ]);
    expect(sorted.map((p) => p.title)).toEqual(["A", "B", "Z"]);
  });
});

describe("the South African examples", () => {
  const za = ZA_LOCALE.policies;
  const example = (key: string) => za.examples.find((e) => e.key === key)!;

  it("each have a title, wording and a good-to-know note, and the pack carries the not-legal-advice line", () => {
    expect(za.examples.length).toBeGreaterThan(4);
    for (const e of za.examples) {
      expect(e.title.length, e.key).toBeGreaterThan(3);
      expect(e.goodToKnow.length, e.key).toBeGreaterThan(40);
    }
    expect(za.adviceNote).toMatch(/not legal advice/);
  });

  it("are valid policies as they stand, with unique keys and titles", () => {
    const keys = new Set(za.examples.map((e) => e.key));
    const titles = new Set(za.examples.map((e) => e.title));
    expect(keys.size).toBe(za.examples.length);
    expect(titles.size).toBe(za.examples.length);
    for (const e of za.examples) {
      expect(parsePolicy({ title: e.title, body: e.text, includeByDefault: false }).ok, e.key).toBe(true);
    }
  });

  it("follow the consumer-law points in docs/locales/za/consumer-policies.md", () => {
    // A new date is agreed with the customer, never set by the maker alone.
    expect(example("re-quote").text).toMatch(/agree the new price and the new date with you/);
    expect(example("re-quote").goodToKnow).toMatch(/shouldn't move unless the customer agrees/);
    // Cancellation has a made-to-order example and a bookings one with the hospital or death exception.
    expect(za.examples.filter((e) => /cancel/i.test(e.title)).map((e) => e.key)).toEqual(["made-to-order", "bookings"]);
    expect(example("bookings").text).toMatch(/in hospital, or the person it is for has died/);
    // The deposit counts towards the charge: never the deposit on top of the costs.
    expect(example("made-to-order").text).toMatch(/deposit of \[amount or %\] counts towards that/);
    // Aftercare adds to legal rights and never takes them away, and offers no liability cap.
    const aftercare = example("aftercare").text;
    expect(aftercare).toMatch(/does not affect your legal rights/);
    // The six months is fixed (the law's minimum), the consumer chooses the remedy, and a failed repair is replaced or refunded.
    expect(aftercare).toMatch(/within 6 months/);
    expect(aftercare).not.toMatch(/\[6 months\]/);
    expect(aftercare).toMatch(/at your choice/);
    expect(aftercare).toMatch(/does not hold within 3 months/);
    expect(aftercare).not.toMatch(/not (be )?(liable|responsible)|limited to/i);
    // Variations are said before the customer agrees.
    expect(example("handmade").text).toMatch(/Tell us before you say yes/);
  });
});
