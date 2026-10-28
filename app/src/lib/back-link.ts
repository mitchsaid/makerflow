/**
 * "Back to where you were", for a page the maker is sent to from a document to fix something (the business profile,
 * a customer). The way back travels in the address as `?back=/app/...`. Only an address inside the app is accepted:
 * anything else (another site, a protocol-relative `//`, a backslash trick) is ignored, so the link can never be made
 * to send a person somewhere else (docs/plans/invoice-preview.md).
 */
export function safeBackPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (!/^\/app(\/|\?|$)/.test(value)) return null;
  if (value.includes("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}

/** What the page is called in "Back to …": worked out from the path, so no number has to travel with it. */
export function backLabelFor(path: string): string {
  const [pathname] = path.split(/[?#]/);
  const parts = pathname.split("/").filter(Boolean); // ["app", "invoices", "drafts", id, "preview"]
  const [, area, second, , last] = parts;
  if (area === "invoices") {
    if (second === "drafts") return last === "preview" ? "invoice preview" : "invoice draft";
    if (second === "new") return "new invoice";
    return "invoice";
  }
  if (area === "quotes") {
    if (second === "new") return "new quote";
    return parts[3] === "preview" ? "quote preview" : "quote";
  }
  if (area === "jobs") return "job";
  if (area === "customers") return "customer";
  return "where you were";
}

/** The address of a page with the way back to another added: `withBack("/app/business", "/app/quotes/1")`. */
export function withBack(href: string, back: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}back=${encodeURIComponent(back)}`;
}
