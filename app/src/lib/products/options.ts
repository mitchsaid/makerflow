import { parseMoney, type Cents } from "../money";

/**
 * Lists you pick one from (docs/plans/product-extras.md): Flavour, Filling, Metal. They sit with the variations:
 * each choice adds an amount (often R0) to each item, optionally by the product's variation. One is always
 * chosen; an optional list has a choice like "None". (Extras are in ./extras.)
 */

export const OPTION_NAME_MAX = 80;
export const OPTIONS_MAX = 20;
export const OPTION_VALUES_MAX = 50;

/**
 * What a quote item's copy of a choice can be: "one" (from a list), or "any" and "text" (an extra: ticked, or
 * ticked with its wording typed). A product's own lists are all "one".
 */
export type OptionKind = "one" | "any" | "text";

/** `prices`: by variation id, when the option's price depends on the variation (else empty). */
export type OptionValue = { id: string; name: string; priceCents: Cents; usual: boolean; prices: Record<string, Cents> };
export type OptionGroup = {
  id: string;
  name: string;
  kind: "one";
  /** Each value has a price for each of the product's variations ("Flavour: Red velvet, Small +R20, Large +R50"). */
  priceByVariation: boolean;
  values: OptionValue[];
};

/** One list on the form while it is being filled in. Ids are "" for new ones. `prices`: by the variation row's key, when the choice's price depends on the variation. */
export type OptionValueFormRow = { key: string; id: string; name: string; price: string; usual: boolean; prices?: Record<string, string> };
export type OptionGroupFormRow = {
  key: string;
  id: string;
  name: string;
  kind: "one";
  priceByVariation?: boolean;
  values: OptionValueFormRow[];
};

export type ParsedOptionGroup = Omit<OptionGroup, "id" | "values"> & {
  id: string | null;
  values: { id: string | null; name: string; priceCents: Cents; usual: boolean; prices: { variationIndex: number; priceCents: Cents }[] }[];
};

export type OptionGroupErrors = {
  name?: string;
  /** About the values as a whole ("add at least one"). */
  values?: string;
  rows: Record<string, { name?: string; price?: string; prices?: Record<string, string> }>;
};
export type OptionErrors = { list?: string; groups: Record<string, OptionGroupErrors> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValueRow(value: unknown): value is OptionValueFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const pricesOk =
    v.prices === undefined ||
    (typeof v.prices === "object" && v.prices !== null && !Array.isArray(v.prices) && Object.values(v.prices).every((p) => typeof p === "string"));
  return typeof v.key === "string" && typeof v.id === "string" && typeof v.name === "string" && typeof v.price === "string" && typeof v.usual === "boolean" && pricesOk;
}

function isGroupRow(value: unknown): value is OptionGroupFormRow {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    v.kind === "one" &&
    (v.priceByVariation === undefined || typeof v.priceByVariation === "boolean") &&
    Array.isArray(v.values) &&
    v.values.length <= OPTION_VALUES_MAX &&
    v.values.every(isValueRow)
  );
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

/**
 * Checks the options, saying how to fix each problem where it is. `variationKeys` are the product's variation
 * rows in order (a price by variation is stored by the variation's place in that list).
 */
export function parseOptionGroups(
  input: unknown,
  variationKeys: readonly string[] = [],
): { ok: true; groups: ParsedOptionGroup[] } | { ok: false; errors: OptionErrors } {
  const errors: OptionErrors = { groups: {} };
  if (!Array.isArray(input)) return { ok: false, errors: { ...errors, list: "The lists could not be read. Open the product again." } };
  if (input.length > OPTIONS_MAX) return { ok: false, errors: { ...errors, list: `A product can have up to ${OPTIONS_MAX} lists.` } };
  if (!input.every(isGroupRow)) return { ok: false, errors: { ...errors, list: "The lists could not be read. Open the product again." } };

  const groups: ParsedOptionGroup[] = [];
  const groupNames = new Set<string>();
  for (const row of input) {
    const e: OptionGroupErrors = { rows: {} };
    const name = tidy(row.name);
    if (name === "") e.name = "Give it a name, like “Flavour” or “Filling”.";
    else if (name.length > OPTION_NAME_MAX) e.name = `Keep the name to ${OPTION_NAME_MAX} characters or fewer.`;
    else if (groupNames.has(name.toLowerCase())) e.name = "Two lists have this name. Give each its own.";
    groupNames.add(name.toLowerCase());

    const values: ParsedOptionGroup["values"] = [];
    if (row.values.length === 0) e.values = "Add at least one choice.";
    // Prices by variation only make sense when there are variations to price by.
    const byVariation = row.priceByVariation === true && variationKeys.length > 0;
    const valueNames = new Set<string>();
    let usualTaken = false;
    for (const v of row.values) {
      const ve: { name?: string; price?: string } = {};
      const vName = tidy(v.name);
      if (vName === "") ve.name = "Give it a name, like “Vanilla”.";
      else if (vName.length > OPTION_NAME_MAX) ve.name = `Keep the name to ${OPTION_NAME_MAX} characters or fewer.`;
      else if (valueNames.has(vName.toLowerCase())) ve.name = "Two have this name. Give each its own.";
      valueNames.add(vName.toLowerCase());
      // An empty amount is R0: most choices cost nothing extra.
      const amount = (text: string) => (text.trim() === "" ? ({ ok: true, value: 0 } as const) : parseMoney(text));
      const prices: { variationIndex: number; priceCents: Cents }[] = [];
      const priceErrors: Record<string, string> = {};
      let price: ReturnType<typeof amount>;
      if (byVariation) {
        variationKeys.forEach((vk, index) => {
          const text = v.prices?.[vk] ?? "";
          // Left empty, a size would quietly cost nothing: say so (0 is fine when typed).
          if (text.trim() === "") {
            priceErrors[vk] = "Enter what it adds for this one. Use 0 if nothing.";
            return;
          }
          const r = parseMoney(text);
          if (r.ok) prices.push({ variationIndex: index, priceCents: r.value });
          else priceErrors[vk] = r.error;
        });
        // The value's own price is the lowest of its prices (its "from").
        price = { ok: true, value: prices.length > 0 ? Math.min(...prices.map((p) => p.priceCents)) : 0 };
      } else {
        price = amount(v.price);
        if (!price.ok) ve.price = price.error;
      }
      if (Object.keys(priceErrors).length > 0) (ve as { prices?: Record<string, string> }).prices = priceErrors;
      if (ve.name || ve.price || Object.keys(priceErrors).length > 0) e.rows[v.key] = ve;
      else if (price.ok) {
        const usual = v.usual && !usualTaken;
        if (usual) usualTaken = true;
        values.push({ id: UUID.test(v.id) ? v.id : null, name: vName, priceCents: price.value, usual, prices });
      }
    }


    if (e.name || e.values || Object.keys(e.rows).length > 0) errors.groups[row.key] = e;
    else {
      groups.push({
        id: UUID.test(row.id) ? row.id : null,
        name,
        kind: "one",
        priceByVariation: row.priceByVariation === true && variationKeys.length > 0,
        values,
      });
    }
  }
  if (errors.list || Object.keys(errors.groups).length > 0) return { ok: false, errors };
  return { ok: true, groups };
}

/** What save_product takes for the options. */
export function optionsPayload(groups: readonly ParsedOptionGroup[]) {
  return groups.map((g) => ({
    ...(g.id ? { id: g.id } : {}),
    name: g.name,
    kind: "one",
    // One is always chosen from a list: an optional list has a choice like "None".
    required: true,
    price_by_variation: g.priceByVariation,
    values: g.values.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      price_cents: v.priceCents,
      usual: v.usual,
      ...(g.priceByVariation ? { prices: v.prices.map((p) => ({ variation_index: p.variationIndex, price_cents: p.priceCents })) } : {}),
    })),
  }));
}
