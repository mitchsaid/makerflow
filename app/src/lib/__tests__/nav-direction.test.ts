import { describe, expect, it } from "vitest";
import { navDirection } from "../nav-direction";

describe("navDirection", () => {
  it("goes forward to a page under this one, and back to a parent", () => {
    expect(navDirection("/app/quotes", "/app/quotes/abc")).toBe("nav-forward");
    expect(navDirection("/app/quotes/abc", "/app/quotes/abc/preview")).toBe("nav-forward");
    expect(navDirection("/app/quotes/abc/preview", "/app/quotes/abc")).toBe("nav-back");
    expect(navDirection("/app/quotes/abc", "/app/quotes")).toBe("nav-back");
    expect(navDirection("/app/quotes/settings/themes/new", "/app/quotes/settings")).toBe("nav-back");
  });

  it("has no direction between peers, to the same page, or for a change of query only", () => {
    expect(navDirection("/app/quotes", "/app/jobs")).toBeNull();
    expect(navDirection("/app/quotes/abc", "/app/quotes/def")).toBeNull();
    expect(navDirection("/app/customers/abc", "/app/quotes/def")).toBeNull();
    expect(navDirection("/app/quotes", "/app/quotes")).toBeNull();
    expect(navDirection("/app/customers/abc", "/app/customers/abc?section=jobs")).toBeNull();
  });

  it("ignores the query, the hash and trailing slashes when comparing", () => {
    expect(navDirection("/app/quotes?x=1", "/app/quotes/abc?back=%2Fapp")).toBe("nav-forward");
    expect(navDirection("/app/quotes/abc/", "/app/quotes#top")).toBe("nav-back");
  });

  it("treats /app as the parent of everything in the app", () => {
    expect(navDirection("/app", "/app/quotes")).toBe("nav-forward");
    expect(navDirection("/app/quotes", "/app")).toBe("nav-back");
  });

  it("leaves other sites and addresses that are not paths alone", () => {
    expect(navDirection("/app/quotes", "https://example.com/app/quotes/abc")).toBeNull();
    expect(navDirection("/app/quotes", "//example.com/x")).toBeNull();
    expect(navDirection("/app/quotes", "mailto:a@b.c")).toBeNull();
    expect(navDirection("/app/quotes", "tel:0215550101")).toBeNull();
    expect(navDirection("/app/quotes", "quotes/abc")).toBeNull();
  });
});
