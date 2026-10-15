import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Reading the screens' source for the guard tests (add-actions, button-styles). */

export const root = join(__dirname, "../../app");

export function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? (name === "__tests__" ? [] : files(path)) : path.endsWith(".tsx") ? [path] : [];
  });
}

/** The words a JSX element shows: its text and the strings in its expressions, without tags. */
export const wordsOf = (jsx: string) =>
  jsx
    .replace(/<[^>]*>/g, " ")
    .replace(/[{}`"'?:]|\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The elements `<Tag ...>label</Tag>` in a source file, with their props and label. The end of the opening tag is
 * the first ">" outside braces, so an arrow function in a prop (`onClick={() => ...}`) does not end it early.
 */
export function elements(source: string, tag: string): { props: string; label: string }[] {
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

