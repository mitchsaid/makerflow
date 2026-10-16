import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { files, root } from "./jsx-source";

/**
 * docs/adr/0003-ui-components.md, "Helper text": a field's helper text is one short line (founder, 2026-10-16: "too
 * lengthy… concise and to the point"). Anything longer belongs in the page's prose, not under a title. This reads
 * the screens and finds written-out hints over the limit.
 */
const MAX_HINT = 80;

describe("helper text", () => {
  it(`a written-out hint is at most ${MAX_HINT} characters`, () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bhint="([^"]*)"/g)) {
        if (match[1].length > MAX_HINT) found.push(`${file.replace(root, "app")}: "${match[1]}"`);
      }
    }
    expect(found).toEqual([]);
  });
});
