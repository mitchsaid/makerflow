import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { elements, files, root, wordsOf } from "./jsx-source";

/**
 * docs/adr/0008-add-actions.md: an action that adds something is an AddButton or an AddLink (a plus before the
 * label), never a plain Button or a Link styled as one. This reads the screens and finds the ones that are not.
 */

const startsAdd = (words: string) => /^(Add|Make a new)\b/.test(words);

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
