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
  /** Only "line" on versions sent before options were simplified (charged once for the line). */
  charge?: "item" | "line";
  value: string | null;
  text: string | null;
  amountCents: number;
};

/**
 * The options chosen, folded into one line under the item (decision 8): "Flavour: Vanilla · Extras: Gold leaf,
 * Gift box · Message: “Happy 40th”". The amounts are already in the price each. Versions sent before options
 * were simplified could charge an extra once for the line: those show "(+R30 once)", so the sums add up.
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

/**
 * How an item's extras are drawn, by the theme's "Extra prices" choice. Included (the default): the price
 * each includes the per-item extras and the options print folded under the item. Shown separately: the price
 * each is the item's own, and every option with an amount gets its own line with what it adds.
 */
export function extrasView(
  line: { quantityMilli: number; unitPriceCents: number; options?: readonly OptionLike[] },
  separate: boolean,
  money: (cents: number) => string,
  quantity: string,
): { priceEachCents: number; folded: string | null; priced: { label: string; amount: string }[] } {
  const options = line.options ?? [];
  if (!separate || !options.some((o) => o.amountCents > 0)) {
    return { priceEachCents: line.unitPriceCents, folded: optionsText(options, money), priced: [] };
  }
  const perItem = options.reduce((sum, o) => sum + (o.charge !== "line" ? o.amountCents : 0), 0);
  const label = (o: OptionLike) => `${o.group}: ${o.kind === "text" ? `“${o.text ?? ""}”` : (o.value ?? "")}`;
  return {
    priceEachCents: line.unitPriceCents - perItem,
    folded: optionsText(options.filter((o) => o.amountCents === 0), money),
    priced: options
      .filter((o) => o.amountCents > 0)
      .map((o) => ({
        label: label(o),
        amount:
          o.charge === "line"
            ? `${money(o.amountCents)} once`
            : `${quantity} × ${money(o.amountCents)} = ${money(Math.round((line.quantityMilli * o.amountCents) / 1000))}`,
      })),
  };
}
