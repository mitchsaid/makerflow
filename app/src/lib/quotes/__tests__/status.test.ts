import { describe, expect, it } from "vitest";
import { quoteStatusKey, quoteStatusLabel } from "../status";

const q = (over: Partial<Parameters<typeof quoteStatusKey>[0]> = {}) => ({
  status: "draft",
  version: 1,
  validUntil: "2026-10-16",
  today: "2026-10-03",
  ...over,
});

describe("how a quote's state is shown", () => {
  it("calls a never-sent draft a draft and a draft of a sent quote a revision", () => {
    expect(quoteStatusKey(q())).toBe("draft");
    expect(quoteStatusKey(q({ version: 2 }))).toBe("revising");
    expect(quoteStatusLabel("revising")).toBe("Revising");
  });

  it("derives Expired from the valid-until day, for sent quotes only", () => {
    expect(quoteStatusKey(q({ status: "sent" }))).toBe("sent");
    expect(quoteStatusKey(q({ status: "sent", validUntil: "2026-10-03" }))).toBe("sent");
    expect(quoteStatusKey(q({ status: "sent", validUntil: "2026-10-02" }))).toBe("expired");
    // A draft is never "expired": it has not been offered yet.
    expect(quoteStatusKey(q({ validUntil: "2026-09-01" }))).toBe("draft");
  });

  it("passes the later states through", () => {
    for (const s of ["accepted", "declined", "withdrawn"]) {
      expect(quoteStatusKey(q({ status: s, validUntil: "2020-01-01" }))).toBe(s);
    }
  });
});
