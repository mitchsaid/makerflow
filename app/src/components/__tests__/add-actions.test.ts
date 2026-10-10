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

/**
 * The elements `<Tag ...>label</Tag>` in a source file, with their props and label. The end of the opening tag is
 * the first ">" outside braces, so an arrow function in a prop (`onClick={() => ...}`) does not end it early.
 */
function elements(source: string, tag: string): { props: string; label: string }[] {
  const found: { props: string; label: string }[] = [];
  const open = new RegExp(`<${tag}\\b`, "g");
  for (let m = open.exec(source); m; m = open.exec(source)) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const close = source.indexOf(`</${tag}>`, i);
    if (i >= source.length || close === -1 || source[i - 1] === "/") continue;
    found.push({ props: source.slice(m.index + m[0].length, i), label: source.slice(i + 1, close) });
  }
  return found;
}

describe("add actions", () => {
  const found: string[] = [];
  for (const file of files(root)) {
    const source = readFileSync(file, "utf8");
    // A plain Button whose label starts with "Add": allowed only as a submit button (the form's own "Add product").
    for (const { props, label } of elements(source, "Button")) {
      if (/type="submit"/.test(props)) continue;
      if (startsAdd(wordsOf(label))) found.push(`${file.replace(root, "app")}: <Button> "${wordsOf(label).slice(0, 40)}"`);
    }
    // A Link that looks like a button and says "Add".
    for (const { props, label } of elements(source, "Link")) {
      if (/buttonVariants/.test(props) && startsAdd(wordsOf(label))) found.push(`${file.replace(root, "app")}: <Link> "${wordsOf(label).slice(0, 40)}"`);
    }
  }

  it("are all AddButton or AddLink, with the plus", () => {
    expect(found).toEqual([]);
  });

  it("finds the ones it is meant to (the scan is not empty, and reads past arrow functions in props)", () => {
    const used = files(root).filter((f) => /<Add(Button|Link)\b/.test(readFileSync(f, "utf8")));
    expect(used.length).toBeGreaterThanOrEqual(8);
    const sample = '<Button variant="outline" onClick={() => open({ kind: "pick" })}>Add item</Button>';
    expect(elements(sample, "Button")).toEqual([{ props: ' variant="outline" onClick={() => open({ kind: "pick" })}', label: "Add item" }]);
  });
});
