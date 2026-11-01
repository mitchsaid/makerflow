import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { legalContact, PRIVACY_SECTIONS, SERVICES, TERMS_SECTIONS } from "../index";

const text = (sections: typeof PRIVACY_SECTIONS) => sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.list ?? [])]).join("\n");

describe("the policy and the terms", () => {
  it("have sections with unique ids, a heading and some words", () => {
    for (const sections of [PRIVACY_SECTIONS, TERMS_SECTIONS]) {
      expect(new Set(sections.map((s) => s.id)).size).toBe(sections.length);
      for (const s of sections) {
        expect(s.heading.length).toBeGreaterThan(0);
        expect((s.paragraphs?.length ?? 0) + (s.list?.length ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it("name every outside service the app really uses, and only those", () => {
    const names = SERVICES.map((s) => s.name);
    expect(names).toEqual(["Supabase", "Vercel", "Anthropic"]);
    // Each service is in the code or the setup it claims to be in.
    const root = join(__dirname, "../../../..");
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    expect(pkg).toContain("@supabase/supabase-js");
    expect(readFileSync(join(root, "vercel.json"), "utf8")).toContain("regions");
    expect(readFileSync(join(root, "src/lib/reader/provider.ts"), "utf8")).toContain("api.anthropic.com");
  });

  it("do not promise what the app does not do: no analytics, and the reader says the document is not kept", () => {
    const privacy = text(PRIVACY_SECTIONS);
    expect(privacy).toMatch(/no analytics|do not use tracking or analytics/i);
    expect(privacy).toMatch(/do not store the document/i);
    // The app has no analytics or tracking library (this would have to be revisited, with the policy, if one is added).
    const pkg = readFileSync(join(__dirname, "../../../../package.json"), "utf8");
    expect(pkg).not.toMatch(/analytics|gtag|posthog|plausible|mixpanel|segment|hotjar|sentry/i);
  });

  it("say the tax and layout help is not advice, and that the demo is thrown away", () => {
    expect(text(TERMS_SECTIONS)).toMatch(/not tax, legal or accounting advice/);
    expect(text(TERMS_SECTIONS)).toMatch(/cleared after about six hours/);
    expect(text(PRIVACY_SECTIONS)).toMatch(/about six hours/);
  });

  it("the contact address comes from the setting, or is not shown", () => {
    expect(legalContact({})).toBeNull();
    expect(legalContact({ NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: "  " })).toBeNull();
    expect(legalContact({ NEXT_PUBLIC_LEGAL_CONTACT_EMAIL: "hello@example.test" })).toBe("hello@example.test");
  });
});
