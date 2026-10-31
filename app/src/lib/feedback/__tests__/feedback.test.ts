import { describe, expect, it } from "vitest";
import { FEEDBACK_MAX, parseFeedback } from "..";

describe("parseFeedback", () => {
  it("reads the words, the kind and where they were", () => {
    const r = parseFeedback({ kind: "problem", message: "  The total looks wrong \r\n on the quote ", contact: true, page: "/app/quotes/abc", viewport: "412x839", userAgent: "Mozilla/5.0" });
    expect(r).toEqual({
      ok: true,
      value: { kind: "problem", message: "The total looks wrong \n on the quote", contact: true, page: "/app/quotes/abc", viewport: "412x839", userAgent: "Mozilla/5.0" },
    });
  });

  it("says how to fix empty or too long words", () => {
    expect(parseFeedback({ kind: "idea", message: "   " })).toEqual({ ok: false, errors: { message: "Tell us what happened or what would help, even in a few words." } });
    const long = parseFeedback({ kind: "idea", message: "x".repeat(FEEDBACK_MAX + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors.message).toMatch(/Keep it to 2000/);
    expect(parseFeedback({ kind: "idea", message: "x".repeat(FEEDBACK_MAX) }).ok).toBe(true);
  });

  it("falls back to 'something else' and drops what looks wrong without stopping the feedback", () => {
    const r = parseFeedback({ kind: "rant", message: "Hi", contact: "yes", page: "https://elsewhere.test/x", viewport: "wide", userAgent: "   " });
    expect(r).toEqual({ ok: true, value: { kind: "other", message: "Hi", contact: false, page: null, viewport: null, userAgent: null } });
    expect(parseFeedback({ kind: "other", message: "Hi", page: "//evil.test" })).toMatchObject({ ok: true, value: { page: null } });
  });

  it("refuses something that is not an object", () => {
    expect(parseFeedback(null).ok).toBe(false);
    expect(parseFeedback("hello").ok).toBe(false);
  });
});
