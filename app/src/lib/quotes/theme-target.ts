/**
 * What a theme is being chosen for when the maker goes from a preview to the theme studio and back: a draft quote or
 * a draft invoice. Quotes and invoices share one library of themes (docs/plans/invoice-themes.md), so the studio only
 * needs to know where to put the theme on Save and where "back" goes.
 */
export type ThemeTarget = { kind: "quote" | "invoice"; id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The target in the address (`?quote=<id>` or `?invoice=<id>`), when it is one. */
export function themeTargetFromQuery(query: { quote?: string | string[]; invoice?: string | string[] }): ThemeTarget | undefined {
  if (typeof query.quote === "string" && UUID.test(query.quote)) return { kind: "quote", id: query.quote };
  if (typeof query.invoice === "string" && UUID.test(query.invoice)) return { kind: "invoice", id: query.invoice };
  return undefined;
}

/** The target as it goes in an address: `quote=<id>` or `invoice=<id>`. */
export function themeTargetParam(target: ThemeTarget): string {
  return `${target.kind}=${target.id}`;
}

/** Where the maker came from, and what to call it. */
export function themeTargetBack(target: ThemeTarget): { href: string; label: string } {
  return target.kind === "quote"
    ? { href: `/app/quotes/${target.id}/preview`, label: "the quote preview" }
    : { href: `/app/invoices/drafts/${target.id}/preview`, label: "the invoice preview" };
}
