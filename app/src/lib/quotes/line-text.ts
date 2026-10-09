/**
 * How an item is named on a document: its name, and the variation chosen joined to it
 * ("Wedding cake, Large"; docs/plans/product-choices.md, decision 8).
 */
export function itemName(line: { name: string; variation?: { name: string } | null }): string {
  return line.variation ? `${line.name}, ${line.variation.name}` : line.name;
}
