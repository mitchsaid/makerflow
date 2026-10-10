import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * docs/adr/0008-add-actions.md: an action that adds something is an AddButton or an AddLink (a plus before the
 * label), never a plain Button or a Link styled as one. This reads the screens and finds the ones that are not.
 */

const root = join(__dirname, "../../app");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === "__tests__" ? [] : files(path)) : path.endsWith(".tsx") ? [path] : [];
  });
}

/** The words a JSX element shows: its text and the strings in its expressions, without tags. */
const wordsOf = (jsx: string) =>
  jsx
    .replace(/<[^>]*>/g, " ")
    .replace(/[{}`"'?:]|\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const startsAdd = (words: string) => /^(Add|Make a new)\b/.test(words);

describe("add actions", () => {
  const found: string[] = [];
  for (const file of files(root)) {
    const source = readFileSync(file, "utf8");
    // A plain Button whose label starts with "Add": allowed only as a submit button (the form's own "Add product").
    for (const match of source.matchAll(/<Button\b([^>]*)>([\s\S]*?)<\/Button>/g)) {
      if (/type="submit"/.test(match[1])) continue;
      if (startsAdd(wordsOf(match[2]))) found.push(`${file.replace(root, "app")}: <Button> "${wordsOf(match[2]).slice(0, 40)}"`);
    }
    // A Link that looks like a button and says "Add".
    for (const match of source.matchAll(/<Link\b([^>]*)>([\s\S]*?)<\/Link>/g)) {
      if (/buttonVariants/.test(match[1]) && startsAdd(wordsOf(match[2]))) found.push(`${file.replace(root, "app")}: <Link> "${wordsOf(match[2]).slice(0, 40)}"`);
    }
  }

  it("are all AddButton or AddLink, with the plus", () => {
    expect(found).toEqual([]);
  });

  it("finds the ones it is meant to (the scan is not empty)", () => {
    const used = files(root).filter((f) => /<Add(Button|Link)\b/.test(readFileSync(f, "utf8")));
    expect(used.length).toBeGreaterThanOrEqual(8);
  });
});
