import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elements, files, root, wordsOf } from "./jsx-source";

/**
 * docs/adr/0003-ui-components.md, "Buttons": a button with words on it has a visible shape. `ghost` (no border, no
 * fill until pressed) is for icon-only buttons; a small action inside a form or card is `soft`, a dismissal is
 * `outline`, taking something away is `danger`. Plain text that is really a button was the founder's complaint
 * about "Use my usual" (2026-10-15). This reads the screens and finds the ghost buttons that carry words.
 */
describe("button styles", () => {
  it("no ghost button has words on it", () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8");
      for (const tag of ["Button", "AddButton"]) {
        for (const { props, label } of elements(source, tag)) {
          if (!/variant="ghost"/.test(props)) continue;
          if (/size="icon/.test(props)) continue;
          found.push(`${file.replace(root, "app")}: <${tag}> "${wordsOf(label).slice(0, 40)}"`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
