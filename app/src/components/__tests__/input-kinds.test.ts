import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { files, root } from "./jsx-source";

/**
 * docs/ux-inputs.md: each kind of thing the app asks for has one way of asking. Founder, 2026-10-17: "there are places in
 * the app that ask for an address or a quantity but don't use structured input." These read the screens and fail when
 * a screen asks for one of them with a plain text box again.
 */

/** The props of every self-closing `<Tag ... />` in a source file (the end is the first "/>" outside braces). */
function selfClosing(source: string, tag: string): string[] {
  const found: string[] = [];
  const open = new RegExp(`<${tag}\\b`, "g");
  for (let m = open.exec(source); m; m = open.exec(source)) {
    let depth = 0;
    for (let i = m.index + m[0].length; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === "/" && source[i + 1] === ">" && depth === 0) {
        found.push(source.slice(m.index + m[0].length, i));
        break;
      }
    }
  }
  return found;
}

const labelOf = (props: string) => /label=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/.exec(props)?.slice(1).find((x) => x !== undefined) ?? "";

const FIELDS = ["TextField", "TextAreaField"];

describe("input kinds", () => {
  it("an address is asked for with the address fields, never one box", () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8");
      for (const tag of FIELDS) {
        for (const props of selfClosing(source, tag)) {
          const label = labelOf(props);
          // (an email address is an email, not a postal address)
          if (/address|deliver to|ship to|street|postal code|suburb/i.test(label) && !/e-?mail/i.test(label)) found.push(`${file.replace(root, "app")}: <${tag} label="${label}">`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("a quantity is asked for with the quantity field, not a plain number box", () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8");
      for (const tag of FIELDS) {
        for (const props of selfClosing(source, tag)) {
          const label = labelOf(props);
          if (/\b(quantity|how many|how much|number of)\b/i.test(label)) found.push(`${file.replace(root, "app")}: <${tag} label="${label}">`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
