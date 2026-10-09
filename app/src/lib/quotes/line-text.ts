/**
 * How an item is named on a document: its name, and the variation chosen joined to it
 * ("Wedding cake, Large"; docs/plans/product-choices.md, decision 8).
 */
export function itemName(line: { name: string; variation?: { name: string } | null }): string {
  return line.variation ? `${line.name}, ${line.variation.name}` : line.name;
}

type OptionLike = {
  group: string;
  kind: "one" | "any" | "text";
  charge: "item" | "line";
  value: string | null;
  text: string | null;
  amountCents: number;
};

/**
 * The options chosen, folded into one line under the item (decision 8): "Flavour: Vanilla · Extras: Gold leaf,
 * Gift box (+R30 once) · Message: “Happy 40th”". Amounts charged per item are already in the price each, so
 * only those charged once are shown, so the sums add up.
 */
export function optionsText(options: readonly OptionLike[] | undefined, money: (cents: number) => string): string | null {
  if (!options || options.length === 0) return null;
  const once = (o: OptionLike) => (o.charge === "line" && o.amountCents > 0 ? ` (+${money(o.amountCents)} once)` : "");
  const groups: { name: string; parts: string[] }[] = [];
  for (const o of options) {
    const part = o.kind === "text" ? `“${o.text ?? ""}”${once(o)}` : `${o.value ?? ""}${once(o)}`;
    const existing = groups.find((g) => g.name === o.group);
    if (existing) existing.parts.push(part);
    else groups.push({ name: o.group, parts: [part] });
  }
  return groups.map((g) => `${g.name}: ${g.parts.join(", ")}`).join(" · ");
}
