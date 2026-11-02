import { describe, expect, it } from "vitest";
import { parseTheme, THEME_INIT_SCRIPT, THEME_KEY } from "../index";

describe("the Appearance choice", () => {
  it("only light and dark are choices; anything else follows the device", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const odd of [null, undefined, "", "system", "Dark", "blue", 3]) expect(parseTheme(odd)).toBe("system");
  });

  it("the head script reads the same key, sets the attribute, and cannot throw", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_KEY));
    expect(THEME_INIT_SCRIPT).toContain('setAttribute("data-theme"');
    expect(THEME_INIT_SCRIPT).toMatch(/^\(function\(\)\{try\{.*\}catch\(e\)\{\}\}\)\(\);$/);
    // It must parse as a script on its own.
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });

  it("the head script applies a stored choice and ignores a stale one", () => {
    const run = (stored: string | null) => {
      const attrs: Record<string, string> = {};
      const doc = {
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
        querySelectorAll: () => [],
        addEventListener: () => undefined,
      };
      new Function("localStorage", "document", THEME_INIT_SCRIPT)({ getItem: () => stored }, doc);
      return attrs["data-theme"];
    };
    expect(run("dark")).toBe("dark");
    expect(run("light")).toBe("light");
    expect(run("purple")).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
});
