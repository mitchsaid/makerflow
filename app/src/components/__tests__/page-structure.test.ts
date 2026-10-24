import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two rules about how screens are put together, read from the source:
 * - docs/adr/0009-back-navigation.md: a page under another goes back with the shared PageHeader, never an underlined
 *   text link above the heading (that is how a website does it).
 * - docs/adr/0005-form-errors.md: a form that shows a FormSummary wraps itself in a FormErrorScope, so errors clear
 *   when the maker fixes the thing.
 */

const root = join(__dirname, "../../app");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === "__tests__" ? [] : files(path)) : path.endsWith(".tsx") ? [path] : [];
  });
}

const sources = files(root).map((path) => ({ file: relative(root, path), text: readFileSync(path, "utf8") }));

describe("back navigation", () => {
  it("has no underlined text link standing in for a back control", () => {
    const offenders = sources.filter((s) => /text-sm text-muted-foreground underline/.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("uses the shared header on every page that sits under another", () => {
    const under = [
      "jobs/new/page.tsx",
      "jobs/[id]/page.tsx",
      "jobs/[id]/add-item/page.tsx",
      "customers/new/page.tsx",
      "customers/[id]/page.tsx",
      "products/new/page.tsx",
      "products/[id]/page.tsx",
      "materials/new/page.tsx",
      "materials/[id]/page.tsx",
      "quotes/settings/policies/page.tsx",
      "quotes/settings/policies/new/page.tsx",
      "quotes/settings/policies/[id]/page.tsx",
      "quotes/settings/themes/page.tsx",
      "quotes/settings/themes/new/page.tsx",
      "quotes/[id]/page.tsx",
      "quotes/[id]/preview/page.tsx",
    ].map((p) => `app/${p}`);
    const without = under.filter((p) => !sources.find((s) => s.file === p)?.text.includes("<PageHeader"));
    expect(without).toEqual([]);
    expect(sources.find((s) => s.file === "app/quotes/settings/themes/theme-studio.tsx")?.text).toContain("<BackLink");
  });

  it("gives every back control a name that says where it goes", () => {
    const header = readFileSync(join(__dirname, "../page-header.tsx"), "utf8");
    expect(header).toContain("aria-label={`Back to ${label}`}");
    expect(header).toContain("aria-label={`Close and go back to ${label}`}");
  });
});

describe("form errors", () => {
  it("wraps every form that shows a summary in an error scope", () => {
    const offenders = sources.filter((s) => s.text.includes("<FormSummary") && !s.text.includes("<FormErrorScope")).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});
