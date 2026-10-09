import type { BusinessType } from "../business-types";
import { parseMoney, type Cents } from "../money";
import type { ProductKind } from "./index";

/**
 * Variations (docs/plans/product-choices.md): a list where each entry is a complete version of the product
 * with its own price ("Small R300", "Large R600"). The maker names the list ("Size", "Tiers"). Exactly one
 * is chosen on a quote item. A product has none, or two or more.
 */

export const VARIATION_LABEL_MAX = 40;
export const VARIATION_NAME_MAX = 80;
export const VARIATIONS_MAX = 50;

export type ProductVariation = { id: string; name: string; priceCents: Cents; usual: boolean };

/** One row of the form while it is being filled in. `id` is "" for a new one. */
export type VariationFormRow = { key: string; id: string; name: string; price: string; usual: boolean };

export type ParsedVariation = { id: string | null; name: string; priceCents: Cents; usual: boolean };

export type VariationRowErrors = { name?: string; price?: string };
export type VariationErrors = { label?: string; list?: string; rows: Record<string, VariationRowErrors> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRow(value: unknown): value is VariationFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "string" &&
    typeof v.usual === "boolean"
  );
}

/** Checks the list and its name, saying how to fix each problem at the row it belongs to. */
export function parseVariations(
  labelInput: unknown,
  rowsInput: unknown,
): { ok: true; label: string | null; variations: ParsedVariation[] } | { ok: false; errors: VariationErrors } {
  const errors: VariationErrors = { rows: {} };
  if (!Array.isArray(rowsInput) || rowsInput.length > VARIATIONS_MAX || !rowsInput.every(isRow)) {
    if (Array.isArray(rowsInput) && rowsInput.length > VARIATIONS_MAX) {
      return { ok: false, errors: { ...errors, list: `A product can have up to ${VARIATIONS_MAX} variations. Make it two products instead.` } };
    }
    return { ok: false, errors: { ...errors, list: "The variations could not be read. Open the product again." } };
  }
  const rows = rowsInput;
  if (rows.length === 0) return { ok: true, label: null, variations: [] };

  const label = typeof labelInput === "string" ? labelInput.trim().replace(/\s+/g, " ") : "";
  if (label === "") errors.label = "Say what you call them, like “Size” or “Tiers”.";
  else if (label.length > VARIATION_LABEL_MAX) errors.label = `Keep it to ${VARIATION_LABEL_MAX} characters or fewer.`;

  if (rows.length === 1) errors.list = "Add at least one more, or remove this one and give the product a single price.";

  const seen = new Set<string>();
  const variations: ParsedVariation[] = [];
  let usualTaken = false;
  for (const row of rows) {
    const rowErrors: VariationRowErrors = {};
    const name = row.name.trim().replace(/\s+/g, " ");
    if (name === "") rowErrors.name = "Give it a name, like “Large”.";
    else if (name.length > VARIATION_NAME_MAX) rowErrors.name = `Keep the name to ${VARIATION_NAME_MAX} characters or fewer.`;
    else if (seen.has(name.toLowerCase())) rowErrors.name = "Two have this name. Give each its own.";
    seen.add(name.toLowerCase());

    const price = parseMoney(row.price);
    if (!price.ok) rowErrors.price = row.price.trim() === "" ? "Enter a price. Use 0 if it is free." : price.error;

    if (rowErrors.name || rowErrors.price) errors.rows[row.key] = rowErrors;
    else if (price.ok) {
      // Only one can be the usual one (the screen allows one; the first wins otherwise).
      const usual = row.usual && !usualTaken;
      if (usual) usualTaken = true;
      variations.push({ id: UUID.test(row.id) ? row.id : null, name, priceCents: price.value, usual });
    }
  }

  if (errors.label || errors.list || Object.keys(errors.rows).length > 0) return { ok: false, errors };
  return { ok: true, label, variations };
}

const BY_TYPE: Record<BusinessType, readonly string[]> = {
  food: ["Size", "Tiers", "Box", "Portion"],
  jewellery: ["Size", "Length", "Metal"],
  clothing: ["Size", "Fit"],
  flowers: ["Size", "Stems", "Arrangement"],
  home_body: ["Size", "Jar", "Scent"],
  craft: ["Size", "Finish", "Wood"],
  art: ["Size", "Print size", "Edition"],
  workshops: ["Ticket", "Session", "Group size"],
  other: [],
};
const GENERAL = ["Size", "Type", "Style"];
const SERVICE = ["Duration", "Package", "Session"];

/** Names to suggest for the list: the business's own kinds first, then general ones. Six at most. */
export function variationSuggestions(types: readonly BusinessType[] | null, kind: ProductKind): string[] {
  const ordered = kind === "service" ? [...SERVICE, ...(types ?? []).flatMap((t) => (t === "workshops" ? BY_TYPE.workshops : [])), ...GENERAL] : [...(types ?? []).flatMap((t) => BY_TYPE[t] ?? []), ...GENERAL];
  return [...new Set(ordered)].slice(0, 6);
}

/** "from R300" for a product with variations; its own price otherwise. Prices are in cents. */
export function lowestPrice(variations: readonly { priceCents: Cents }[], ownPrice: Cents): Cents {
  return variations.length === 0 ? ownPrice : Math.min(...variations.map((v) => v.priceCents));
}

/**
 * The price follows the maker between the product's one price and its variations, so nothing typed is lost:
 * adding variations puts the product's price into the first one (if that is still empty), and removing the
 * last variation puts the first one's price back as the product's price.
 */
export function carryPrice(
  before: { unitPrice: string; rows: readonly VariationFormRow[] },
  rows: VariationFormRow[],
): { unitPrice: string; rows: VariationFormRow[] } {
  if (before.rows.length === 0 && rows.length > 0 && rows[0].price.trim() === "" && before.unitPrice.trim() !== "") {
    return { unitPrice: before.unitPrice, rows: [{ ...rows[0], price: before.unitPrice }, ...rows.slice(1)] };
  }
  if (before.rows.length > 0 && rows.length === 0 && before.rows[0].price.trim() !== "") {
    return { unitPrice: before.rows[0].price, rows };
  }
  return { unitPrice: before.unitPrice, rows };
}
