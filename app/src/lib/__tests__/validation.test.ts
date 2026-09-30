import { describe, expect, it } from "vitest";
import {
  BUSINESS_NAME_MAX,
  safeNextPath,
  validateBusinessName,
  validateEmail,
} from "../validation";

describe("validateBusinessName", () => {
  it("trims and collapses whitespace", () => {
    expect(validateBusinessName("  Sweet   Nothings \n")).toEqual({
      ok: true,
      value: "Sweet Nothings",
    });
  });

  it("rejects empty, whitespace-only and non-string input", () => {
    for (const bad of ["", "   ", null, undefined, 42]) {
      expect(validateBusinessName(bad).ok).toBe(false);
    }
  });

  it("accepts the maximum length and rejects one more", () => {
    expect(validateBusinessName("x".repeat(BUSINESS_NAME_MAX)).ok).toBe(true);
    expect(validateBusinessName("x".repeat(BUSINESS_NAME_MAX + 1)).ok).toBe(false);
  });

  it("keeps apostrophes and accents", () => {
    expect(validateBusinessName("Zoë's Bakery")).toEqual({
      ok: true,
      value: "Zoë's Bakery",
    });
  });
});

describe("validateEmail", () => {
  it("normalises case and whitespace", () => {
    expect(validateEmail("  Mitch@Example.COM ")).toEqual({
      ok: true,
      value: "mitch@example.com",
    });
  });

  it("rejects obvious typos", () => {
    for (const bad of ["", "nope", "a@b", "a b@c.com", "@x.com", null, 7]) {
      expect(validateEmail(bad).ok).toBe(false);
    }
  });

  it("rejects absurdly long addresses", () => {
    expect(validateEmail(`${"a".repeat(250)}@x.com`).ok).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("allows in-site paths", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/app/invoices?x=1")).toBe("/app/invoices?x=1");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "evil",
      "/ok\nX-Injected: 1",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad)).toBe("/app");
    }
  });

  it("uses the supplied fallback", () => {
    expect(safeNextPath("//x", "/home")).toBe("/home");
  });
});
