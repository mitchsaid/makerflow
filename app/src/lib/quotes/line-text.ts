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
  /** How many of an extra: absent means one for each item, a number is a fixed count. */
  quantityMilli?: number | null;
  value: string | null;
  text: string | null;
  amountCents: number;
};

/** How many of an extra when it is a fixed count (a once-per-line extra from before is one); null: one for each item. */
export function fixedCount(o: Pick<OptionLike, "charge" | "quantityMilli">): number | null {
  if (o.charge === "line") return 1000;
  return o.quantityMilli ?? null;
}

/**
 * The options chosen, folded into one line under the item (decision 8): "Flavour: Vanilla · Extras: Gold leaf,
 * Gift box · Message: “Happy 40th”". Amounts for each item are already in the price each. An extra for a fixed
 * count shows what it adds so the sums add up: "(+R30 once)" for one, "(3 × R30,00)" for more.
 */
export function optionsText(options: readonly OptionLike[] | undefined, money: (cents: number) => string): string | null {
  if (!options || options.length === 0) return null;
  const once = (o: OptionLike) => {
    const count = fixedCount(o);
    if (count === null || o.amountCents <= 0) return "";
    return count === 1000 ? ` (+${money(o.amountCents)} once)` : ` (${count / 1000} × ${money(o.amountCents)})`;
  };
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
  const perItem = options.reduce((sum, o) => sum + (fixedCount(o) === null ? o.amountCents : 0), 0);
  const label = (o: OptionLike) => `${o.group}: ${o.kind === "text" ? `“${o.text ?? ""}”` : (o.value ?? "")}`;
  return {
    priceEachCents: line.unitPriceCents - perItem,
    folded: optionsText(options.filter((o) => o.amountCents === 0), money),
    priced: options
      .filter((o) => o.amountCents > 0)
      .map((o) => ({
        label: label(o),
        amount: (() => {
          const count = fixedCount(o);
          if (o.charge === "line") return `${money(o.amountCents)} once`;
          if (count !== null) return `${count / 1000} × ${money(o.amountCents)} = ${money(Math.round((count * o.amountCents) / 1000))}`;
          return `${quantity} × ${money(o.amountCents)} = ${money(Math.round((line.quantityMilli * o.amountCents) / 1000))}`;
        })(),
      })),
  };
}
