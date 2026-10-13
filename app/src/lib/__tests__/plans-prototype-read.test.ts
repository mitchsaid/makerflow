import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/plans/README.md, "Prototype read": a plan for a feature the prototype also has lists what the prototype's
 * code does (read in full) and what MakerFlow does with each behaviour, or says in one line that there is no
 * prototype counterpart. Jobs slice 1 was planned from a summary and missed a feature the prototype had; this
 * makes a new plan start from the read.
 */

const plans = join(__dirname, "../../../../docs/plans");

/** Plans written before the rule (2026-10-13). Do not add to this list: write the section instead. */
const BEFORE_THE_RULE = new Set([
  "README.md",
  "bank-details.md",
  "business-profile-and-customers.md",
  "business-type.md",
  "costs-and-recipes.md",
  "jobs-and-invoices.md",
  "onboarding.md",
  "product-choices.md",
  "product-extras.md",
  "products.md",
  "quote-delivery-address.md",
  "quote-deposits.md",
  "quote-discard-revision.md",
  "quote-issuing.md",
  "quote-line-vat.md",
  "quote-looks.md",
  "quote-outcomes.md",
  "quote-policies.md",
  "quote-setup.md",
  "quote-themes.md",
  "quote-wording.md",
  "quotes.md",
  "session-bound-rls.md",
  "terms.md",
  "ui-foundation-shadcn.md",
  "variation-images.md",
  "vat-on-costs-adviser-questions.md",
  "walking-skeleton.md",
]);

/** The text of the "Prototype read" section, up to the next heading of the same or a higher level, or null. */
export function prototypeReadSection(markdown: string): string | null {
  const match = /^(#{2,3}) Prototype read\b.*$/m.exec(markdown);
  if (!match) return null;
  const level = match[1].length;
  const rest = markdown.slice(match.index + match[0].length);
  const next = new RegExp(`^#{1,${level}} `, "m").exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

describe("prototype read in plans", () => {
  const newPlans = readdirSync(plans).filter((f) => f.endsWith(".md") && !BEFORE_THE_RULE.has(f));

  it("finds the section, and tells a real read from an empty heading", () => {
    expect(prototypeReadSection("# Plan\n\n## Prototype read\n\nNo prototype counterpart.\n\n## Next\n")).toBe("No prototype counterpart.");
    expect(prototypeReadSection("# Plan\n\n## What the maker sees\n")).toBeNull();
    const table = "## Prototype read\n\nRead in full: Jobs.tsx.\n\n| The prototype does | MakerFlow | Why |\n| --- | --- | --- |\n| A | kept | B |\n\n## Next\n";
    expect(prototypeReadSection(table)).toContain("| A | kept | B |");
  });

  for (const file of newPlans) {
    it(`${file} has a Prototype read: a table of behaviours, or "No prototype counterpart."`, () => {
      const section = prototypeReadSection(readFileSync(join(plans, file), "utf8"));
      expect(section, `docs/plans/${file} needs a "## Prototype read" section (docs/plans/README.md)`).not.toBeNull();
      const none = /No prototype counterpart\./.test(section!);
      const table = /^\|.*\|\s*$/m.test(section!) && /^\|\s*-{3,}/m.test(section!) && section!.split("\n").filter((l) => /^\|/.test(l)).length >= 3;
      expect(none || table, `docs/plans/${file}: say "No prototype counterpart." or list the behaviours in a table`).toBe(true);
    });
  }
});
