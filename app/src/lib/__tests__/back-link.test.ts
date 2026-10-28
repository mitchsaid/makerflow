import { describe, expect, it } from "vitest";
import { backLabelFor, safeBackPath, withBack } from "../back-link";

describe("safeBackPath", () => {
  it("accepts addresses inside the app, with or without a query", () => {
    expect(safeBackPath("/app/invoices/drafts/abc")).toBe("/app/invoices/drafts/abc");
    expect(safeBackPath("/app/quotes/abc?next=invoice")).toBe("/app/quotes/abc?next=invoice");
    expect(safeBackPath("/app")).toBe("/app");
  });
  it("refuses anything that could leave the app", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "/app//evil.example", "/apple", "/sign-in", "app/quotes", "/app/\nx", "", null, undefined, 5]) {
      expect(safeBackPath(bad)).toBeNull();
    }
    expect(safeBackPath(`/app/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("backLabelFor", () => {
  it("names the page from its path", () => {
    expect(backLabelFor("/app/invoices/drafts/abc")).toBe("invoice draft");
    expect(backLabelFor("/app/invoices/drafts/abc/preview")).toBe("invoice preview");
    expect(backLabelFor("/app/invoices/new")).toBe("new invoice");
    expect(backLabelFor("/app/invoices/abc")).toBe("invoice");
    expect(backLabelFor("/app/quotes/abc")).toBe("quote");
    expect(backLabelFor("/app/quotes/abc/preview")).toBe("quote preview");
    expect(backLabelFor("/app/quotes/abc?next=invoice")).toBe("quote");
    expect(backLabelFor("/app/quotes/new")).toBe("new quote");
    expect(backLabelFor("/app/jobs/abc")).toBe("job");
    expect(backLabelFor("/app/customers/abc")).toBe("customer");
    expect(backLabelFor("/app/more")).toBe("where you were");
  });
});

describe("withBack", () => {
  it("adds the way back, whether or not the address has a query", () => {
    expect(withBack("/app/business", "/app/quotes/1")).toBe("/app/business?back=%2Fapp%2Fquotes%2F1");
    expect(withBack("/app/customers/1?section=details", "/app/invoices/drafts/2")).toBe("/app/customers/1?section=details&back=%2Fapp%2Finvoices%2Fdrafts%2F2");
  });
});
